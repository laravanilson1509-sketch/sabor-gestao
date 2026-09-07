-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 7 — Perdas, Alertas Automáticos e Indicadores de Desempenho (BI)
-- =============================================================================
-- Pré-requisito: rode, nesta ordem, os 6 scripts anteriores.
--
-- gerar_alertas() foi escrita para ser chamada periodicamente pelo pg_cron
-- (extensão nativa do Supabase). Ao final do script há o comando de
-- agendamento comentado — descomente depois de habilitar a extensão em
-- Database > Extensions > pg_cron.
-- =============================================================================


-- =============================================================================
-- 1. PERDAS
-- =============================================================================

create type motivo_perda as enum (
  'vencimento','excesso_producao','erro_producao','queima',
  'armazenamento','quebra','devolucao','outros'
);

create table public.perdas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  ingrediente_id uuid references public.ingredientes(id),
  produto_id uuid references public.produtos(id),   -- perda de insumo OU de produto pronto
  quantidade numeric(12,3) not null check (quantidade > 0),
  custo numeric(12,2) not null default 0,
  motivo motivo_perda not null,
  observacao text,
  usuario_id uuid references public.profiles(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  constraint chk_perda_referencia check (ingrediente_id is not null or produto_id is not null)
);

-- perda de ingrediente gera baixa automática de estoque (reaproveita o mesmo
-- trigger de saldo/custo médio já existente — 'perda' já é um tipo previsto)
create or replace function public.trg_perda_baixar_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ingrediente_id is not null then
    insert into public.movimentacoes_estoque
      (unidade_id, ingrediente_id, tipo, quantidade, custo_unitario, motivo, documento_referencia)
    values
      (new.unidade_id, new.ingrediente_id, 'perda', new.quantidade,
       new.custo / nullif(new.quantidade, 0), new.motivo::text, 'Perda #' || new.id);
  end if;
  return new;
end;
$$;

create trigger trg_perdas_ai
  after insert on public.perdas
  for each row execute function public.trg_perda_baixar_estoque();

-- histórico imutável, como as demais movimentações
create trigger trg_perdas_bloqueio
  before update or delete on public.perdas
  for each row execute function public.bloquear_alteracao();

create or replace view public.vw_perdas_resumo as
select
  unidade_id,
  date_trunc('day', criado_em)::date as dia,
  motivo,
  count(*) as ocorrencias,
  sum(custo) as valor_total
from public.perdas
group by 1, 2, 3;


-- =============================================================================
-- 2. CENTRAL DE ALERTAS
-- =============================================================================

create type tipo_alerta as enum (
  'estoque_abaixo_minimo','estoque_acima_maximo','produto_vencendo','produto_vencido',
  'pedido_atrasado','compra_pendente','conta_vencendo','conta_vencida',
  'margem_abaixo_limite','aumento_perdas','queda_vendas','divergencia_estoque'
);

create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tipo tipo_alerta not null,
  severidade text not null default 'atencao' check (severidade in ('info','atencao','critico')),
  titulo text not null,
  detalhe text,
  referencia_tipo text,
  referencia_id uuid,
  referencia_data date not null default current_date,
  lido boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (unidade_id, tipo, referencia_tipo, referencia_id, referencia_data)
);

create index idx_alertas_unidade_lido on public.alertas (unidade_id, lido);

