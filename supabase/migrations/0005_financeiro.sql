-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 5 — Financeiro (contas a pagar/receber, fluxo de caixa, DRE)
-- =============================================================================
-- Pré-requisito: rode, nesta ordem:
--   1. schema-fichas-tecnicas-estoque.sql
--   2. schema-pdv-pedidos-mesas.sql
--   3. schema-cozinha-kds.sql
--   4. schema-compras.sql
--
-- Integrações automáticas construídas aqui:
--   - Pedido de compra aprovado  -> gera conta a pagar
--   - Pedido de venda entregue   -> gera conta a receber já quitada
--   - Conta paga/recebida        -> lança no fluxo de caixa
--   - Consumo de estoque (venda) -> passa a registrar custo, alimentando o CMV do DRE
-- =============================================================================


-- =============================================================================
-- 1. CATEGORIAS FINANCEIRAS
-- =============================================================================

create type tipo_categoria_financeira as enum ('receita','despesa');
create type natureza_despesa as enum ('operacional','administrativa','financeira');

create table public.categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tipo tipo_categoria_financeira not null,
  natureza natureza_despesa,          -- só se aplica quando tipo = 'despesa'
  nome text not null,
  created_at timestamptz not null default now(),
  unique (unidade_id, tipo, nome)
);

comment on column public.categorias_financeiras.natureza is
  'Classifica a despesa para o DRE: operacional (CMV/produção), administrativa (aluguel, salários...) ou financeira (juros, taxas de cartão).';


-- =============================================================================
-- 2. CONTAS A PAGAR / A RECEBER
-- =============================================================================

create type status_conta as enum ('aberta','paga','vencida','cancelada');

create table public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  categoria_id uuid not null references public.categorias_financeiras(id),
  fornecedor_id uuid references public.fornecedores(id),
  pedido_compra_id uuid references public.pedidos_compra(id),
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  data_emissao date not null default current_date,
  data_vencimento date not null,
  data_pagamento date,
  forma_pagamento forma_pagamento,
  status status_conta not null default 'aberta',
  criado_por uuid references public.profiles(id) default auth.uid(),
  criado_em timestamptz not null default now()
);

create table public.contas_receber (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  categoria_id uuid not null references public.categorias_financeiras(id),
  pedido_id uuid references public.pedidos(id),
  descricao text not null,
  valor numeric(12,2) not null check (valor > 0),
  data_emissao date not null default current_date,
  data_vencimento date not null,
  data_recebimento date,
  forma_pagamento forma_pagamento,
  status status_conta not null default 'aberta',
  criado_em timestamptz not null default now()
);

create index idx_contas_pagar_unidade_status on public.contas_pagar (unidade_id, status);
create index idx_contas_receber_unidade_status on public.contas_receber (unidade_id, status);


-- =============================================================================
-- 3. FLUXO DE CAIXA (livro-razão financeiro, mais amplo que o caixa do PDV)
-- =============================================================================

create type tipo_fluxo as enum ('entrada','saida');

create table public.fluxo_caixa (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tipo tipo_fluxo not null,
  origem text not null,               -- 'conta_pagar', 'conta_receber', 'sangria', 'suprimento', 'transferencia'
  valor numeric(12,2) not null,
  data_movimento date not null default current_date,
  referencia_tipo text,               -- ex.: 'contas_pagar', 'contas_receber'
  referencia_id uuid,
  descricao text,
  criado_em timestamptz not null default now()
);

create index idx_fluxo_caixa_unidade_data on public.fluxo_caixa (unidade_id, data_movimento);

-- fluxo de caixa também é histórico imutável
create trigger trg_fluxo_caixa_bloqueio
  before update or delete on public.fluxo_caixa
  for each row execute function public.bloquear_alteracao();


-- =============================================================================
-- 4. TRIGGERS — QUITAÇÃO GERA LANÇAMENTO NO FLUXO DE CAIXA
-- =============================================================================

-- 4.1 contas a pagar -----------------------------------------------------------
create or replace function public.trg_conta_pagar_before()
returns trigger language plpgsql as $$
begin
  if new.status = 'paga' and old.status is distinct from 'paga' and new.data_pagamento is null then
    new.data_pagamento := current_date;
  end if;
  return new;
end;
$$;

create trigger trg_contas_pagar_bu
  before update on public.contas_pagar
  for each row execute function public.trg_conta_pagar_before();

create or replace function public.trg_conta_pagar_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paga' and old.status is distinct from 'paga' then
    insert into public.fluxo_caixa
      (unidade_id, tipo, origem, valor, data_movimento, referencia_tipo, referencia_id, descricao)
    values
      (new.unidade_id, 'saida', 'conta_pagar', new.valor, coalesce(new.data_pagamento, current_date),
       'contas_pagar', new.id, new.descricao);
  end if;
  return new;
end;
$$;

create trigger trg_contas_pagar_au
  after update on public.contas_pagar
  for each row execute function public.trg_conta_pagar_after();

