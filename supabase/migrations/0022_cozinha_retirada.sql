-- =============================================================================
-- Cozinha: pedidos prontos, alerta ao colaborador, retirada e finalizados
-- =============================================================================
-- Rode este arquivo inteiro no SQL Editor do Supabase (pode rodar de novo sem problema).
-- =============================================================================

-- 1. CÓDIGO DA COMANDA (C0123) --------------------------------------------------
alter table public.pdv_pedidos add column if not exists codigo text;

create or replace function public.pdv_pedido_codigo_bi() returns trigger
language plpgsql as $$
begin
  if new.codigo is null then
    new.codigo := 'C' || lpad(new.numero::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_pdv_pedido_codigo_bi on public.pdv_pedidos;
create trigger trg_pdv_pedido_codigo_bi
  before insert on public.pdv_pedidos
  for each row execute function public.pdv_pedido_codigo_bi();

update public.pdv_pedidos set codigo = 'C' || lpad(numero::text, 4, '0') where codigo is null;
create index if not exists idx_pdv_pedidos_codigo on public.pdv_pedidos (codigo);

-- 2. QUEM ENVIOU, ALERTA E RETIRADA (nos itens do pedido) ---------------------
alter table public.pdv_pedido_itens
  add column if not exists enviado_por text,          -- login de quem mandou para a cozinha
  add column if not exists alerta_em timestamptz,     -- quando a cozinha avisou que está pronto
  add column if not exists alerta_por text,           -- quem na cozinha avisou
  add column if not exists retirado_em timestamptz,   -- quando o colaborador retirou
  add column if not exists retirado_por text;         -- quem confirmou a retirada

-- guarda quem enviou no momento em que o item vai para a cozinha
create or replace function public.pdv_item_enviado_por_bu() returns trigger
language plpgsql as $$
begin
  if old.status_cozinha is null and new.status_cozinha is not null and new.enviado_por is null then
    new.enviado_por := auth.jwt() ->> 'email';
  end if;
  return new;
end $$;

drop trigger if exists trg_pdv_item_enviado_por_bu on public.pdv_pedido_itens;
create trigger trg_pdv_item_enviado_por_bu
  before update on public.pdv_pedido_itens
  for each row execute function public.pdv_item_enviado_por_bu();

-- pedidos prontos que esperam retirada, e alertas de cada colaborador
create index if not exists idx_pdv_itens_retirada
  on public.pdv_pedido_itens (status_cozinha, retirado_em)
  where status_cozinha = 'pronto';
create index if not exists idx_pdv_itens_alerta
  on public.pdv_pedido_itens (enviado_por)
  where alerta_em is not null and retirado_em is null;
