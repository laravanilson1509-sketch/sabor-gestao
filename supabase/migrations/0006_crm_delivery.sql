-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 6 — CRM / Clientes, Cupons & Promoções, Delivery
-- =============================================================================
-- Pré-requisito: rode, nesta ordem, os 5 scripts anteriores
-- (fichas-tecnicas-estoque, pdv-pedidos-mesas, cozinha-kds, compras, financeiro).
-- =============================================================================


-- =============================================================================
-- 1. CLIENTES / CRM
-- =============================================================================

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  endereco text,
  data_nascimento date,
  criado_em timestamptz not null default now()
);

create index idx_clientes_unidade on public.clientes (unidade_id);
create index idx_clientes_telefone on public.clientes (telefone);

-- liga o pedido ao cliente (coluna não existia nas fases anteriores)
alter table public.pedidos add column cliente_id uuid references public.clientes(id);

-- histórico de compras, frequência, ticket médio, produto preferido e última
-- compra são todos derivados — nada disso é armazenado, evita dado desatualizado
create or replace view public.vw_clientes_resumo as
select
  c.id as cliente_id,
  c.unidade_id,
  c.nome,
  count(p.id) as total_pedidos,
  coalesce(sum(p.total), 0) as valor_total_comprado,
  case when count(p.id) > 0 then round(avg(p.total), 2) else 0 end as ticket_medio,
  max(p.criado_em) as ultima_compra,
  (
    select pi.produto_id
    from public.pedido_itens pi
    join public.pedidos p2 on p2.id = pi.pedido_id
    where p2.cliente_id = c.id and p2.status = 'entregue'
    group by pi.produto_id
    order by sum(pi.quantidade) desc
    limit 1
  ) as produto_preferido_id
from public.clientes c
left join public.pedidos p on p.cliente_id = c.id and p.status = 'entregue'
group by c.id;


-- =============================================================================
-- 2. FIDELIDADE (livro-razão de pontos, mesmo padrão imutável do fluxo de caixa)
-- =============================================================================

create type tipo_lancamento_fidelidade as enum ('credito','resgate','expiracao','ajuste');

create table public.fidelidade_pontos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  pedido_id uuid references public.pedidos(id),
  tipo tipo_lancamento_fidelidade not null,
  pontos int not null,          -- positivo em crédito/ajuste, negativo em resgate/expiração
  descricao text,
  criado_em timestamptz not null default now()
);

create or replace view public.vw_fidelidade_saldo as
select cliente_id, coalesce(sum(pontos), 0) as saldo
from public.fidelidade_pontos
group by cliente_id;

-- credita pontos automaticamente quando o pedido é entregue (1 ponto a cada R$10)
create or replace function public.trg_pedido_creditar_fidelidade()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pontos int;
begin
  if new.status = 'entregue' and old.status is distinct from 'entregue' and new.cliente_id is not null then
    v_pontos := floor(new.total / 10);
    if v_pontos > 0 then
      insert into public.fidelidade_pontos (cliente_id, pedido_id, tipo, pontos, descricao)
      values (new.cliente_id, new.id, 'credito', v_pontos, 'Pedido #' || new.numero);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_pedido_status_fidelidade
  after update of status on public.pedidos
  for each row execute function public.trg_pedido_creditar_fidelidade();


-- =============================================================================
-- 3. CUPONS
-- =============================================================================

create type tipo_desconto as enum ('percentual','fixo');

