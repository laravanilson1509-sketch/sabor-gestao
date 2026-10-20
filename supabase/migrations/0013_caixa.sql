-- =============================================================================
-- Caixa — abertura, sangria/suprimento e fechamento com conferência
-- =============================================================================
-- As vendas não ficam presas ao caixa: o caixa soma os pedidos do PDV
-- (fechado_em) e do delivery entregue (criado_em) entre a abertura e o fechamento.
-- =============================================================================

create table if not exists public.pdv_caixas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  saldo_inicial numeric(12,2) not null default 0,
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz,
  valor_esperado numeric(12,2),   -- dinheiro que deveria estar na gaveta
  valor_contado numeric(12,2),    -- dinheiro contado no fechamento
  observacao text
);

-- só um caixa aberto por unidade
create unique index if not exists uq_pdv_caixa_aberto
  on public.pdv_caixas (unidade_id)
  where status = 'aberto';

create table if not exists public.pdv_caixa_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.pdv_caixas(id) on delete cascade,
  tipo text not null check (tipo in ('sangria','suprimento')),
  valor numeric(12,2) not null check (valor > 0),
  descricao text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pdv_caixa_mov_caixa
  on public.pdv_caixa_movimentacoes (caixa_id);
