-- =============================================================================
-- SISTEMA DE GESTÃO PARA RESTAURANTE
-- Fase 1 — Fichas Técnicas e Estoque
-- =============================================================================
-- Este script assume um projeto Supabase novo. Rode em ordem (SQL Editor ou
-- como migration única). Requer extensão pgcrypto/uuid (Supabase já habilita
-- gen_random_uuid() por padrão).
-- =============================================================================


-- =============================================================================
-- 0. FUNDAÇÃO MÍNIMA (necessária para multiunidade + RLS)
-- =============================================================================

create table public.unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  created_at timestamptz not null default now()
);

create type papel_usuario as enum (
  'administrador','proprietario','gerente','caixa',
  'atendimento','cozinha','estoque','compras','financeiro'
);

create table public.user_unidades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  papel papel_usuario not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, unidade_id)
);

-- Funções auxiliares de RLS (stable = podem ser cacheadas na mesma query)
create or replace function public.user_has_unidade(p_unidade_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_unidades uu
    where uu.user_id = auth.uid()
      and uu.unidade_id = p_unidade_id
      and uu.ativo = true
  );
$$;

create or replace function public.user_papel(p_unidade_id uuid)
returns papel_usuario language sql security definer stable as $$
  select papel from public.user_unidades
  where user_id = auth.uid() and unidade_id = p_unidade_id and ativo = true
  limit 1;
$$;

create or replace function public.user_is_gestor(p_unidade_id uuid)
returns boolean language sql security definer stable as $$
  select public.user_papel(p_unidade_id) in ('administrador','proprietario','gerente');
$$;


-- =============================================================================
-- 1. CADASTROS BASE
-- =============================================================================

create type unidade_medida as enum ('kg','g','l','ml','un','cx','pct','dz');

create table public.categorias_ingrediente (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (unidade_id, nome)
);

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  razao_social text not null,
  nome_fantasia text,
  cnpj text,
  contato text,
  telefone text,
  email text,
  endereco text,
  prazo_entrega_dias int,
  condicoes_pagamento text,
  avaliacao numeric(3,2),
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredientes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  codigo text,
  nome text not null,
  categoria_id uuid references public.categorias_ingrediente(id),
  unidade_medida unidade_medida not null,           -- unidade de consumo (usada na ficha técnica)
  unidade_compra unidade_medida not null,           -- unidade em que é comprado
  fator_conversao numeric(12,4) not null default 1, -- 1 unidade_compra = fator_conversao * unidade_medida
  estoque_minimo numeric(12,3) not null default 0,
  estoque_maximo numeric(12,3),
  custo_unitario numeric(12,4) not null default 0,  -- custo por unidade_medida, recalculado nas entradas
  fornecedor_padrao_id uuid references public.fornecedores(id),
  localizacao text,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidade_id, codigo)
);

comment on column public.ingredientes.fator_conversao is
  'Quantas unidades de consumo equivalem a 1 unidade de compra. Ex.: compra em caixa (10un), consumo em unidade -> fator 10.';

create table public.categorias_produto (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (unidade_id, nome)
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  codigo text,
  nome text not null,
  categoria_id uuid references public.categorias_produto(id),
  descricao text,
  preco_venda numeric(12,2) not null default 0,
  tempo_estimado_producao_min int,
  disponivel boolean not null default true,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  imagem_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidade_id, codigo)
);


-- =============================================================================
-- 2. FICHAS TÉCNICAS
-- =============================================================================

create table public.fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  rendimento numeric(12,3) not null default 1,          -- quantas porções a ficha rende
  perda_prevista_pct numeric(5,2) not null default 0,   -- % de perda esperada no preparo
  custo_embalagem numeric(12,4) not null default 0,
  custo_ingredientes numeric(12,4) not null default 0,  -- calculado
  custo_total numeric(12,4) not null default 0,         -- calculado
  custo_por_unidade numeric(12,4) not null default 0,   -- calculado
  margem_pct numeric(5,2),                               -- calculado a partir do preco_venda do produto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (produto_id)
);