create table public.cupons (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  codigo text not null,
  tipo_desconto tipo_desconto not null,
  valor numeric(12,2) not null check (valor > 0),   -- % (0-100) ou valor fixo em R$, conforme tipo_desconto
  valido_de date not null default current_date,
  valido_ate date,
  uso_maximo int,             -- null = ilimitado
  uso_atual int not null default 0,
  valor_minimo_pedido numeric(12,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (unidade_id, codigo)
);

alter table public.pedidos add column cupom_id uuid references public.cupons(id);

-- aplica um cupom a um pedido: valida regras e ajusta o desconto do pedido
-- (chamada explícita da aplicação — ex.: aplicar_cupom(pedido_id, 'BEMVINDO10'))
create or replace function public.aplicar_cupom(p_pedido_id uuid, p_codigo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cupom record;
  v_pedido record;
  v_desconto numeric(12,2);
begin
  select * into v_pedido from public.pedidos where id = p_pedido_id for update;

  select * into v_cupom from public.cupons
    where unidade_id = v_pedido.unidade_id and codigo = p_codigo and ativo = true
    for update;

  if v_cupom.id is null then
    raise exception 'Cupom inválido ou inativo';
  end if;
  if current_date < v_cupom.valido_de or (v_cupom.valido_ate is not null and current_date > v_cupom.valido_ate) then
    raise exception 'Cupom fora do período de validade';
  end if;
  if v_cupom.uso_maximo is not null and v_cupom.uso_atual >= v_cupom.uso_maximo then
    raise exception 'Cupom esgotou o limite de uso';
  end if;
  if v_cupom.valor_minimo_pedido is not null and v_pedido.subtotal < v_cupom.valor_minimo_pedido then
    raise exception 'Pedido não atinge o valor mínimo exigido pelo cupom (R$ %)', v_cupom.valor_minimo_pedido;
  end if;

  v_desconto := case
    when v_cupom.tipo_desconto = 'percentual' then round(v_pedido.subtotal * v_cupom.valor / 100.0, 2)
    else v_cupom.valor
  end;

  update public.pedidos set cupom_id = v_cupom.id, desconto = v_desconto where id = p_pedido_id;
  update public.cupons set uso_atual = uso_atual + 1 where id = v_cupom.id;

  perform public.recalcular_pedido(p_pedido_id);
end;
$$;


-- =============================================================================
-- 4. PROMOÇÕES
-- =============================================================================
-- Catálogo de regras de promoção. A leitura do preço vigente é feita pela
-- função calcular_preco_promocional(), chamada pelo PDV ao montar o pedido —
-- não há trigger de aplicação automática, porque a promoção depende do
-- momento em que o item é adicionado (não de um evento já registrado no banco).

create type tipo_promocao as enum ('percentual','fixo');

create table public.promocoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,
  tipo tipo_promocao not null,
  valor numeric(12,2) not null,             -- % ou valor fixo de desconto, conforme tipo
  produto_id uuid references public.produtos(id),      -- null = aplica à categoria inteira
  categoria_id uuid references public.categorias_produto(id),
  hora_inicio time,                          -- ex.: promoção de happy hour
  hora_fim time,
  dias_semana int[],                         -- 0=domingo ... 6=sábado; null = todos os dias
  valido_de date not null default current_date,
  valido_ate date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create or replace function public.calcular_preco_promocional(p_produto_id uuid, p_momento timestamptz default now())
returns numeric language plpgsql stable as $$
declare
  v_preco_base numeric(12,2);
  v_categoria_id uuid;
  v_promo record;
  v_preco_final numeric(12,2);
  v_dia int;
  v_hora time;
begin
  select preco_venda, categoria_id into v_preco_base, v_categoria_id
    from public.produtos where id = p_produto_id;

  v_dia := extract(dow from p_momento);
  v_hora := p_momento::time;
  v_preco_final := v_preco_base;

  select * into v_promo from public.promocoes
    where ativo = true
      and (produto_id = p_produto_id or (produto_id is null and categoria_id = v_categoria_id))
      and current_date between valido_de and coalesce(valido_ate, current_date)
      and (dias_semana is null or v_dia = any(dias_semana))
      and (hora_inicio is null or v_hora between hora_inicio and hora_fim)
    order by produto_id nulls last  -- promoção específica do produto tem prioridade sobre a de categoria
    limit 1;

  if v_promo.id is not null then
    v_preco_final := case
      when v_promo.tipo = 'percentual' then round(v_preco_base * (1 - v_promo.valor / 100.0), 2)
      else greatest(v_preco_base - v_promo.valor, 0)
    end;
  end if;

  return v_preco_final;
end;
$$;


-- =============================================================================
-- 5. DELIVERY
-- =============================================================================

create table public.delivery_canais (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,                 -- 'iFood', 'WhatsApp', 'Site próprio', etc.
  comissao_percentual numeric(5,2) not null default 0,
  ativo boolean not null default true,
  unique (unidade_id, nome)
);

create type status_entrega as enum ('aguardando','em_rota','entregue','cancelada');

create table public.delivery_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  canal_id uuid not null references public.delivery_canais(id),
  endereco_entrega text not null,
  tempo_estimado_min int,
  status_entrega status_entrega not null default 'aguardando',
  saiu_para_entrega_em timestamptz,
  entregue_em timestamptz,
  unique (pedido_id)
);

create or replace function public.trg_delivery_status_timestamps()
returns trigger language plpgsql as $$
begin
  if new.status_entrega = 'em_rota' and old.status_entrega is distinct from 'em_rota' then
    new.saiu_para_entrega_em := now();
  end if;
  if new.status_entrega = 'entregue' and old.status_entrega is distinct from 'entregue' then
    new.entregue_em := now();
  end if;
  return new;
end;
$$;

create trigger trg_delivery_status_bu
  before update of status_entrega on public.delivery_pedidos
  for each row execute function public.trg_delivery_status_timestamps();

-- faturamento líquido por canal (bruto - comissão), para o relatório de delivery
create or replace view public.vw_delivery_faturamento as
select
  dp.pedido_id,
  p.unidade_id,
  dc.nome as canal,
  p.total as valor_bruto,
  dc.comissao_percentual,
  round(p.total * (1 - dc.comissao_percentual / 100.0), 2) as valor_liquido,
  dp.status_entrega,
  dp.tempo_estimado_min,
  extract(epoch from (dp.entregue_em - p.criado_em)) / 60 as tempo_real_min
from public.delivery_pedidos dp
join public.pedidos p on p.id = dp.pedido_id
join public.delivery_canais dc on dc.id = dp.canal_id;


-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

alter table public.clientes enable row level security;
alter table public.fidelidade_pontos enable row level security;
alter table public.cupons enable row level security;
alter table public.promocoes enable row level security;
alter table public.delivery_canais enable row level security;
alter table public.delivery_pedidos enable row level security;

create policy clientes_select on public.clientes for select using (public.user_has_unidade(unidade_id));
create policy clientes_write on public.clientes for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','atendimento','caixa'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','atendimento','caixa'));