-- 2.1 Geração dos alertas — roda todas as regras do requisito -----------------
create or replace function public.gerar_alertas()
returns void language plpgsql security definer set search_path = public as $$
begin

  -- estoque abaixo do mínimo / acima do máximo
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select unidade_id, 'estoque_abaixo_minimo', 'critico',
         'Estoque abaixo do mínimo: ' || nome,
         'Atual: ' || quantidade_atual || ' · mínimo: ' || estoque_minimo,
         'ingrediente', ingrediente_id
  from public.vw_estoque_alertas
  where situacao = 'abaixo_minimo'
  on conflict do nothing;

  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select unidade_id, 'estoque_acima_maximo', 'info',
         'Estoque acima do máximo: ' || nome,
         'Atual: ' || quantidade_atual || ' · máximo: ' || estoque_maximo,
         'ingrediente', ingrediente_id
  from public.vw_estoque_alertas
  where situacao = 'acima_maximo'
  on conflict do nothing;

  -- validade: vencendo em até 3 dias, ou já vencido
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select unidade_id, 'produto_vencendo', 'atencao',
         'Lote vencendo: ' || ingrediente,
         'Lote ' || coalesce(numero_lote, lote_id::text) || ' vence em ' || dias_para_vencer || ' dia(s)',
         'lote', lote_id
  from public.vw_lotes_vencimento
  where dias_para_vencer between 0 and 3
  on conflict do nothing;

  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select unidade_id, 'produto_vencido', 'critico',
         'Lote vencido: ' || ingrediente,
         'Lote ' || coalesce(numero_lote, lote_id::text) || ' venceu há ' || abs(dias_para_vencer) || ' dia(s)',
         'lote', lote_id
  from public.vw_lotes_vencimento
  where dias_para_vencer < 0
  on conflict do nothing;

  -- pedido atrasado: mais de 30 min em aberto sem entregar
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select unidade_id, 'pedido_atrasado', 'atencao',
         'Pedido #' || numero || ' atrasado',
         round(minutos_em_aberto) || ' min em aberto',
         'pedido', id
  from public.vw_pedidos_em_andamento
  where minutos_em_aberto > 30
  on conflict do nothing;

  -- compra pendente/atrasada
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select unidade_id, 'compra_pendente', 'atencao',
         'Pedido de compra #' || numero || ' atrasado',
         'Fornecedor: ' || fornecedor || ' · previsão: ' || previsao_entrega,
         'pedido_compra', id
  from public.vw_pedidos_compra_pendentes
  where atrasado
  on conflict do nothing;

  -- contas a pagar vencendo (3 dias) ou vencidas
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select unidade_id, 'conta_vencendo', 'atencao',
         'Conta a pagar vence em breve: ' || descricao,
         'Vencimento: ' || data_vencimento || ' · valor: R$ ' || valor,
         'conta_pagar', id
  from public.contas_pagar
  where status = 'aberta' and data_vencimento between current_date and current_date + 3
  on conflict do nothing;

  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select unidade_id, 'conta_vencida', 'critico',
         'Conta a pagar vencida: ' || descricao,
         'Venceu em ' || data_vencimento || ' · valor: R$ ' || valor,
         'conta_pagar', id
  from public.contas_pagar
  where status = 'aberta' and data_vencimento < current_date
  on conflict do nothing;

  -- margem de ficha técnica abaixo de 20%
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select p.unidade_id, 'margem_abaixo_limite', 'atencao',
         'Margem baixa: ' || p.nome,
         'Margem atual: ' || f.margem_pct || '%',
         'produto', p.id
  from public.fichas_tecnicas f
  join public.produtos p on p.id = f.produto_id
  where f.margem_pct is not null and f.margem_pct < 20
  on conflict do nothing;

  -- aumento anormal de perdas: perdas de hoje > 2x a média diária dos últimos 7 dias
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_data)
  select hoje.unidade_id, 'aumento_perdas', 'atencao',
         'Aumento anormal de perdas',
         'Hoje: R$ ' || hoje.valor_total || ' · média 7 dias: R$ ' || round(media.media_dia, 2),
         'unidade', hoje.unidade_id, current_date
  from (
    select unidade_id, sum(valor_total) as valor_total
    from public.vw_perdas_resumo where dia = current_date group by unidade_id
  ) hoje
  join (
    select unidade_id, avg(valor_total) as media_dia
    from public.vw_perdas_resumo
    where dia between current_date - 7 and current_date - 1
    group by unidade_id
  ) media on media.unidade_id = hoje.unidade_id
  where hoje.valor_total > 2 * media.media_dia
  on conflict do nothing;

  -- queda de vendas: faturamento de hoje < 50% da média dos últimos 7 dias
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_data)
  select hoje.unidade_id, 'queda_vendas', 'atencao',
         'Queda de vendas',
         'Hoje: R$ ' || hoje.total || ' · média 7 dias: R$ ' || round(media.media_dia, 2),
         'unidade', hoje.unidade_id, current_date
  from (
    select unidade_id, sum(valor) as total
    from public.contas_receber
    where status = 'recebida' and data_recebimento = current_date
    group by unidade_id
  ) hoje
  join (
    select unidade_id, avg(diario) as media_dia
    from (
      select unidade_id, data_recebimento, sum(valor) as diario
      from public.contas_receber
      where status = 'recebida' and data_recebimento between current_date - 7 and current_date - 1
      group by unidade_id, data_recebimento
    ) d group by unidade_id
  ) media on media.unidade_id = hoje.unidade_id
  where hoje.total < 0.5 * media.media_dia
  on conflict do nothing;

  -- divergência de estoque: ajustes/inventário com módulo do delta acima de 10%
  -- do saldo atual do ingrediente, nas últimas 24h
  insert into public.alertas (unidade_id, tipo, severidade, titulo, detalhe, referencia_tipo, referencia_id)
  select m.unidade_id, 'divergencia_estoque', 'atencao',
         'Divergência de estoque: ' || i.nome,
         'Ajuste de ' || m.quantidade || ' ' || i.unidade_medida || ' registrado',
         'movimentacao', m.id
  from public.movimentacoes_estoque m
  join public.ingredientes i on i.id = m.ingrediente_id
  join public.estoque_saldo es on es.ingrediente_id = m.ingrediente_id and es.unidade_id = m.unidade_id
  where m.tipo in ('ajuste', 'inventario')
    and m.criado_em > now() - interval '24 hours'
    and abs(m.quantidade) > 0.1 * nullif(es.quantidade_atual, 0)
  on conflict do nothing;