-- 4.2 contas a receber ----------------------------------------------------------
create or replace function public.trg_conta_receber_before()
returns trigger language plpgsql as $$
begin
  if new.status = 'recebida' and old.status is distinct from 'recebida' and new.data_recebimento is null then
    new.data_recebimento := current_date;
  end if;
  return new;
end;
$$;

create trigger trg_contas_receber_bu
  before update on public.contas_receber
  for each row execute function public.trg_conta_receber_before();

create or replace function public.trg_conta_receber_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'recebida' and old.status is distinct from 'recebida' then
    insert into public.fluxo_caixa
      (unidade_id, tipo, origem, valor, data_movimento, referencia_tipo, referencia_id, descricao)
    values
      (new.unidade_id, 'entrada', 'conta_receber', new.valor, coalesce(new.data_recebimento, current_date),
       'contas_receber', new.id, new.descricao);
  end if;
  return new;
end;
$$;

create trigger trg_contas_receber_au
  after update on public.contas_receber
  for each row execute function public.trg_conta_receber_after();


-- =============================================================================
-- 5. INTEGRAÇÕES AUTOMÁTICAS COM COMPRAS E VENDAS
-- =============================================================================

-- helper: garante que a categoria financeira padrão existe, criando se preciso
create or replace function public.obter_categoria_financeira(
  p_unidade_id uuid, p_tipo tipo_categoria_financeira, p_nome text, p_natureza natureza_despesa default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.categorias_financeiras
    where unidade_id = p_unidade_id and tipo = p_tipo and nome = p_nome;

  if v_id is null then
    insert into public.categorias_financeiras (unidade_id, tipo, nome, natureza)
    values (p_unidade_id, p_tipo, p_nome, p_natureza)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- 5.1 pedido de compra aprovado -> conta a pagar --------------------------------
create or replace function public.trg_pedido_compra_gerar_conta_pagar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_categoria_id uuid;
begin
  if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    v_categoria_id := public.obter_categoria_financeira(new.unidade_id, 'despesa', 'Fornecedores', 'operacional');

    insert into public.contas_pagar
      (unidade_id, categoria_id, fornecedor_id, pedido_compra_id, descricao, valor, data_emissao, data_vencimento)
    values
      (new.unidade_id, v_categoria_id, new.fornecedor_id, new.id,
       'Pedido de compra #' || new.numero, new.valor_total, current_date,
       coalesce(new.previsao_entrega, current_date + 30));
  end if;
  return new;
end;
$$;

create trigger trg_pedido_compra_status_financeiro
  after update of status on public.pedidos_compra
  for each row execute function public.trg_pedido_compra_gerar_conta_pagar();

-- 5.2 pedido de venda entregue -> conta a receber já quitada --------------------
-- (venda de balcão/PDV é liquidada na hora; delivery/faturado pode ficar 'aberta'
-- e ser baixada depois — aqui cobrimos o caso padrão de recebimento imediato)
create or replace function public.trg_pedido_gerar_conta_receber()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_categoria_id uuid;
begin
  if new.status = 'entregue' and old.status is distinct from 'entregue' then
    v_categoria_id := public.obter_categoria_financeira(new.unidade_id, 'receita', 'Vendas');

    insert into public.contas_receber
      (unidade_id, categoria_id, pedido_id, descricao, valor,
       data_emissao, data_vencimento, data_recebimento, forma_pagamento, status)
    values
      (new.unidade_id, v_categoria_id, new.id, 'Pedido #' || new.numero, new.total,
       current_date, current_date, current_date, new.forma_pagamento, 'recebida');
  end if;
  return new;
end;
$$;

create trigger trg_pedido_status_financeiro
  after update of status on public.pedidos
  for each row execute function public.trg_pedido_gerar_conta_receber();

-- 5.3 registrar o custo no consumo de estoque, para o CMV do DRE ---------------
-- Substitui a versão da Fase 2: agora grava o custo_unitario vigente do
-- ingrediente em cada baixa por venda, sem mudar o restante do comportamento.
create or replace function public.baixar_estoque_pedido(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_unidade_id uuid;
  v_ja_baixado boolean;
  v_numero bigint;
  item record;
  ficha record;
  ing record;
  v_qtd_consumo numeric(12,4);
  v_custo_atual numeric(12,4);
begin
  select unidade_id, estoque_baixado, numero
    into v_unidade_id, v_ja_baixado, v_numero
    from public.pedidos where id = p_pedido_id
    for update;

  if v_ja_baixado then
    return;
  end if;

  for item in
    select produto_id, quantidade from public.pedido_itens where pedido_id = p_pedido_id
  loop
    select id, rendimento into ficha
      from public.fichas_tecnicas where produto_id = item.produto_id;

    if ficha.id is null then
      continue;
    end if;

    for ing in
      select ingrediente_id, quantidade as qtd_ficha
      from public.ficha_tecnica_itens
      where ficha_tecnica_id = ficha.id
    loop
      v_qtd_consumo := round(item.quantidade * (ing.qtd_ficha / nullif(ficha.rendimento, 0)), 4);
      select custo_unitario into v_custo_atual from public.ingredientes where id = ing.ingrediente_id;

      if v_qtd_consumo is not null and v_qtd_consumo > 0 then
        insert into public.movimentacoes_estoque
          (unidade_id, ingrediente_id, tipo, quantidade, custo_unitario, motivo, documento_referencia)
        values
          (v_unidade_id, ing.ingrediente_id, 'consumo_producao', v_qtd_consumo, v_custo_atual,
           'Baixa automática — venda', 'Pedido #' || v_numero);
      end if;
    end loop;
  end loop;

  update public.pedidos set estoque_baixado = true where id = p_pedido_id;
end;
$$;


-- =============================================================================
-- 6. VIEWS — FLUXO DE CAIXA E DRE
-- =============================================================================

create or replace view public.vw_fluxo_caixa_diario as
select
  unidade_id,
  data_movimento,
  sum(valor) filter (where tipo = 'entrada') as entradas,
  sum(valor) filter (where tipo = 'saida') as saidas,
  sum(valor) filter (where tipo = 'entrada') - sum(valor) filter (where tipo = 'saida') as saldo_dia
from public.fluxo_caixa
group by unidade_id, data_movimento;

create or replace view public.vw_dre_mensal as
with faturamento as (
  select unidade_id, date_trunc('month', data_recebimento) as mes, sum(valor) as valor
  from public.contas_receber
  where status = 'recebida'
  group by 1, 2
),
cmv as (
  select unidade_id, date_trunc('month', criado_em) as mes,
         sum(quantidade * coalesce(custo_unitario, 0)) as valor
  from public.movimentacoes_estoque
  where tipo = 'consumo_producao'
  group by 1, 2
),
despesas as (
  select unidade_id, date_trunc('month', data_pagamento) as mes, cf.natureza,
         sum(cp.valor) as valor
  from public.contas_pagar cp
  join public.categorias_financeiras cf on cf.id = cp.categoria_id
  where cp.status = 'paga'
  group by 1, 2, 3
)
select
  coalesce(f.unidade_id, c.unidade_id) as unidade_id,
  coalesce(f.mes, c.mes) as mes,
  coalesce(f.valor, 0) as faturamento,
  coalesce(c.valor, 0) as cmv,
  coalesce((select valor from despesas d where d.unidade_id = coalesce(f.unidade_id, c.unidade_id)
            and d.mes = coalesce(f.mes, c.mes) and d.natureza = 'operacional'), 0) as despesas_operacionais,
  coalesce((select valor from despesas d where d.unidade_id = coalesce(f.unidade_id, c.unidade_id)
            and d.mes = coalesce(f.mes, c.mes) and d.natureza = 'administrativa'), 0) as despesas_administrativas,
  coalesce((select valor from despesas d where d.unidade_id = coalesce(f.unidade_id, c.unidade_id)
            and d.mes = coalesce(f.mes, c.mes) and d.natureza = 'financeira'), 0) as despesas_financeiras,
  coalesce(f.valor, 0) - coalesce(c.valor, 0)
    - coalesce((select valor from despesas d where d.unidade_id = coalesce(f.unidade_id, c.unidade_id)
                and d.mes = coalesce(f.mes, c.mes) and d.natureza = 'operacional'), 0) as lucro_operacional,
  coalesce(f.valor, 0) - coalesce(c.valor, 0)
    - coalesce((select sum(valor) from despesas d where d.unidade_id = coalesce(f.unidade_id, c.unidade_id)
                and d.mes = coalesce(f.mes, c.mes)), 0) as lucro_liquido,
  case when coalesce(f.valor, 0) > 0 then
    round((
      (coalesce(f.valor, 0) - coalesce(c.valor, 0)
        - coalesce((select sum(valor) from despesas d where d.unidade_id = coalesce(f.unidade_id, c.unidade_id)
                    and d.mes = coalesce(f.mes, c.mes)), 0)
      ) / f.valor) * 100, 2)
  else null end as margem_liquida_pct
from faturamento f
full outer join cmv c on c.unidade_id = f.unidade_id and c.mes = f.mes;


-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

alter table public.categorias_financeiras enable row level security;
alter table public.contas_pagar enable row level security;
alter table public.contas_receber enable row level security;
alter table public.fluxo_caixa enable row level security;

-- acesso ao módulo financeiro fica restrito a papéis financeiros/gestores
-- (reflete a permissão "acessar informações financeiras" do requisito)

create policy categorias_financeiras_select on public.categorias_financeiras
  for select using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'));
create policy categorias_financeiras_write on public.categorias_financeiras for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'));

create policy contas_pagar_select on public.contas_pagar
  for select using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'));
create policy contas_pagar_write on public.contas_pagar for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'));

create policy contas_receber_select on public.contas_receber
  for select using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'));
create policy contas_receber_write on public.contas_receber for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'));

create policy fluxo_caixa_select on public.fluxo_caixa
  for select using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','financeiro'));
-- sem policy de insert direta: só os triggers (SECURITY DEFINER) escrevem aqui
