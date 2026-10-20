-- =============================================================================
-- Financeiro — contas a pagar e contas a receber
-- =============================================================================
-- O fluxo de caixa e o DRE não têm tabela própria: a tela soma na hora
--   entradas = vendas do PDV (fechadas) + delivery entregue + contas recebidas
--   saídas   = contas pagas
--   CMV      = baixas de estoque ('consumo') x custo unitário do estoque
-- =============================================================================

create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  descricao text not null,
  categoria text not null default 'outros' check (categoria in (
    'fornecedores','aluguel','energia_agua','salarios','impostos',
    'taxas','manutencao','marketing','outros'
  )),
  credor text,                     -- para quem paga (fornecedor, imobiliária...)
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  status text not null default 'aberta' check (status in ('aberta','paga','cancelada')),
  pago_em date,
  forma_pagamento text,
  observacao text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_contas_pagar_unidade_venc
  on public.contas_pagar (unidade_id, vencimento);

create table if not exists public.contas_receber (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  descricao text not null,
  categoria text not null default 'outros' check (categoria in (
    'fiado','evento','convenio','outros'
  )),
  devedor text,                    -- quem deve (cliente, empresa...)
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  status text not null default 'aberta' check (status in ('aberta','recebida','cancelada')),
  recebido_em date,
  forma_pagamento text,
  observacao text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_contas_receber_unidade_venc
  on public.contas_receber (unidade_id, vencimento);
