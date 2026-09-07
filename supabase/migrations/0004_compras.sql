-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 4 — Compras
-- =============================================================================
-- Pré-requisito: rode, nesta ordem:
--   1. schema-fichas-tecnicas-estoque.sql
--   2. schema-pdv-pedidos-mesas.sql
--   3. schema-cozinha-kds.sql
-- Reutiliza: unidades, profiles, papel_usuario, ingredientes, fornecedores,
-- lotes, movimentacoes_estoque (e o trigger de custo médio já existente).
--
-- Fluxo implementado:
--   Necessidade -> Solicitação -> Cotação -> Aprovação -> Pedido de compra
--   -> Recebimento -> Conferência -> Entrada automática no estoque
-- =============================================================================


-- =============================================================================
-- 1. TIPOS
-- =============================================================================

create type status_solicitacao as enum (
  'aberta','cotando','aprovada','rejeitada','convertida','cancelada'
);
create type status_cotacao as enum ('pendente','recebida','selecionada','recusada');
create type status_pedido_compra as enum (
  'rascunho','aprovado','enviado','parcialmente_recebido','recebido','cancelado'
);


-- =============================================================================
-- 2. SOLICITAÇÃO DE COMPRA (a necessidade)
-- =============================================================================

create table public.solicitacoes_compra (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  solicitante_id uuid references public.profiles(id) default auth.uid(),
  status status_solicitacao not null default 'aberta',
  motivo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.solicitacao_compra_itens (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_compra(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id),
  quantidade numeric(12,3) not null check (quantidade > 0),  -- na unidade de compra do ingrediente
  observacoes text
);


-- =============================================================================
-- 3. COTAÇÃO (comparação entre fornecedores)
-- =============================================================================

create table public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_compra(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id),
  status status_cotacao not null default 'pendente',
  condicoes_pagamento text,
  prazo_entrega_dias int,
  validade_proposta date,
  criado_em timestamptz not null default now(),
  unique (solicitacao_id, fornecedor_id)
);

create table public.cotacao_itens (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id),
  quantidade numeric(12,3) not null,
  preco_unitario numeric(12,4) not null,     -- por unidade de compra
  unique (cotacao_id, ingrediente_id)
);

-- comparativo pronto para a tela de "comparação de fornecedores"
create or replace view public.vw_cotacoes_comparativo as
select
  ci.ingrediente_id,
  i.nome as ingrediente,
  c.solicitacao_id,
  f.id as fornecedor_id,
  f.nome_fantasia as fornecedor,
  ci.quantidade,
  ci.preco_unitario,
  ci.quantidade * ci.preco_unitario as valor_total,
  c.prazo_entrega_dias,
  c.condicoes_pagamento,
  rank() over (
    partition by ci.ingrediente_id, c.solicitacao_id
    order by ci.preco_unitario asc
  ) as posicao_preco
from public.cotacao_itens ci
join public.cotacoes c on c.id = ci.cotacao_id
join public.fornecedores f on f.id = c.fornecedor_id
join public.ingredientes i on i.id = ci.ingrediente_id;


-- =============================================================================
-- 4. PEDIDO DE COMPRA (aprovado, pronto para enviar ao fornecedor)
-- =============================================================================

create table public.pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  numero bigint generated always as identity,
  solicitacao_id uuid references public.solicitacoes_compra(id),
  cotacao_id uuid references public.cotacoes(id),
  fornecedor_id uuid not null references public.fornecedores(id),
  status status_pedido_compra not null default 'rascunho',
  data_pedido date not null default current_date,
  previsao_entrega date,
  condicoes_pagamento text,
  valor_total numeric(12,2) not null default 0,
  aprovado_por uuid references public.profiles(id),
  aprovado_em timestamptz,
  criado_por uuid references public.profiles(id) default auth.uid(),
  criado_em timestamptz not null default now()
);

create table public.pedido_compra_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_compra_id uuid not null references public.pedidos_compra(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id),
  quantidade_pedida numeric(12,3) not null check (quantidade_pedida > 0),  -- unidade de compra
  quantidade_recebida numeric(12,3) not null default 0,                    -- unidade de compra
  preco_unitario numeric(12,4) not null,                                   -- por unidade de compra
  unique (pedido_compra_id, ingrediente_id)
);

-- 4.1 Recalcular valor_total do pedido de compra
create or replace function public.recalcular_pedido_compra(p_pedido_compra_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.pedidos_compra
  set valor_total = (
    select coalesce(sum(quantidade_pedida * preco_unitario), 0)
    from public.pedido_compra_itens
    where pedido_compra_id = p_pedido_compra_id
  )
  where id = p_pedido_compra_id;
end;
$$;

create or replace function public.trg_pedido_compra_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_pedido_compra(coalesce(new.pedido_compra_id, old.pedido_compra_id));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger trg_pedido_compra_item_aiud
  after insert or update or delete on public.pedido_compra_itens
  for each row execute function public.trg_pedido_compra_item_change();


-- =============================================================================
-- 5. RECEBIMENTO / CONFERÊNCIA (gera entrada automática no estoque)
-- =============================================================================

create table public.recebimentos_compra (
  id uuid primary key default gen_random_uuid(),
  pedido_compra_id uuid not null references public.pedidos_compra(id) on delete cascade,
  numero_nota_fiscal text,
  recebido_por uuid references public.profiles(id) default auth.uid(),
  recebido_em timestamptz not null default now(),
  observacoes text
);

create table public.recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.recebimentos_compra(id) on delete cascade,
  pedido_compra_item_id uuid not null references public.pedido_compra_itens(id),
  quantidade_recebida numeric(12,3) not null check (quantidade_recebida > 0), -- unidade de compra
  custo_unitario numeric(12,4) not null,                                      -- por unidade de compra
  numero_lote text,
  data_validade date
);