create table public.ficha_tecnica_itens (
  id uuid primary key default gen_random_uuid(),
  ficha_tecnica_id uuid not null references public.fichas_tecnicas(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id),
  quantidade numeric(12,4) not null check (quantidade > 0),  -- na unidade_medida do ingrediente
  custo_calculado numeric(12,4) not null default 0,          -- quantidade * custo_unitario (congelado no cálculo)
  created_at timestamptz not null default now(),
  unique (ficha_tecnica_id, ingrediente_id)
);


-- =============================================================================
-- 3. ESTOQUE
-- =============================================================================

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id) on delete cascade,
  numero_lote text,
  data_fabricacao date,
  data_validade date,
  quantidade_inicial numeric(12,3) not null,
  quantidade_atual numeric(12,3) not null,
  custo_unitario numeric(12,4) not null,
  fornecedor_id uuid references public.fornecedores(id),
  status text not null default 'ativo' check (status in ('ativo','esgotado','vencido','bloqueado')),
  created_at timestamptz not null default now()
);

create table public.estoque_saldo (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id) on delete cascade,
  quantidade_atual numeric(12,3) not null default 0,
  custo_medio numeric(12,4) not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (unidade_id, ingrediente_id)
);

create type tipo_movimentacao as enum (
  'entrada','saida','ajuste','transferencia','consumo_producao','perda','inventario'
);

create table public.movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id),
  lote_id uuid references public.lotes(id),
  tipo tipo_movimentacao not null,
  -- para 'ajuste' e 'inventario' a quantidade pode ser negativa (delta direto);
  -- para os demais tipos a quantidade é sempre positiva e o 'tipo' define o sentido
  quantidade numeric(12,3) not null,
  custo_unitario numeric(12,4),
  motivo text,
  documento_referencia text,          -- ex.: nº da OP, nº do pedido de compra
  usuario_id uuid references public.profiles(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  constraint chk_quantidade_sinal check (
    tipo in ('ajuste','inventario') or quantidade > 0
  )
);


-- =============================================================================
-- 4. TRIGGERS DE NEGÓCIO
-- =============================================================================

-- 4.1 updated_at genérico -----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_updated_at_ingredientes before update on public.ingredientes
  for each row execute function public.set_updated_at();
create trigger trg_updated_at_produtos before update on public.produtos
  for each row execute function public.set_updated_at();
create trigger trg_updated_at_fichas before update on public.fichas_tecnicas
  for each row execute function public.set_updated_at();
create trigger trg_updated_at_fornecedores before update on public.fornecedores
  for each row execute function public.set_updated_at();


-- 4.2 Recalcular custo da ficha técnica ---------------------------------------
-- Roda como SECURITY DEFINER porque é um cálculo derivado do sistema, não uma
-- edição direta do usuário — evita que um perfil "estoque" (que só tem
-- permissão de UPDATE em ingredientes) seja barrado pela RLS de fichas_tecnicas.

