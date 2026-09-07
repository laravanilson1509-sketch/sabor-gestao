-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 1.1 — Refinamento: formação de preço com custo fixo + produtos de revenda
-- =============================================================================
-- Pré-requisito: rode depois de schema-fichas-tecnicas-estoque.sql (e, se já
-- tiver rodado, depois de todos os outros — este script só adiciona colunas
-- e tabelas novas, não quebra nada do que já existe).
--
-- O que muda:
--   1. Ficha técnica passa a aceitar uma lista de custos adicionais
--      (embalagem, mão de obra, gás, etc.) em vez de um único campo genérico.
--   2. Custos fixos da unidade (aluguel, salários administrativos...) passam
--      a ser rateados automaticamente sobre o custo de cada produto, e a
--      ficha técnica calcula um preço de venda sugerido (markup divisor).
--   3. Produtos "prontos para levar" (garrafa de açaí, pacote de farinha...)
--      viram um tipo de produto que aponta direto pra um ingrediente —
--      sem precisar montar uma ficha técnica manualmente.
-- =============================================================================


-- =============================================================================
-- 1. CUSTOS ADICIONAIS DETALHADOS NA FICHA TÉCNICA
-- =============================================================================

create type tipo_custo_adicional as enum ('embalagem','mao_de_obra','gas_energia','outro');

create table public.ficha_tecnica_custos_adicionais (
  id uuid primary key default gen_random_uuid(),
  ficha_tecnica_id uuid not null references public.fichas_tecnicas(id) on delete cascade,
  tipo tipo_custo_adicional not null,
  descricao text not null,        -- ex.: 'Copo 500ml + tampa', 'Mão de obra (8 min)'
  valor numeric(12,4) not null check (valor >= 0),
  criado_em timestamptz not null default now()
);

comment on table public.ficha_tecnica_custos_adicionais is
  'Qualquer custo direto do produto além dos ingredientes: embalagem, mão de obra, '
  'gás/energia de preparo etc. Some tudo isso à ficha técnica, no lugar de um único '
  'campo genérico de "embalagem".';

-- o antigo campo custo_embalagem continua existindo por compatibilidade, mas
-- passa a ser tratado como só mais uma linha dentro do total de adicionais
comment on column public.fichas_tecnicas.custo_embalagem is
  'Preferir lançar itens em ficha_tecnica_custos_adicionais (tipo=''embalagem''). '
  'Este campo é somado ao total como um custo adicional legado.';


-- =============================================================================
-- 2. CUSTOS FIXOS E CONFIGURAÇÃO DE PRECIFICAÇÃO (POR UNIDADE)
-- =============================================================================