-- 5.1 Ao registrar um item recebido: cria lote + movimentação de entrada
-- (que por sua vez já dispara o recálculo de custo médio e de fichas técnicas
-- criado na Fase 1) e atualiza a quantidade recebida do pedido de compra.

create or replace function public.trg_recebimento_item_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ingrediente_id uuid;
  v_unidade_id uuid;
  v_fornecedor_id uuid;
  v_pedido_compra_id uuid;
  v_fator numeric(12,4);
  v_qtd_consumo numeric(12,4);
  v_custo_unitario_consumo numeric(12,4);
  v_lote_id uuid;
  v_pedido_numero bigint;
  v_total_pedido numeric(12,3);
  v_total_recebido numeric(12,3);
begin
  select pci.ingrediente_id, pc.unidade_id, pc.fornecedor_id, pc.id, pc.numero
    into v_ingrediente_id, v_unidade_id, v_fornecedor_id, v_pedido_compra_id, v_pedido_numero
    from public.pedido_compra_itens pci
    join public.pedidos_compra pc on pc.id = pci.pedido_compra_id
    where pci.id = new.pedido_compra_item_id;

  select fator_conversao into v_fator from public.ingredientes where id = v_ingrediente_id;

  v_qtd_consumo := round(new.quantidade_recebida * coalesce(v_fator, 1), 4);
  v_custo_unitario_consumo := round(new.custo_unitario / coalesce(nullif(v_fator, 0), 1), 4);

  -- cria o lote (na unidade de consumo, para bater com estoque_saldo/movimentações)
  insert into public.lotes
    (unidade_id, ingrediente_id, numero_lote, data_validade,
     quantidade_inicial, quantidade_atual, custo_unitario, fornecedor_id, status)
  values
    (v_unidade_id, v_ingrediente_id, new.numero_lote, new.data_validade,
     v_qtd_consumo, v_qtd_consumo, v_custo_unitario_consumo, v_fornecedor_id, 'ativo')
  returning id into v_lote_id;

  -- lança a movimentação de entrada -> dispara trg_movimentacao_estoque
  -- (atualiza saldo, custo médio, custo do ingrediente e, em cascata, as fichas técnicas)
  insert into public.movimentacoes_estoque
    (unidade_id, ingrediente_id, lote_id, tipo, quantidade, custo_unitario, documento_referencia)
  values
    (v_unidade_id, v_ingrediente_id, v_lote_id, 'entrada', v_qtd_consumo, v_custo_unitario_consumo,
     'Pedido de compra #' || v_pedido_numero);

  -- atualiza a quantidade recebida do item do pedido de compra
  update public.pedido_compra_itens
  set quantidade_recebida = quantidade_recebida + new.quantidade_recebida
  where id = new.pedido_compra_item_id;

  -- atualiza o status do pedido de compra (parcial x total)
  select sum(quantidade_pedida), sum(quantidade_recebida)
    into v_total_pedido, v_total_recebido
    from public.pedido_compra_itens
    where pedido_compra_id = v_pedido_compra_id;

  update public.pedidos_compra
  set status = case
    when v_total_recebido >= v_total_pedido then 'recebido'
    else 'parcialmente_recebido'
  end
  where id = v_pedido_compra_id;

  return new;
end;
$$;

create trigger trg_recebimento_item_ai
  after insert on public.recebimento_itens
  for each row execute function public.trg_recebimento_item_insert();

-- recebimento é histórico imutável, como as movimentações de estoque
create trigger trg_recebimento_item_bloqueio
  before update or delete on public.recebimento_itens
  for each row execute function public.bloquear_alteracao();


-- =============================================================================
-- 6. VIEWS DE APOIO
-- =============================================================================

create or replace view public.vw_pedidos_compra_pendentes as
select
  pc.id, pc.unidade_id, pc.numero, pc.fornecedor_id, f.nome_fantasia as fornecedor,
  pc.status, pc.data_pedido, pc.previsao_entrega, pc.valor_total,
  (pc.previsao_entrega < current_date and pc.status in ('aprovado','enviado','parcialmente_recebido')) as atrasado
from public.pedidos_compra pc
join public.fornecedores f on f.id = pc.fornecedor_id
where pc.status not in ('recebido','cancelado');


-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

