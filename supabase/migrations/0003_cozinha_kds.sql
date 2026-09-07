-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 3 — Cozinha / KDS
-- =============================================================================
-- Pré-requisito: rode, nesta ordem:
--   1. schema-fichas-tecnicas-estoque.sql
--   2. schema-pdv-pedidos-mesas.sql
-- Este script estende public.pedido_itens (já criada na Fase 2) em vez de criar
-- uma tabela nova — o "ticket" da cozinha é o próprio pedido, e cada item
-- carrega seu progresso de produção. Isso evita duplicar dados entre PDV e KDS.
-- =============================================================================


-- =============================================================================
-- 1. EXTENSÃO DE pedido_itens PARA CONTROLE DE PRODUÇÃO
-- =============================================================================

create type status_producao_item as enum ('fila','preparo','pronto');

alter table public.pedido_itens
  add column status_producao status_producao_item not null default 'fila',
  add column setor text,                -- ex.: 'cozinha', 'bar', 'sobremesas' — para organizar o KDS por estação
  add column iniciado_em timestamptz,
  add column pronto_em timestamptz;


-- =============================================================================
-- 2. TRIGGERS
-- =============================================================================

-- 2.1 Registrar timestamps de início/fim do preparo do item -------------------
create or replace function public.trg_item_producao_timestamps()
returns trigger language plpgsql as $$
begin
  if new.status_producao = 'preparo' and old.status_producao is distinct from 'preparo' then
    new.iniciado_em := now();
  end if;
  if new.status_producao = 'pronto' and old.status_producao is distinct from 'pronto' then
    new.pronto_em := coalesce(new.pronto_em, now());
  end if;
  return new;
end;
$$;

create trigger trg_item_producao_timestamps_bu
  before update of status_producao on public.pedido_itens
  for each row execute function public.trg_item_producao_timestamps();


-- 2.2 Propagar o progresso da produção para o status do pedido ----------------
-- Regra: quando o primeiro item entra em preparo, o pedido vira 'em_preparo';
-- quando todos os itens estão 'pronto', o pedido vira 'pronto'. Só mexe no
-- pedido se ele já estiver no fluxo de cozinha (confirmado/em_preparo/pronto) —
-- nunca reabre um pedido entregue ou cancelado.

create or replace function public.atualizar_status_pedido_por_producao(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status_atual status_pedido;
  v_total int;
  v_prontos int;
  v_em_preparo_ou_mais int;
begin
  select status into v_status_atual from public.pedidos where id = p_pedido_id;

  if v_status_atual not in ('confirmado','em_preparo','pronto') then
    return; -- pedido ainda sendo montado no PDV, ou já finalizado/cancelado
  end if;

  select count(*),
         count(*) filter (where status_producao = 'pronto'),
         count(*) filter (where status_producao in ('preparo','pronto'))
    into v_total, v_prontos, v_em_preparo_ou_mais
    from public.pedido_itens
    where pedido_id = p_pedido_id;

  if v_total > 0 and v_prontos = v_total then
    update public.pedidos set status = 'pronto' where id = p_pedido_id and status <> 'pronto';
  elsif v_em_preparo_ou_mais > 0 and v_status_atual = 'confirmado' then
    update public.pedidos set status = 'em_preparo' where id = p_pedido_id;
  end if;
end;
$$;

create or replace function public.trg_item_producao_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.atualizar_status_pedido_por_producao(new.pedido_id);
  return new;
end;
$$;

create trigger trg_item_producao_change_au
  after update of status_producao on public.pedido_itens
  for each row execute function public.trg_item_producao_change();


-- =============================================================================
-- 3. VIEW — FILA DA COZINHA (o que o KDS consome)
-- =============================================================================

create or replace view public.vw_fila_cozinha as
select
  pi.id as item_id,
  p.id as pedido_id,
  p.unidade_id,
  p.numero as pedido_numero,
  coalesce('Mesa ' || m.numero, initcap(p.canal::text)) as origem,
  pr.nome as produto,
  pi.quantidade,
  pi.observacoes,
  pi.setor,
  pi.status_producao,
  p.status as status_pedido,
  p.criado_em as pedido_criado_em,
  extract(epoch from (now() - p.criado_em)) / 60 as minutos_desde_pedido
from public.pedido_itens pi
join public.pedidos p on p.id = pi.pedido_id
join public.produtos pr on pr.id = pi.produto_id
left join public.mesas m on m.id = p.mesa_id
where p.status in ('confirmado','em_preparo','pronto')
order by p.criado_em asc;


-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

-- a cozinha precisa poder atualizar status_producao dos itens — política
-- adicional (permissiva, soma-se à já existente da Fase 2)
create policy pedido_itens_update_cozinha on public.pedido_itens for update
  using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_id and public.user_papel(p.unidade_id) = 'cozinha'
    )
  )
  with check (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_id and public.user_papel(p.unidade_id) = 'cozinha'
    )
  );

-- vw_fila_cozinha herda RLS de pedido_itens/pedidos automaticamente (view não
-- security definer), então nenhuma policy extra é necessária aqui.