end;
$$;

-- agendamento (rode manualmente após habilitar a extensão pg_cron no projeto):
-- select cron.schedule('gerar-alertas-15min', '*/15 * * * *', $$select public.gerar_alertas();$$);


-- =============================================================================
-- 3. INDICADORES DE DESEMPENHO (BI)
-- =============================================================================

create or replace view public.vw_vendas_diarias as
select
  unidade_id,
  date_trunc('day', criado_em)::date as dia,
  count(*) filter (where status = 'entregue') as pedidos,
  sum(total) filter (where status = 'entregue') as faturamento,
  case when count(*) filter (where status = 'entregue') > 0
    then round(sum(total) filter (where status = 'entregue') / count(*) filter (where status = 'entregue'), 2)
    else 0 end as ticket_medio,
  count(*) filter (where status = 'cancelado') as cancelamentos
from public.pedidos
group by 1, 2;

create or replace view public.vw_vendas_por_produto as
select
  p.unidade_id,
  pi.produto_id,
  pr.nome as produto,
  date_trunc('day', p.criado_em)::date as dia,
  sum(pi.quantidade) as quantidade_vendida,
  sum(pi.quantidade * pi.preco_unitario - pi.desconto) as faturamento
from public.pedido_itens pi
join public.pedidos p on p.id = pi.pedido_id
join public.produtos pr on pr.id = pi.produto_id
where p.status = 'entregue'
group by 1, 2, 3, 4;

create or replace view public.vw_vendas_por_categoria as
select
  p.unidade_id,
  pr.categoria_id,
  cp.nome as categoria,
  date_trunc('day', p.criado_em)::date as dia,
  sum(pi.quantidade) as quantidade_vendida,
  sum(pi.quantidade * pi.preco_unitario - pi.desconto) as faturamento
from public.pedido_itens pi
join public.pedidos p on p.id = pi.pedido_id
join public.produtos pr on pr.id = pi.produto_id
left join public.categorias_produto cp on cp.id = pr.categoria_id
where p.status = 'entregue'
group by 1, 2, 3, 4;

create or replace view public.vw_vendas_por_canal as
select
  unidade_id,
  canal,
  date_trunc('day', criado_em)::date as dia,
  count(*) as pedidos,
  sum(total) as faturamento
