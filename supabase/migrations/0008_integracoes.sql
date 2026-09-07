-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 8 — Integrações Externas (base para iFood, PIX, NF-e, Power BI)
-- =============================================================================
-- Pré-requisito: rode, nesta ordem, os 7 scripts anteriores.
--
-- Diferente das fases anteriores, integração externa não é só schema: cada
-- canal fala com o banco através de uma Edge Function (webhook). Este script
-- cria só o que vive dentro do Postgres — configuração, log e vínculo com
-- pedidos. As Edge Functions (Deno/TypeScript) vêm em arquivos separados.
-- =============================================================================


-- =============================================================================
-- 1. CONFIGURAÇÃO DE INTEGRAÇÕES
-- =============================================================================

create type tipo_integracao as enum ('ifood','whatsapp','pix','nfe','power_bi','outro');

create table public.integracoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tipo tipo_integracao not null,
  ativo boolean not null default false,
  config jsonb not null default '{}',   -- chaves de API, merchant_id, endpoints etc.
  atualizado_em timestamptz not null default now(),
  unique (unidade_id, tipo)
);

comment on column public.integracoes.config is
  'Credenciais e parâmetros específicos do canal. Nunca armazene segredos aqui '
  'em texto puro em produção — use Supabase Vault e guarde só a referência.';

-- log de todo webhook recebido, para depuração e auditoria
create table public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid references public.unidades(id) on delete cascade,
  tipo tipo_integracao not null,
  evento text,
  payload jsonb not null,
  status text not null default 'recebido' check (status in ('recebido','processado','erro')),
  erro_detalhe text,
  criado_em timestamptz not null default now()
);

create index idx_webhook_logs_tipo_status on public.webhook_logs (tipo, status);


-- =============================================================================
-- 2. VÍNCULO DE PEDIDOS COM CANAIS EXTERNOS (iFood etc.)
-- =============================================================================

alter table public.pedidos add column canal_externo_id text;
alter table public.pedidos add column canal_externo_tipo tipo_integracao;

create unique index uq_pedido_canal_externo
  on public.pedidos (unidade_id, canal_externo_tipo, canal_externo_id)
  where canal_externo_id is not null;

comment on column public.pedidos.canal_externo_id is
  'ID do pedido na plataforma externa (ex.: ID do pedido no iFood) — usado para '
  'idempotência: se o webhook chegar duplicado, o pedido não é recriado.';


-- =============================================================================
-- 3. PIX
-- =============================================================================

create type status_pix as enum ('pendente','pago','expirado','cancelado');

create table public.pagamentos_pix (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  txid text not null,                 -- identificador da transação junto ao PSP
  valor numeric(12,2) not null,
  status status_pix not null default 'pendente',
  qr_code text,                       -- payload copia-e-cola ou base64 do QR
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  unique (txid)
);

-- confirmação de pagamento -> quita a conta a receber do pedido automaticamente
create or replace function public.trg_pix_confirmado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pago' and old.status is distinct from 'pago' then
    new.pago_em := coalesce(new.pago_em, now());

    update public.contas_receber
    set status = 'recebida', forma_pagamento = 'pix'
    where pedido_id = new.pedido_id and status = 'aberta';
  end if;
  return new;
end;
$$;

create trigger trg_pagamentos_pix_bu
  before update on public.pagamentos_pix
  for each row execute function public.trg_pix_confirmado();


-- =============================================================================
-- 4. NOTA FISCAL (NF-e / NFC-e)
-- =============================================================================
-- A emissão em si acontece num provedor externo (ex.: Focus NFe, eNotas,
-- PlugNotas) chamado pela Edge Function — aqui só guardamos o resultado.

create type status_nota_fiscal as enum ('pendente','emitida','cancelada','erro');

create table public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id),
  numero text,
  serie text,
  chave_acesso text,
  status status_nota_fiscal not null default 'pendente',
  xml_url text,
  pdf_url text,
  erro_detalhe text,
  emitida_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (pedido_id)
);


-- =============================================================================
-- 5. FUNÇÃO DE APOIO — CRIAR PEDIDO DE DELIVERY (chamada pela Edge Function)
-- =============================================================================
-- Cria pedido + itens + registro de delivery numa única transação (evita
-- pedido incompleto se algo falhar no meio). Recebe os itens já resolvidos
-- pela Edge Function (produto_id já mapeado a partir do SKU externo).

create or replace function public.criar_pedido_delivery(
  p_unidade_id uuid,
  p_canal_externo_id text,
  p_canal_externo_tipo tipo_integracao,
  p_endereco_entrega text,
  p_itens jsonb   -- [{ "produto_id": "...", "quantidade": 1, "preco_unitario": 28.9 }, ...]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_pedido_id uuid;
  v_canal_id uuid;
  item jsonb;
begin
  insert into public.pedidos (unidade_id, canal, status, canal_externo_id, canal_externo_tipo)
  values (p_unidade_id, 'delivery', 'confirmado', p_canal_externo_id, p_canal_externo_tipo)
  returning id into v_pedido_id;

  for item in select * from jsonb_array_elements(p_itens)
  loop
    insert into public.pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
    values (
      v_pedido_id,
      (item->>'produto_id')::uuid,
      (item->>'quantidade')::numeric,
      (item->>'preco_unitario')::numeric
    );
  end loop;

  select id into v_canal_id from public.delivery_canais
    where unidade_id = p_unidade_id and nome = p_canal_externo_tipo::text;

  if v_canal_id is null then
    insert into public.delivery_canais (unidade_id, nome, comissao_percentual)
    values (p_unidade_id, p_canal_externo_tipo::text, 0)
    returning id into v_canal_id;
  end if;

  insert into public.delivery_pedidos (pedido_id, canal_id, endereco_entrega)
  values (v_pedido_id, v_canal_id, p_endereco_entrega);

  return v_pedido_id;
end;
$$;


-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

alter table public.integracoes enable row level security;
alter table public.webhook_logs enable row level security;
alter table public.pagamentos_pix enable row level security;
alter table public.notas_fiscais enable row level security;

-- configuração de integrações: só administrador/proprietário mexem
create policy integracoes_select on public.integracoes for select
  using (public.user_papel(unidade_id) in ('administrador','proprietario'));
create policy integracoes_write on public.integracoes for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario'));

-- logs de webhook: leitura para quem gere a unidade; escrita só via Edge
-- Function, que usa a service_role key (bypassa RLS) — sem policy de insert aqui
create policy webhook_logs_select on public.webhook_logs for select
  using (unidade_id is null or public.user_is_gestor(unidade_id));

create policy pagamentos_pix_select on public.pagamentos_pix for select using (
  exists (select 1 from public.pedidos p where p.id = pedido_id and public.user_has_unidade(p.unidade_id))
);

create policy notas_fiscais_select on public.notas_fiscais for select using (
  exists (select 1 from public.pedidos p where p.id = pedido_id and public.user_has_unidade(p.unidade_id))
);