create table public.custos_fixos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,               -- ex.: 'Aluguel', 'Energia', 'Salários administrativos'
  valor_mensal numeric(12,2) not null check (valor_mensal >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.configuracoes_precificacao (
  unidade_id uuid primary key references public.unidades(id) on delete cascade,
  faturamento_medio_mensal_estimado numeric(12,2) not null default 0,
  percentual_impostos numeric(5,2) not null default 0,        -- ex.: Simples Nacional
  percentual_taxas_cartao numeric(5,2) not null default 0,    -- média cartão/plataformas
  margem_lucro_desejada_pct numeric(5,2) not null default 0,  -- markup desejado
  atualizado_em timestamptz not null default now()
);

comment on table public.configuracoes_precificacao is
  'Parâmetros usados para sugerir o preço de venda de cada ficha técnica. '
  'faturamento_medio_mensal_estimado é a base sobre a qual o custo fixo é '
  'rateado — normalmente a média dos últimos meses (dá pra puxar de '
  'vw_indicadores_diarios depois que o histórico existir).';

-- índice de custo fixo: quanto, em %, cada real de custo variável precisa
-- carregar de custo fixo, dado o faturamento médio estimado
create or replace function public.obter_indice_custo_fixo(p_unidade_id uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_custos_fixos numeric(12,2);
  v_faturamento numeric(12,2);
begin
  select coalesce(sum(valor_mensal), 0) into v_custos_fixos
    from public.custos_fixos where unidade_id = p_unidade_id and ativo = true;

  select faturamento_medio_mensal_estimado into v_faturamento
    from public.configuracoes_precificacao where unidade_id = p_unidade_id;

  if coalesce(v_faturamento, 0) <= 0 then
    return 0; -- sem base de faturamento configurada, não há como ratear ainda
  end if;

  return round(v_custos_fixos / v_faturamento * 100, 4);
end;
$$;


-- =============================================================================
-- 3. FICHA TÉCNICA — RECALCULO COMPLETO (custo variável + fixo + preço sugerido)
-- =============================================================================
-- Substitui a função da Fase 1: mesma assinatura, mesmos gatilhos já
-- existentes continuam funcionando sem alteração nenhuma.

alter table public.fichas_tecnicas
  add column custo_adicional numeric(12,4) not null default 0,   -- soma de custo_embalagem + custos adicionais detalhados
  add column custo_fixo_rateado numeric(12,4) not null default 0,
  add column custo_total_com_fixo numeric(12,4) not null default 0,
  add column preco_sugerido numeric(12,4);

create or replace function public.recalcular_ficha_tecnica(p_ficha_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_custo_ing numeric(12,4);
  v_custo_adicional numeric(12,4);
  v_perda_pct numeric(5,2);
  v_rendimento numeric(12,3);
  v_preco_venda numeric(12,2);
  v_produto_id uuid;
  v_unidade_id uuid;
  v_custo_total numeric(12,4);       -- variável (ingredientes + adicionais), já com perda
  v_indice_fixo numeric(6,4);
  v_custo_fixo_rateado numeric(12,4);
  v_custo_total_com_fixo numeric(12,4);
  v_config record;
  v_denominador numeric(6,4);
  v_preco_sugerido numeric(12,4);
begin
  select coalesce(sum(fti.custo_calculado), 0)
    into v_custo_ing
    from public.ficha_tecnica_itens fti
    where fti.ficha_tecnica_id = p_ficha_id;

  select coalesce(custo_embalagem, 0)
       + coalesce((select sum(valor) from public.ficha_tecnica_custos_adicionais where ficha_tecnica_id = p_ficha_id), 0),
       perda_prevista_pct, rendimento, produto_id
    into v_custo_adicional, v_perda_pct, v_rendimento, v_produto_id
    from public.fichas_tecnicas
    where id = p_ficha_id;

  select preco_venda, unidade_id into v_preco_venda, v_unidade_id
    from public.produtos where id = v_produto_id;

  v_custo_total := round((v_custo_ing + v_custo_adicional) * (1 + coalesce(v_perda_pct, 0) / 100.0), 4);

  v_indice_fixo := public.obter_indice_custo_fixo(v_unidade_id);
  v_custo_fixo_rateado := round(v_custo_total * v_indice_fixo / 100.0, 4);
  v_custo_total_com_fixo := v_custo_total + v_custo_fixo_rateado;

  select * into v_config from public.configuracoes_precificacao where unidade_id = v_unidade_id;
  v_denominador := 1 - (coalesce(v_config.percentual_impostos, 0)
                         + coalesce(v_config.percentual_taxas_cartao, 0)
                         + coalesce(v_config.margem_lucro_desejada_pct, 0)) / 100.0;

  v_preco_sugerido := case
    when v_denominador > 0 and coalesce(v_rendimento, 0) > 0
      then round((v_custo_total_com_fixo / v_rendimento) / v_denominador, 2)
    else null
  end;

  update public.fichas_tecnicas
  set
    custo_ingredientes = v_custo_ing,
    custo_adicional = v_custo_adicional,
    custo_total = v_custo_total,
    custo_fixo_rateado = v_custo_fixo_rateado,
    custo_total_com_fixo = v_custo_total_com_fixo,
    custo_por_unidade = case when coalesce(v_rendimento, 0) > 0
      then round(v_custo_total / v_rendimento, 4) else 0 end,
    preco_sugerido = v_preco_sugerido,
    margem_pct = case when coalesce(v_preco_venda, 0) > 0 and coalesce(v_rendimento, 0) > 0
      then round((1 - (v_custo_total_com_fixo / v_rendimento) / v_preco_venda) * 100, 2)
      else null end
  where id = p_ficha_id;
end;
$$;

-- recalcula todas as fichas técnicas da unidade (usado quando custo fixo ou
-- configuração de precificação muda — afeta todo o cardápio de uma vez)
create or replace function public.recalcular_todas_fichas_unidade(p_unidade_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select f.id from public.fichas_tecnicas f
    join public.produtos p on p.id = f.produto_id
    where p.unidade_id = p_unidade_id
  loop
    perform public.recalcular_ficha_tecnica(r.id);
  end loop;
end;
$$;

-- dispara recálculo da ficha quando os custos adicionais mudam
create or replace function public.trg_custo_adicional_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_ficha_tecnica(coalesce(new.ficha_tecnica_id, old.ficha_tecnica_id));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger trg_custo_adicional_aiud
  after insert or update or delete on public.ficha_tecnica_custos_adicionais
  for each row execute function public.trg_custo_adicional_change();

-- dispara recálculo de toda a unidade quando custo fixo ou configuração mudam
create or replace function public.trg_custos_fixos_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_todas_fichas_unidade(coalesce(new.unidade_id, old.unidade_id));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger trg_custos_fixos_aiud
  after insert or update or delete on public.custos_fixos
  for each row execute function public.trg_custos_fixos_change();

create trigger trg_config_precificacao_au
  after insert or update on public.configuracoes_precificacao
  for each row execute function public.trg_custos_fixos_change();


-- =============================================================================
-- 4. PRODUTOS DE REVENDA DIRETA (item pronto: garrafa de açaí, pacote de farinha...)
-- =============================================================================
-- Em vez de criar um caminho de custo/consumo paralelo, um produto de revenda
-- ganha automaticamente uma ficha técnica de 1 item (o próprio ingrediente,
-- quantidade 1, rendimento 1) — assim ele reaproveita toda a lógica que já
-- existe: baixa de estoque na venda, custo médio, precificação com rateio
-- de fixo etc., sem nenhum código especial em outro lugar do sistema.

alter table public.produtos
  add column tipo text not null default 'preparado' check (tipo in ('preparado','revenda')),
  add column ingrediente_revenda_id uuid references public.ingredientes(id),
  add constraint chk_produto_revenda_tem_ingrediente
    check (tipo <> 'revenda' or ingrediente_revenda_id is not null);

comment on column public.produtos.tipo is
  '''preparado'': feito na casa, usa ficha técnica com vários ingredientes. '
  '''revenda'': item comprado pronto e revendido como está (ex.: garrafa de açaí '
  'já pronta, pacote de farinha) — a ficha técnica de 1 item é criada automaticamente.';

create or replace function public.trg_produto_revenda_sincronizar_ficha()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ficha_id uuid;
  v_custo numeric(12,4);
begin
  if new.tipo <> 'revenda' then
    return new;
  end if;

  select id into v_ficha_id from public.fichas_tecnicas where produto_id = new.id;

  if v_ficha_id is null then
    insert into public.fichas_tecnicas (produto_id, rendimento, perda_prevista_pct, custo_embalagem)
    values (new.id, 1, 0, 0)
    returning id into v_ficha_id;
  end if;

  -- garante que a ficha tenha exatamente 1 item: o próprio ingrediente de revenda
  delete from public.ficha_tecnica_itens
    where ficha_tecnica_id = v_ficha_id and ingrediente_id <> new.ingrediente_revenda_id;

  select custo_unitario into v_custo from public.ingredientes where id = new.ingrediente_revenda_id;

  insert into public.ficha_tecnica_itens (ficha_tecnica_id, ingrediente_id, quantidade, custo_calculado)
  values (v_ficha_id, new.ingrediente_revenda_id, 1, coalesce(v_custo, 0))
  on conflict (ficha_tecnica_id, ingrediente_id)
  do update set quantidade = 1, custo_calculado = coalesce(v_custo, 0);

  return new;
end;
$$;

create trigger trg_produto_revenda_aiu
  after insert or update of tipo, ingrediente_revenda_id on public.produtos
  for each row execute function public.trg_produto_revenda_sincronizar_ficha();


-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

alter table public.ficha_tecnica_custos_adicionais enable row level security;
alter table public.custos_fixos enable row level security;
alter table public.configuracoes_precificacao enable row level security;

create policy custos_adicionais_select on public.ficha_tecnica_custos_adicionais for select using (
  exists (
    select 1 from public.fichas_tecnicas f join public.produtos p on p.id = f.produto_id
    where f.id = ficha_tecnica_id and public.user_has_unidade(p.unidade_id)
  )
);
create policy custos_adicionais_write on public.ficha_tecnica_custos_adicionais for all using (
  exists (
    select 1 from public.fichas_tecnicas f join public.produtos p on p.id = f.produto_id
    where f.id = ficha_tecnica_id and public.user_is_gestor(p.unidade_id)
  )
) with check (
  exists (
    select 1 from public.fichas_tecnicas f join public.produtos p on p.id = f.produto_id
    where f.id = ficha_tecnica_id and public.user_is_gestor(p.unidade_id)
  )
);

-- custo fixo e configuração de precificação são informação sensível de margem —
-- só administrador/proprietário/gerente enxergam
create policy custos_fixos_select on public.custos_fixos
  for select using (public.user_is_gestor(unidade_id));
create policy custos_fixos_write on public.custos_fixos for all
  using (public.user_is_gestor(unidade_id)) with check (public.user_is_gestor(unidade_id));

create policy config_precificacao_select on public.configuracoes_precificacao
  for select using (public.user_is_gestor(unidade_id));
create policy config_precificacao_write on public.configuracoes_precificacao for all
  using (public.user_is_gestor(unidade_id)) with check (public.user_is_gestor(unidade_id));
