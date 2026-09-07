-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 2 — PDV, Pedidos, Mesas e Caixa (+ baixa automática de estoque)
-- =============================================================================
-- Pré-requisito: rode schema-fichas-tecnicas-estoque.sql antes deste script.
-- Ele reutiliza: unidades, profiles, papel_usuario, user_has_unidade(),
-- user_papel(), user_is_gestor(), produtos, fichas_tecnicas,
-- ficha_tecnica_itens, movimentacoes_estoque.
-- =============================================================================


-- =============================================================================
-- 1. TIPOS
-- =============================================================================

create type status_pedido as enum (
  'aberto','confirmado','em_preparo','pronto','entregue','cancelado'
);
create type canal_venda as enum ('salao','mesa','balcao','delivery');
create type forma_pagamento as enum (
  'dinheiro','cartao_credito','cartao_debito','pix','vale_refeicao','outro'
);
create type status_mesa as enum ('livre','ocupada','aguardando_pagamento');


-- =============================================================================
-- 2. MESAS
-- =============================================================================

create table public.mesas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  numero int not null,
  capacidade int,
  status status_mesa not null default 'livre',
  pessoas_atual int not null default 0,
  created_at timestamptz not null default now(),
  unique (unidade_id, numero)
);


-- =============================================================================
-- 3. CAIXA
-- =============================================================================

create table public.caixas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  aberto_por uuid references public.profiles(id) default auth.uid(),
  aberto_em timestamptz not null default now(),
  fechado_por uuid references public.profiles(id),
  fechado_em timestamptz,
  saldo_inicial numeric(12,2) not null default 0,
  saldo_final numeric(12,2),
  status text not null default 'aberto' check (status in ('aberto','fechado'))
);

create table public.caixa_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixas(id) on delete cascade,
  tipo text not null check (tipo in ('sangria','suprimento','venda')),
  valor numeric(12,2) not null,
  descricao text,
  usuario_id uuid references public.profiles(id) default auth.uid(),
  criado_em timestamptz not null default now()
);

-- impede abrir um segundo caixa aberto na mesma unidade
create unique index uq_caixa_aberto_por_unidade
  on public.caixas (unidade_id)
  where status = 'aberto';


-- =============================================================================
-- 4. PEDIDOS
-- =============================================================================

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  numero bigint generated always as identity,
  caixa_id uuid references public.caixas(id),
  mesa_id uuid references public.mesas(id),
  canal canal_venda not null default 'salao',
  status status_pedido not null default 'aberto',
  forma_pagamento forma_pagamento,
  subtotal numeric(12,2) not null default 0,
  desconto numeric(12,2) not null default 0,
  acrescimo numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  observacoes text,
  estoque_baixado boolean not null default false,
  usuario_id uuid references public.profiles(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),
  quantidade numeric(12,3) not null check (quantidade > 0),
  preco_unitario numeric(12,2) not null,
  desconto numeric(12,2) not null default 0,
  observacoes text,
  criado_em timestamptz not null default now()
);

create index idx_pedido_itens_pedido on public.pedido_itens (pedido_id);
create index idx_pedidos_unidade_status on public.pedidos (unidade_id, status);


-- =============================================================================
-- 5. TRIGGERS
-- =============================================================================

-- 5.1 updated_at do pedido -----------------------------------------------------
create or replace function public.set_pedido_updated_at()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_pedidos_updated_at before update on public.pedidos
  for each row execute function public.set_pedido_updated_at();