alter table public.solicitacoes_compra enable row level security;
alter table public.solicitacao_compra_itens enable row level security;
alter table public.cotacoes enable row level security;
alter table public.cotacao_itens enable row level security;
alter table public.pedidos_compra enable row level security;
alter table public.pedido_compra_itens enable row level security;
alter table public.recebimentos_compra enable row level security;
alter table public.recebimento_itens enable row level security;

-- papéis com acesso de escrita ao módulo de compras
-- (administrador, proprietario, gerente, compras — mesmo padrão usado em fornecedores)

create policy solicitacoes_select on public.solicitacoes_compra
  for select using (public.user_has_unidade(unidade_id));
create policy solicitacoes_write on public.solicitacoes_compra for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','compras','estoque'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','compras','estoque'));

create policy solicitacao_itens_select on public.solicitacao_compra_itens for select using (
  exists (select 1 from public.solicitacoes_compra s where s.id = solicitacao_id and public.user_has_unidade(s.unidade_id))
);
create policy solicitacao_itens_write on public.solicitacao_compra_itens for all using (
  exists (
    select 1 from public.solicitacoes_compra s where s.id = solicitacao_id
      and public.user_papel(s.unidade_id) in ('administrador','proprietario','gerente','compras','estoque')
  )
) with check (
  exists (
    select 1 from public.solicitacoes_compra s where s.id = solicitacao_id
      and public.user_papel(s.unidade_id) in ('administrador','proprietario','gerente','compras','estoque')
  )
);

create policy cotacoes_select on public.cotacoes for select using (
  exists (select 1 from public.solicitacoes_compra s where s.id = solicitacao_id and public.user_has_unidade(s.unidade_id))
);
create policy cotacoes_write on public.cotacoes for all using (
  exists (
    select 1 from public.solicitacoes_compra s where s.id = solicitacao_id
      and public.user_papel(s.unidade_id) in ('administrador','proprietario','gerente','compras')
  )
) with check (
  exists (
    select 1 from public.solicitacoes_compra s where s.id = solicitacao_id
      and public.user_papel(s.unidade_id) in ('administrador','proprietario','gerente','compras')
  )
);

create policy cotacao_itens_select on public.cotacao_itens for select using (
  exists (
    select 1 from public.cotacoes c join public.solicitacoes_compra s on s.id = c.solicitacao_id
    where c.id = cotacao_id and public.user_has_unidade(s.unidade_id)
  )
);
create policy cotacao_itens_write on public.cotacao_itens for all using (
  exists (
    select 1 from public.cotacoes c join public.solicitacoes_compra s on s.id = c.solicitacao_id
    where c.id = cotacao_id and public.user_papel(s.unidade_id) in ('administrador','proprietario','gerente','compras')
  )
) with check (
  exists (
    select 1 from public.cotacoes c join public.solicitacoes_compra s on s.id = c.solicitacao_id
    where c.id = cotacao_id and public.user_papel(s.unidade_id) in ('administrador','proprietario','gerente','compras')
  )
);

create policy pedidos_compra_select on public.pedidos_compra
  for select using (public.user_has_unidade(unidade_id));
create policy pedidos_compra_insert on public.pedidos_compra for insert
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','compras'));
create policy pedidos_compra_update on public.pedidos_compra for update
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','compras'));
-- aprovação fica restrita a quem gere a unidade (gerente para cima)
create policy pedidos_compra_aprovar on public.pedidos_compra for update
  using (public.user_is_gestor(unidade_id));

create policy pedido_compra_itens_select on public.pedido_compra_itens for select using (
  exists (select 1 from public.pedidos_compra pc where pc.id = pedido_compra_id and public.user_has_unidade(pc.unidade_id))
);
create policy pedido_compra_itens_write on public.pedido_compra_itens for all using (
  exists (
    select 1 from public.pedidos_compra pc where pc.id = pedido_compra_id
      and public.user_papel(pc.unidade_id) in ('administrador','proprietario','gerente','compras')
  )
) with check (
  exists (
    select 1 from public.pedidos_compra pc where pc.id = pedido_compra_id
      and public.user_papel(pc.unidade_id) in ('administrador','proprietario','gerente','compras')
  )
);

create policy recebimentos_select on public.recebimentos_compra for select using (
  exists (select 1 from public.pedidos_compra pc where pc.id = pedido_compra_id and public.user_has_unidade(pc.unidade_id))
);
create policy recebimentos_insert on public.recebimentos_compra for insert with check (
  exists (
    select 1 from public.pedidos_compra pc where pc.id = pedido_compra_id
      and public.user_papel(pc.unidade_id) in ('administrador','proprietario','gerente','compras','estoque')
  )
);

create policy recebimento_itens_select on public.recebimento_itens for select using (
  exists (
    select 1 from public.recebimentos_compra r join public.pedidos_compra pc on pc.id = r.pedido_compra_id
    where r.id = recebimento_id and public.user_has_unidade(pc.unidade_id)
  )
);
create policy recebimento_itens_insert on public.recebimento_itens for insert with check (
  exists (
    select 1 from public.recebimentos_compra r join public.pedidos_compra pc on pc.id = r.pedido_compra_id
    where r.id = recebimento_id
      and public.user_papel(pc.unidade_id) in ('administrador','proprietario','gerente','compras','estoque')
  )
);