create policy fidelidade_select on public.fidelidade_pontos for select using (
  exists (select 1 from public.clientes c where c.id = cliente_id and public.user_has_unidade(c.unidade_id))
);
-- sem policy de insert direta: só o trigger (SECURITY DEFINER) credita pontos;
-- resgates manuais entram por uma função equivalente a aplicar_cupom() quando esse fluxo for implementado

create policy cupons_select on public.cupons for select using (public.user_has_unidade(unidade_id));
create policy cupons_write on public.cupons for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente'));

create policy promocoes_select on public.promocoes for select using (public.user_has_unidade(unidade_id));
create policy promocoes_write on public.promocoes for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente'));

create policy delivery_canais_select on public.delivery_canais for select using (public.user_has_unidade(unidade_id));
create policy delivery_canais_write on public.delivery_canais for all
  using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente'));

create policy delivery_pedidos_select on public.delivery_pedidos for select using (
  exists (select 1 from public.pedidos p where p.id = pedido_id and public.user_has_unidade(p.unidade_id))
);
create policy delivery_pedidos_write on public.delivery_pedidos for all using (
  exists (
    select 1 from public.pedidos p where p.id = pedido_id
      and public.user_papel(p.unidade_id) in ('administrador','proprietario','gerente','atendimento','cozinha')
  )
) with check (
  exists (
    select 1 from public.pedidos p where p.id = pedido_id
      and public.user_papel(p.unidade_id) in ('administrador','proprietario','gerente','atendimento','cozinha')
  )
);
