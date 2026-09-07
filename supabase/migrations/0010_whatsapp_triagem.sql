-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 6.1 — Caixa de Entrada WhatsApp (triagem manual de pedidos recebidos)
-- =============================================================================
-- Pré-requisito: rode depois de schema-pdv-pedidos-mesas.sql (usa 'pedidos').
--
-- Por quê uma tabela separada em vez de criar o pedido direto: a mensagem que
-- chega no WhatsApp nem sempre é um pedido fechado (às vezes é só uma
-- pergunta, ou falta informação) — a triagem existe justamente pra decidir
-- isso antes de virar um pedido de verdade no sistema.
-- =============================================================================


-- =============================================================================
-- 1. TIPOS
-- =============================================================================

create type status_mensagem_whatsapp as enum (
  'nao_atendido','atendido','convertido','descartado'
);


-- =============================================================================
-- 2. CAIXA DE ENTRADA
-- =============================================================================

create table public.mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  telefone text not null,
  nome_cliente text,
  mensagem text not null,             -- texto colado ou resumo do pedido recebido
  status status_mensagem_whatsapp not null default 'nao_atendido',
  atendido_por uuid references public.profiles(id),
  atendido_em timestamptz,
  pedido_id uuid references public.pedidos(id),   -- preenchido só quando convertido
  observacoes text,
  recebido_em timestamptz not null default now()
);

create index idx_mensagens_whatsapp_unidade_status on public.mensagens_whatsapp (unidade_id, status);
create index idx_mensagens_whatsapp_telefone on public.mensagens_whatsapp (telefone);


-- =============================================================================
-- 3. TRIGGERS
-- =============================================================================

-- registra automaticamente quem atendeu e quando, ao sair de 'nao_atendido'
create or replace function public.trg_mensagem_whatsapp_atendida()
returns trigger language plpgsql as $$
begin
  if new.status <> 'nao_atendido' and old.status = 'nao_atendido' then
    new.atendido_por := coalesce(new.atendido_por, auth.uid());
    new.atendido_em := coalesce(new.atendido_em, now());
  end if;

  -- 'convertido' exige o vínculo com um pedido — evita marcar como convertido
  -- sem ter criado o pedido de fato
  if new.status = 'convertido' and new.pedido_id is null then
    raise exception 'Não é possível marcar como convertido sem vincular um pedido_id';
  end if;

  return new;
end;
$$;

create trigger trg_mensagens_whatsapp_bu
  before update on public.mensagens_whatsapp
  for each row execute function public.trg_mensagem_whatsapp_atendida();


-- =============================================================================
-- 4. VIEW — PAINEL DE TRIAGEM (contagem por status, para o badge de pendências)
-- =============================================================================

create or replace view public.vw_whatsapp_pendencias as
select
  unidade_id,
  count(*) filter (where status = 'nao_atendido') as nao_atendidos,
  count(*) filter (where status = 'atendido') as atendidos,
  count(*) filter (where status = 'convertido' and recebido_em::date = current_date) as convertidos_hoje,
  min(recebido_em) filter (where status = 'nao_atendido') as mais_antigo_pendente
from public.mensagens_whatsapp
group by unidade_id;


-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

alter table public.mensagens_whatsapp enable row level security;

create policy mensagens_whatsapp_select on public.mensagens_whatsapp
  for select using (public.user_has_unidade(unidade_id));

create policy mensagens_whatsapp_insert on public.mensagens_whatsapp for insert
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','atendimento','caixa'));

create policy mensagens_whatsapp_update on public.mensagens_whatsapp for update
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','atendimento','caixa'));