from public.pedidos
where status = 'entregue'
group by 1, 2, 3;

create or replace view public.vw_vendas_por_funcionario as
select
  p.unidade_id,
  p.usuario_id,
  pr.nome as funcionario,
  date_trunc('day', p.criado_em)::date as dia,
  count(*) as pedidos,
  sum(p.total) as faturamento
from public.pedidos p
left join public.profiles pr on pr.id = p.usuario_id
where p.status = 'entregue'
group by 1, 2, 3, 4;

-- giro e cobertura de estoque (base: consumo médio diário dos últimos 30 dias)
create or replace view public.vw_giro_cobertura_estoque as
with consumo_30d as (
  select unidade_id, ingrediente_id, sum(quantidade) / 30.0 as consumo_medio_dia
  from public.movimentacoes_estoque
  where tipo = 'consumo_producao' and criado_em > now() - interval '30 days'
  group by unidade_id, ingrediente_id
)
select
  es.unidade_id,
  es.ingrediente_id,
  i.nome,
  es.quantidade_atual,
  coalesce(c.consumo_medio_dia, 0) as consumo_medio_dia,
  case when coalesce(c.consumo_medio_dia, 0) > 0
    then round(es.quantidade_atual / c.consumo_medio_dia, 1)
    else null end as dias_cobertura,
  case when es.quantidade_atual <= 0 then true else false end as em_ruptura
from public.estoque_saldo es
join public.ingredientes i on i.id = es.ingrediente_id
left join consumo_30d c on c.unidade_id = es.unidade_id and c.ingrediente_id = es.ingrediente_id;

-- tempo médio de produção (do primeiro item em preparo até o pedido pronto)
-- e tempo médio de atendimento (do pedido aberto até a entrega)
create or replace view public.vw_tempos_operacionais as
select
  unidade_id,
  date_trunc('day', criado_em)::date as dia,
  round(avg(extract(epoch from (atualizado_em - criado_em)) / 60)
    filter (where status = 'entregue'), 1) as tempo_medio_atendimento_min
from public.pedidos
group by 1, 2;

-- painel consolidado por dia (o principal consumidor do dashboard/BI)
create or replace view public.vw_indicadores_diarios as
select
  v.unidade_id,
  v.dia,
  v.pedidos,
  v.faturamento,
  v.ticket_medio,
  v.cancelamentos,
  coalesce(d.faturamento, 0) as faturamento_dre,   -- confere com o DRE (base contas_receber)
  coalesce(d.cmv, 0) as cmv,
  case when coalesce(d.faturamento, 0) > 0
    then round(d.cmv / d.faturamento * 100, 2) else null end as cmv_pct,
  t.tempo_medio_atendimento_min,
  coalesce(pd.valor_total, 0) as perdas_valor
from public.vw_vendas_diarias v
left join public.vw_dre_mensal d
  on d.unidade_id = v.unidade_id and d.mes = date_trunc('month', v.dia)
left join public.vw_tempos_operacionais t
  on t.unidade_id = v.unidade_id and t.dia = v.dia
left join (
  select unidade_id, dia, sum(valor_total) as valor_total
  from public.vw_perdas_resumo group by unidade_id, dia
) pd on pd.unidade_id = v.unidade_id and pd.dia = v.dia;


-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

alter table public.perdas enable row level security;
alter table public.alertas enable row level security;

create policy perdas_select on public.perdas for select using (public.user_has_unidade(unidade_id));
create policy perdas_insert on public.perdas for insert with check (
  public.user_papel(unidade_id) in ('administrador','proprietario','gerente','estoque','cozinha')
);

create policy alertas_select on public.alertas for select using (public.user_has_unidade(unidade_id));
create policy alertas_marcar_lido on public.alertas for update
  using (public.user_has_unidade(unidade_id))
  with check (public.user_has_unidade(unidade_id));
-- inserção só pela função gerar_alertas() (SECURITY DEFINER) — sem policy de insert direta