-- 5.2 Recalcular total do pedido quando os itens mudam ------------------------
create or replace function public.recalcular_pedido(p_pedido_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric(12,2);
  v_desconto_pedido numeric(12,2);
  v_acrescimo numeric(12,2);
begin
  select coalesce(sum(quantidade * preco_unitario - desconto), 0)
    into v_subtotal
    from public.pedido_itens
    where pedido_id = p_pedido_id;

  select desconto, acrescimo into v_desconto_pedido, v_acrescimo
    from public.pedidos where id = p_pedido_id;

  update public.pedidos
  set subtotal = v_subtotal,
      total = v_subtotal - coalesce(v_desconto_pedido, 0) + coalesce(v_acrescimo, 0)
  where id = p_pedido_id;
end;
$$;

create or replace function public.trg_pedido_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pedido_id uuid;
begin
  v_pedido_id := coalesce(new.pedido_id, old.pedido_id);
  perform public.recalcular_pedido(v_pedido_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_pedido_item_aiud
  after insert or update or delete on public.pedido_itens
  for each row execute function public.trg_pedido_item_change();


-- 5.3 Baixa automática de estoque a partir da ficha técnica --------------------
-- Dispara quando o pedido muda de status para 'entregue'. Para cada item do
-- pedido, explode a ficha técnica do produto e lança uma movimentação
-- 'consumo_producao' por ingrediente, na proporção quantidade_vendida / rendimento.
-- Idempotente: só roda uma vez por pedido (flag estoque_baixado).

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
begin
  select unidade_id, estoque_baixado, numero
    into v_unidade_id, v_ja_baixado, v_numero
    from public.pedidos where id = p_pedido_id
    for update;

  if v_ja_baixado then
    return; -- já baixado, evita duplicar
  end if;

  for item in
    select produto_id, quantidade from public.pedido_itens where pedido_id = p_pedido_id
  loop
    select id, rendimento into ficha
      from public.fichas_tecnicas where produto_id = item.produto_id;

    if ficha.id is null then
      continue; -- produto sem ficha técnica cadastrada: nada a baixar (ex.: item revenda simples)
    end if;

    for ing in
      select ingrediente_id, quantidade as qtd_ficha
      from public.ficha_tecnica_itens
      where ficha_tecnica_id = ficha.id
    loop
      v_qtd_consumo := round(item.quantidade * (ing.qtd_ficha / nullif(ficha.rendimento, 0)), 4);

      if v_qtd_consumo is not null and v_qtd_consumo > 0 then
        insert into public.movimentacoes_estoque
          (unidade_id, ingrediente_id, tipo, quantidade, motivo, documento_referencia)
        values
          (v_unidade_id, ing.ingrediente_id, 'consumo_producao', v_qtd_consumo,
           'Baixa automática — venda', 'Pedido #' || v_numero);
      end if;
    end loop;
  end loop;

  update public.pedidos set estoque_baixado = true where id = p_pedido_id;
end;
$$;

create or replace function public.trg_pedido_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'entregue' and old.status is distinct from 'entregue' then
    perform public.baixar_estoque_pedido(new.id);
  end if;

  -- libera a mesa quando o pedido é finalizado ou cancelado
  if new.mesa_id is not null and new.status in ('entregue','cancelado') then
    update public.mesas set status = 'livre', pessoas_atual = 0 where id = new.mesa_id;
  end if;

  return new;
end;
$$;

create trigger trg_pedido_status_au
  after update of status on public.pedidos
  for each row execute function public.trg_pedido_status_change();


-- 5.4 Registrar venda no caixa quando o pedido é finalizado --------------------
create or replace function public.trg_pedido_registrar_venda_caixa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'entregue' and old.status is distinct from 'entregue' and new.caixa_id is not null then
    insert into public.caixa_movimentacoes (caixa_id, tipo, valor, descricao, usuario_id)
    values (new.caixa_id, 'venda', new.total, 'Pedido #' || new.numero, new.usuario_id);
  end if;
  return new;
end;
$$;

create trigger trg_pedido_venda_caixa_au
  after update of status on public.pedidos
  for each row execute function public.trg_pedido_registrar_venda_caixa();


-- =============================================================================
-- 6. VIEWS DE APOIO
-- =============================================================================

create or replace view public.vw_pedidos_em_andamento as
select
  p.id, p.unidade_id, p.numero, p.status, p.canal,
  m.numero as mesa_numero, p.total,
  p.criado_em,
  extract(epoch from (now() - p.criado_em)) / 60 as minutos_em_aberto
from public.pedidos p
left join public.mesas m on m.id = p.mesa_id
where p.status not in ('entregue','cancelado');

create or replace view public.vw_caixa_resumo as
select
  cx.id as caixa_id,
  cx.unidade_id,
  cx.status,
  cx.saldo_inicial,
  cx.saldo_inicial
    + coalesce(sum(cm.valor) filter (where cm.tipo in ('venda','suprimento')), 0)
    - coalesce(sum(cm.valor) filter (where cm.tipo = 'sangria'), 0) as saldo_calculado,
  count(cm.*) filter (where cm.tipo = 'venda') as qtd_vendas
from public.caixas cx
left join public.caixa_movimentacoes cm on cm.caixa_id = cx.id
group by cx.id;


-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

alter table public.mesas enable row level security;
alter table public.caixas enable row level security;
alter table public.caixa_movimentacoes enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

-- mesas
create policy mesas_select on public.mesas for select using (public.user_has_unidade(unidade_id));
create policy mesas_write on public.mesas for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','atendimento','caixa'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','atendimento','caixa'));

-- caixas
create policy caixas_select on public.caixas for select using (public.user_has_unidade(unidade_id));
create policy caixas_insert on public.caixas for insert
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','caixa'));
create policy caixas_update on public.caixas for update
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','caixa'));

-- caixa_movimentacoes (segue a unidade do caixa)
create policy caixa_mov_select on public.caixa_movimentacoes for select using (
  exists (select 1 from public.caixas cx where cx.id = caixa_id and public.user_has_unidade(cx.unidade_id))
);
create policy caixa_mov_insert on public.caixa_movimentacoes for insert with check (
  exists (
    select 1 from public.caixas cx where cx.id = caixa_id
      and public.user_papel(cx.unidade_id) in ('administrador','proprietario','gerente','caixa')
  )
);

-- pedidos
create policy pedidos_select on public.pedidos for select using (public.user_has_unidade(unidade_id));
create policy pedidos_insert on public.pedidos for insert
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','caixa','atendimento'));
create policy pedidos_update on public.pedidos for update
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','caixa','atendimento','cozinha'));

-- pedido_itens (segue a unidade do pedido)
create policy pedido_itens_select on public.pedido_itens for select using (
  exists (select 1 from public.pedidos p where p.id = pedido_id and public.user_has_unidade(p.unidade_id))
);
create policy pedido_itens_write on public.pedido_itens for all using (
  exists (
    select 1 from public.pedidos p where p.id = pedido_id
      and public.user_papel(p.unidade_id) in ('administrador','proprietario','gerente','caixa','atendimento')
  )
) with check (
  exists (
    select 1 from public.pedidos p where p.id = pedido_id
      and public.user_papel(p.unidade_id) in ('administrador','proprietario','gerente','caixa','atendimento')
  )
);