create or replace function public.recalcular_ficha_tecnica(p_ficha_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_custo_ing numeric(12,4);
  v_embalagem numeric(12,4);
  v_perda_pct numeric(5,2);
  v_rendimento numeric(12,3);
  v_preco_venda numeric(12,2);
  v_produto_id uuid;
  v_custo_total numeric(12,4);
begin
  select coalesce(sum(fti.custo_calculado), 0)
    into v_custo_ing
    from public.ficha_tecnica_itens fti
    where fti.ficha_tecnica_id = p_ficha_id;

  select custo_embalagem, perda_prevista_pct, rendimento, produto_id
    into v_embalagem, v_perda_pct, v_rendimento, v_produto_id
    from public.fichas_tecnicas
    where id = p_ficha_id;

  select preco_venda into v_preco_venda from public.produtos where id = v_produto_id;

  v_custo_total := round((v_custo_ing + coalesce(v_embalagem, 0)) * (1 + coalesce(v_perda_pct, 0) / 100.0), 4);

  update public.fichas_tecnicas
  set
    custo_ingredientes = v_custo_ing,
    custo_total = v_custo_total,
    custo_por_unidade = case when coalesce(v_rendimento, 0) > 0
      then round(v_custo_total / v_rendimento, 4) else 0 end,
    margem_pct = case when coalesce(v_preco_venda, 0) > 0 and coalesce(v_rendimento, 0) > 0
      then round((1 - (v_custo_total / v_rendimento) / v_preco_venda) * 100, 2)
      else null end
  where id = p_ficha_id;
end;
$$;

-- dispara ao inserir/alterar/remover item da ficha
create or replace function public.trg_ficha_tecnica_item_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_custo numeric(12,4);
  v_ficha_id uuid;
begin
  v_ficha_id := coalesce(new.ficha_tecnica_id, old.ficha_tecnica_id);

  if tg_op in ('INSERT','UPDATE') then
    select custo_unitario into v_custo from public.ingredientes where id = new.ingrediente_id;
    new.custo_calculado := round(new.quantidade * coalesce(v_custo, 0), 4);
  end if;

  perform public.recalcular_ficha_tecnica(v_ficha_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_ficha_item_biu
  before insert or update on public.ficha_tecnica_itens
  for each row execute function public.trg_ficha_tecnica_item_change();

create trigger trg_ficha_item_ad
  after delete on public.ficha_tecnica_itens
  for each row execute function public.trg_ficha_tecnica_item_change();

-- quando o custo_unitario do ingrediente muda, recalcula todas as fichas que o usam
create or replace function public.trg_ingrediente_custo_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.custo_unitario is distinct from old.custo_unitario then
    for r in
      select distinct fti.ficha_tecnica_id
      from public.ficha_tecnica_itens fti
      where fti.ingrediente_id = new.id
    loop
      update public.ficha_tecnica_itens
      set custo_calculado = round(quantidade * new.custo_unitario, 4)
      where ficha_tecnica_id = r.ficha_tecnica_id and ingrediente_id = new.id;

      perform public.recalcular_ficha_tecnica(r.ficha_tecnica_id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_ingrediente_custo_au
  after update on public.ingredientes
  for each row execute function public.trg_ingrediente_custo_change();


-- 4.3 Estoque: atualizar saldo e custo médio a cada movimentação -------------
create or replace function public.trg_movimentacao_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_saldo_atual numeric(12,3);
  v_custo_medio_atual numeric(12,4);
  v_delta numeric(12,3);
  v_novo_saldo numeric(12,3);
  v_novo_custo_medio numeric(12,4);
begin
  v_delta := case
    when new.tipo = 'entrada' then new.quantidade
    when new.tipo in ('ajuste','inventario') then new.quantidade  -- pode ser negativo
    else -new.quantidade
  end;

  select quantidade_atual, custo_medio into v_saldo_atual, v_custo_medio_atual
  from public.estoque_saldo
  where unidade_id = new.unidade_id and ingrediente_id = new.ingrediente_id
  for update;

  if not found then
    insert into public.estoque_saldo (unidade_id, ingrediente_id, quantidade_atual, custo_medio)
    values (new.unidade_id, new.ingrediente_id, 0, 0);
    v_saldo_atual := 0;
    v_custo_medio_atual := 0;
  end if;

  v_novo_saldo := v_saldo_atual + v_delta;

  if v_novo_saldo < 0 and new.tipo not in ('ajuste','inventario') then
    raise exception 'Saldo insuficiente de "%" para esta movimentação (atual: %, solicitado: %)',
      new.ingrediente_id, v_saldo_atual, new.quantidade;
  end if;

  -- custo médio móvel: recalcula só em entradas com custo informado
  if new.tipo = 'entrada' and new.custo_unitario is not null and v_novo_saldo > 0 then
    v_novo_custo_medio := round(
      ((v_saldo_atual * v_custo_medio_atual) + (new.quantidade * new.custo_unitario)) / v_novo_saldo,
      4
    );
  else
    v_novo_custo_medio := v_custo_medio_atual;
  end if;

  update public.estoque_saldo
  set quantidade_atual = v_novo_saldo,
      custo_medio = v_novo_custo_medio,
      atualizado_em = now()
  where unidade_id = new.unidade_id and ingrediente_id = new.ingrediente_id;

  -- entrada atualiza o custo "oficial" do ingrediente -> propaga para as fichas técnicas
  if new.tipo = 'entrada' and new.custo_unitario is not null then
    update public.ingredientes
    set custo_unitario = v_novo_custo_medio
    where id = new.ingrediente_id;
  end if;

  return new;
end;
$$;

create trigger trg_movimentacao_estoque_ai
  after insert on public.movimentacoes_estoque
  for each row execute function public.trg_movimentacao_estoque();

-- movimentações são histórico imutável — correções entram como nova movimentação de ajuste
create or replace function public.bloquear_alteracao()
returns trigger language plpgsql as $$
begin
  raise exception 'Movimentações de estoque não podem ser alteradas ou excluídas — registre uma movimentação de ajuste.';
end;
$$;

create trigger trg_movimentacao_bloqueio
  before update or delete on public.movimentacoes_estoque
  for each row execute function public.bloquear_alteracao();


-- =============================================================================
-- 5. VIEWS DE APOIO (alertas e indicadores usados no dashboard/relatórios)
-- =============================================================================

create or replace view public.vw_estoque_alertas as
select
  i.unidade_id,
  i.id as ingrediente_id,
  i.nome,
  coalesce(es.quantidade_atual, 0) as quantidade_atual,
  i.estoque_minimo,
  i.estoque_maximo,
  case
    when coalesce(es.quantidade_atual, 0) < i.estoque_minimo then 'abaixo_minimo'
    when i.estoque_maximo is not null and es.quantidade_atual > i.estoque_maximo then 'acima_maximo'
    else 'ok'
  end as situacao
from public.ingredientes i
left join public.estoque_saldo es
  on es.ingrediente_id = i.id and es.unidade_id = i.unidade_id
where i.status = 'ativo';

create or replace view public.vw_lotes_vencimento as
select
  l.unidade_id,
  l.id as lote_id,
  i.nome as ingrediente,
  l.numero_lote,
  l.data_validade,
  l.quantidade_atual,
  (l.data_validade - current_date) as dias_para_vencer
from public.lotes l
join public.ingredientes i on i.id = l.ingrediente_id
where l.status = 'ativo' and l.quantidade_atual > 0;


-- =============================================================================
-- 6. ROW LEVEL SECURITY
-- =============================================================================

alter table public.unidades enable row level security;
alter table public.profiles enable row level security;
alter table public.user_unidades enable row level security;
alter table public.categorias_ingrediente enable row level security;
alter table public.fornecedores enable row level security;
alter table public.ingredientes enable row level security;
alter table public.categorias_produto enable row level security;
alter table public.produtos enable row level security;
alter table public.fichas_tecnicas enable row level security;
alter table public.ficha_tecnica_itens enable row level security;
alter table public.lotes enable row level security;
alter table public.estoque_saldo enable row level security;
alter table public.movimentacoes_estoque enable row level security;

-- profiles: cada um vê/edita o próprio
create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- user_unidades: usuário vê seus vínculos; gestor vê os da unidade
create policy user_unidades_select on public.user_unidades
  for select using (user_id = auth.uid() or public.user_is_gestor(unidade_id));

-- ingredientes
create policy ingredientes_select on public.ingredientes
  for select using (public.user_has_unidade(unidade_id));
create policy ingredientes_insert on public.ingredientes
  for insert with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','estoque'));
create policy ingredientes_update on public.ingredientes
  for update using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','estoque'));
create policy ingredientes_delete on public.ingredientes
  for delete using (public.user_papel(unidade_id) in ('administrador','proprietario'));

-- fornecedores
create policy fornecedores_select on public.fornecedores
  for select using (public.user_has_unidade(unidade_id));
create policy fornecedores_write on public.fornecedores
  for all using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','compras'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','compras'));

-- categorias
create policy categorias_ingrediente_select on public.categorias_ingrediente
  for select using (public.user_has_unidade(unidade_id));
create policy categorias_ingrediente_write on public.categorias_ingrediente
  for all using (public.user_is_gestor(unidade_id)) with check (public.user_is_gestor(unidade_id));

create policy categorias_produto_select on public.categorias_produto
  for select using (public.user_has_unidade(unidade_id));
create policy categorias_produto_write on public.categorias_produto
  for all using (public.user_is_gestor(unidade_id)) with check (public.user_is_gestor(unidade_id));

-- produtos
create policy produtos_select on public.produtos
  for select using (public.user_has_unidade(unidade_id));
create policy produtos_write on public.produtos
  for all using (public.user_is_gestor(unidade_id)) with check (public.user_is_gestor(unidade_id));

-- fichas técnicas (seguem a unidade do produto)
create policy fichas_select on public.fichas_tecnicas
  for select using (
    exists (select 1 from public.produtos p where p.id = produto_id and public.user_has_unidade(p.unidade_id))
  );
create policy fichas_write on public.fichas_tecnicas
  for all using (
    exists (select 1 from public.produtos p where p.id = produto_id and public.user_is_gestor(p.unidade_id))
  )
  with check (
    exists (select 1 from public.produtos p where p.id = produto_id and public.user_is_gestor(p.unidade_id))
  );

create policy ficha_itens_select on public.ficha_tecnica_itens
  for select using (
    exists (
      select 1 from public.fichas_tecnicas f join public.produtos p on p.id = f.produto_id
      where f.id = ficha_tecnica_id and public.user_has_unidade(p.unidade_id)
    )
  );
create policy ficha_itens_write on public.ficha_tecnica_itens
  for all using (
    exists (
      select 1 from public.fichas_tecnicas f join public.produtos p on p.id = f.produto_id
      where f.id = ficha_tecnica_id and public.user_is_gestor(p.unidade_id)
    )
  )
  with check (
    exists (
      select 1 from public.fichas_tecnicas f join public.produtos p on p.id = f.produto_id
      where f.id = ficha_tecnica_id and public.user_is_gestor(p.unidade_id)
    )
  );

-- estoque: leitura ampla dentro da unidade; escrita restrita a perfis operacionais
create policy estoque_saldo_select on public.estoque_saldo
  for select using (public.user_has_unidade(unidade_id));
-- sem policy de insert/update: só o trigger (SECURITY DEFINER) escreve aqui

create policy lotes_select on public.lotes
  for select using (public.user_has_unidade(unidade_id));
create policy lotes_write on public.lotes
  for all using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','estoque'))
  with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','estoque'));

create policy movimentacoes_select on public.movimentacoes_estoque
  for select using (public.user_has_unidade(unidade_id));
create policy movimentacoes_insert on public.movimentacoes_estoque
  for insert with check (
    public.user_papel(unidade_id) in ('administrador','proprietario','gerente','estoque','cozinha')
  );
-- update/delete: bloqueados pelo trigger trg_movimentacao_bloqueio, não precisam de policy


-- =============================================================================
-- 7. SEED MÍNIMO PARA TESTAR (opcional — apague antes de produção)
-- =============================================================================

-- insert into public.unidades (nome) values ('Unidade Centro');
-- (crie um usuário pelo Supabase Auth, depois vincule em user_unidades com papel 'proprietario')
