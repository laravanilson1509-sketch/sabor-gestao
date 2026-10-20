-- =============================================================================
-- Cozinha (KDS) — status de produção para os pedidos do PDV e do delivery
-- =============================================================================
-- PDV: cada item ganha status_cozinha. null = ainda não enviado (o atendente
-- clica em "Enviar para a cozinha"). Delivery: pedidos novos entram como 'novo'.
-- =============================================================================

-- 1. ITENS DO PDV -------------------------------------------------------------
alter table public.pdv_pedido_itens
  add column if not exists status_cozinha text
    check (status_cozinha in ('novo','preparando','pronto')),
  add column if not exists enviado_cozinha_em timestamptz,
  add column if not exists iniciado_em timestamptz,
  add column if not exists pronto_em timestamptz;

create index if not exists idx_pdv_itens_status_cozinha
  on public.pdv_pedido_itens (status_cozinha)
  where status_cozinha is not null;


-- 2. PEDIDOS DO DELIVERY ------------------------------------------------------
-- a coluna entra sem default para não jogar pedidos antigos na cozinha
alter table public.pedidos_delivery
  add column if not exists status_cozinha text
    check (status_cozinha in ('novo','preparando','pronto')),
  add column if not exists iniciado_em timestamptz,
  add column if not exists pronto_em timestamptz;

-- só os pedidos ainda em andamento vão para a cozinha
update public.pedidos_delivery
  set status_cozinha = case status when 'novo' then 'novo' else 'preparando' end
  where status in ('novo','em_preparo') and status_cozinha is null;

-- daqui pra frente, todo pedido novo do delivery já chega na cozinha
alter table public.pedidos_delivery
  alter column status_cozinha set default 'novo';

create index if not exists idx_pedidos_delivery_status_cozinha
  on public.pedidos_delivery (status_cozinha)
  where status_cozinha is not null;


-- 3. HORÁRIOS AUTOMÁTICOS -----------------------------------------------------
create or replace function public.trg_status_cozinha_timestamps()
returns trigger language plpgsql as $$
begin
  if new.status_cozinha = 'preparando' and old.status_cozinha is distinct from 'preparando' then
    new.iniciado_em := coalesce(new.iniciado_em, now());
  end if;
  if new.status_cozinha = 'pronto' and old.status_cozinha is distinct from 'pronto' then
    new.pronto_em := coalesce(new.pronto_em, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pdv_itens_cozinha_bu on public.pdv_pedido_itens;
create trigger trg_pdv_itens_cozinha_bu
  before update of status_cozinha on public.pdv_pedido_itens
  for each row execute function public.trg_status_cozinha_timestamps();

drop trigger if exists trg_pedidos_delivery_cozinha_bu on public.pedidos_delivery;
create trigger trg_pedidos_delivery_cozinha_bu
  before update of status_cozinha on public.pedidos_delivery
  for each row execute function public.trg_status_cozinha_timestamps();
