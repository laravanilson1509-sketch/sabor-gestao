-- =============================================================================
-- Compras — solicitação, cotação, recebimento com conferência e histórico de preços
-- =============================================================================
-- Fluxo: Solicitação -> Cotação (comparativo) -> Fornecedor aprovado ->
--        Pedido enviado -> Recebimento conferido -> Estoque + Conta a pagar
--
-- O recebimento (função compra_receber) faz tudo de uma vez, numa transação:
--   1. guarda o que foi conferido (quantidade e preço da nota de cada item);
--   2. dá entrada no estoque só do que chegou e atualiza o custo médio;
--   3. cria a conta a pagar no Financeiro (categoria "fornecedores");
--   4. marca a solicitação como recebida.
-- Clicar duas vezes não duplica: cada solicitação tem um único recebimento.
-- =============================================================================

-- 1. SOLICITAÇÕES -------------------------------------------------------------

create table if not exists public.solicitacoes_compra (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  status text not null default 'aguardando_cotacao' check (status in (
    'aguardando_cotacao','cotado','aprovado','pedido_enviado','recebido','cancelado'
  )),
  observacao text,
  origem text not null default 'manual' check (origem in ('manual','sugestao')),
  fornecedor_escolhido_id uuid references public.fornecedores(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_solicitacoes_compra_unidade
  on public.solicitacoes_compra (unidade_id, status);

create table if not exists public.solicitacoes_compra_itens (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_compra(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes(id),
  quantidade numeric(12,3) not null check (quantidade > 0),
  unidade text not null
);

create index if not exists idx_solicitacoes_itens_solicitacao
  on public.solicitacoes_compra_itens (solicitacao_id);
create index if not exists idx_solicitacoes_itens_ingrediente
  on public.solicitacoes_compra_itens (ingrediente_id);

create or replace function public.trg_solicitacoes_compra_atualizado()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_solicitacoes_compra_bu on public.solicitacoes_compra;
create trigger trg_solicitacoes_compra_bu before update on public.solicitacoes_compra
  for each row execute function public.trg_solicitacoes_compra_atualizado();


-- 2. COTAÇÕES -----------------------------------------------------------------

create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes_compra(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id),
  prazo_entrega_dias int check (prazo_entrega_dias is null or prazo_entrega_dias >= 0),
  condicoes_pagamento text,
  criado_em timestamptz not null default now(),
  unique (solicitacao_id, fornecedor_id)
);

create table if not exists public.cotacoes_itens (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  solicitacao_item_id uuid not null references public.solicitacoes_compra_itens(id) on delete cascade,
  preco_unitario numeric(12,4) not null check (preco_unitario >= 0),  -- por unidade de compra
  unique (cotacao_id, solicitacao_item_id)
);


-- 3. RECEBIMENTO COM CONFERÊNCIA ----------------------------------------------

create table if not exists public.compra_recebimentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  solicitacao_id uuid not null unique references public.solicitacoes_compra(id) on delete cascade,
  fornecedor_id uuid references public.fornecedores(id),
  numero_nota text,
  data_recebimento date not null default current_date,
  vencimento date,
  total numeric(12,2) not null default 0,
  observacao text,
  conta_pagar_id uuid,
  recebido_por text default (auth.jwt() ->> 'email'),
  criado_em timestamptz not null default now()
);

create table if not exists public.compra_recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.compra_recebimentos(id) on delete cascade,
  solicitacao_item_id uuid references public.solicitacoes_compra_itens(id) on delete set null,
  ingrediente_id uuid not null references public.ingredientes(id),
  unidade text not null,
  qtd_pedida numeric(12,3) not null,
  qtd_recebida numeric(12,3) not null check (qtd_recebida >= 0),
  preco_cotado numeric(12,4),                       -- o que foi combinado na cotação
  preco_unitario numeric(12,4) not null check (preco_unitario >= 0),  -- o que veio na nota
  observacao text
);

create index if not exists idx_receb_itens_recebimento on public.compra_recebimento_itens (recebimento_id);
create index if not exists idx_receb_itens_ingrediente on public.compra_recebimento_itens (ingrediente_id);

-- liga a conta a pagar ao recebimento que a gerou
alter table public.contas_pagar
  add column if not exists compra_recebimento_id uuid;

create or replace function public.compra_receber(
  p_solicitacao uuid,
  p_numero_nota text,
  p_data_recebimento date,
  p_vencimento date,
  p_observacao text,
  p_itens jsonb      -- [{ "item_id": "...", "qtd_recebida": 3, "preco_unitario": 12.5, "observacao": "..." }]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s public.solicitacoes_compra;
  v_rec uuid;
  v_forn text;
  v_total numeric(12,2) := 0;
  v_conta uuid;
  j jsonb;
  it public.solicitacoes_compra_itens;
  v_nome text;
  v_qtd numeric;
  v_preco numeric;
  v_cotado numeric;
  v_saldo public.estoque_saldo;
  v_custo numeric;
  v_ref text;
begin
  select * into s from public.solicitacoes_compra where id = p_solicitacao for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;

  -- já recebida: devolve o recebimento existente (clique repetido não duplica)
  select id into v_rec from public.compra_recebimentos where solicitacao_id = p_solicitacao;
  if found then return v_rec; end if;

  if s.status not in ('aprovado','pedido_enviado') then
    raise exception 'Só dá para receber uma compra com fornecedor aprovado ou pedido enviado.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Informe os itens recebidos.';
  end if;

  select nome into v_forn from public.fornecedores where id = s.fornecedor_escolhido_id;
  v_ref := 'Compra' || coalesce(' · ' || v_forn, '') || coalesce(' (nota ' || nullif(trim(p_numero_nota), '') || ')', '');

  insert into public.compra_recebimentos
    (unidade_id, solicitacao_id, fornecedor_id, numero_nota, data_recebimento, vencimento, observacao)
  values
    (s.unidade_id, s.id, s.fornecedor_escolhido_id, nullif(trim(p_numero_nota), ''),
     coalesce(p_data_recebimento, current_date), p_vencimento, nullif(trim(p_observacao), ''))
  returning id into v_rec;

  for j in select * from jsonb_array_elements(p_itens) loop
    select * into it from public.solicitacoes_compra_itens
     where id = (j ->> 'item_id')::uuid and solicitacao_id = p_solicitacao;
    if not found then raise exception 'Item inválido na conferência.'; end if;

    select nome into v_nome from public.ingredientes where id = it.ingrediente_id;
    v_qtd := coalesce((j ->> 'qtd_recebida')::numeric, 0);
    v_preco := coalesce((j ->> 'preco_unitario')::numeric, 0);
    if v_qtd < 0 or v_preco < 0 then raise exception 'Quantidade e preço não podem ser negativos (%).', v_nome; end if;

    select ci.preco_unitario into v_cotado
      from public.cotacoes_itens ci
      join public.cotacoes c on c.id = ci.cotacao_id
     where c.solicitacao_id = p_solicitacao
       and c.fornecedor_id = s.fornecedor_escolhido_id
       and ci.solicitacao_item_id = it.id;

    insert into public.compra_recebimento_itens
      (recebimento_id, solicitacao_item_id, ingrediente_id, unidade, qtd_pedida, qtd_recebida,
       preco_cotado, preco_unitario, observacao)
    values
      (v_rec, it.id, it.ingrediente_id, it.unidade, it.quantidade, v_qtd,
       v_cotado, v_preco, nullif(trim(coalesce(j ->> 'observacao', '')), ''));

    if v_qtd > 0 then
      select * into v_saldo from public.estoque_saldo
       where ingrediente_id = it.ingrediente_id and unidade_id = s.unidade_id
       for update;

      if found then
        if v_saldo.unidade is not null and lower(v_saldo.unidade) <> lower(it.unidade) then
          raise exception 'A unidade da compra (%) é diferente da do estoque (%) para %. Ajuste a unidade da solicitação.',
            it.unidade, v_saldo.unidade, v_nome;
        end if;
        -- custo médio ponderado: o que já tinha + o que chegou
        if greatest(coalesce(v_saldo.quantidade_disponivel, 0), 0) + v_qtd > 0 then
          v_custo := (greatest(coalesce(v_saldo.quantidade_disponivel, 0), 0) * coalesce(v_saldo.custo_unitario, 0)
                      + v_qtd * v_preco)
                     / (greatest(coalesce(v_saldo.quantidade_disponivel, 0), 0) + v_qtd);
        else
          v_custo := v_preco;
        end if;
        update public.estoque_saldo set custo_unitario = round(v_custo, 4) where id = v_saldo.id;
      else
        insert into public.estoque_saldo
          (ingrediente_id, unidade_id, quantidade_disponivel, custo_unitario, unidade, estoque_minimo)
        values (it.ingrediente_id, s.unidade_id, 0, v_preco, it.unidade, 0);
      end if;

      insert into public.movimentacoes_estoque (ingrediente_id, unidade_id, tipo, quantidade, observacao)
      values (it.ingrediente_id, s.unidade_id, 'entrada', v_qtd, v_ref);
    end if;

    v_total := v_total + round(v_qtd * v_preco, 2);
  end loop;

  if v_total > 0 then
    insert into public.contas_pagar
      (unidade_id, descricao, categoria, credor, valor, vencimento, observacao, compra_recebimento_id)
    values
      (s.unidade_id, v_ref, 'fornecedores', v_forn, v_total,
       coalesce(p_vencimento, coalesce(p_data_recebimento, current_date)),
       nullif(trim(p_observacao), ''), v_rec)
    returning id into v_conta;
  end if;

  update public.compra_recebimentos set total = v_total, conta_pagar_id = v_conta where id = v_rec;
  update public.solicitacoes_compra set status = 'recebido' where id = p_solicitacao;
  return v_rec;
end;
$$;


-- 4. HISTÓRICO DE PREÇOS ------------------------------------------------------
-- junta o que foi cotado e o que veio na nota, por ingrediente e fornecedor

create or replace view public.compras_historico_precos
with (security_invoker = true) as
select
  s.unidade_id,
  ri.ingrediente_id,
  r.fornecedor_id,
  f.nome as fornecedor,
  r.data_recebimento::timestamptz as data,
  ri.preco_unitario,
  ri.unidade,
  'nota'::text as origem
from public.compra_recebimento_itens ri
join public.compra_recebimentos r on r.id = ri.recebimento_id
join public.solicitacoes_compra s on s.id = r.solicitacao_id
left join public.fornecedores f on f.id = r.fornecedor_id
where ri.qtd_recebida > 0
union all
select
  s.unidade_id,
  si.ingrediente_id,
  c.fornecedor_id,
  f.nome,
  c.criado_em,
  ci.preco_unitario,
  si.unidade,
  'cotacao'::text
from public.cotacoes_itens ci
join public.cotacoes c on c.id = ci.cotacao_id
join public.solicitacoes_compra_itens si on si.id = ci.solicitacao_item_id
join public.solicitacoes_compra s on s.id = c.solicitacao_id
left join public.fornecedores f on f.id = c.fornecedor_id;


-- 5. PERMISSÕES (mesmo padrão do Financeiro: quem está logado lê e grava) -------

alter table public.solicitacoes_compra enable row level security;
alter table public.solicitacoes_compra_itens enable row level security;
alter table public.cotacoes enable row level security;
alter table public.cotacoes_itens enable row level security;
alter table public.compra_recebimentos enable row level security;
alter table public.compra_recebimento_itens enable row level security;

do $$
declare t text;
begin
  foreach t in array array['solicitacoes_compra','solicitacoes_compra_itens','cotacoes','cotacoes_itens']
  loop
    execute format('drop policy if exists %1$s_logado on public.%1$s', t);
    execute format('create policy %1$s_logado on public.%1$s for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- recebimentos só mudam pela função (que confere tudo); aqui é só leitura
drop policy if exists compra_recebimentos_ler on public.compra_recebimentos;
create policy compra_recebimentos_ler on public.compra_recebimentos for select to authenticated using (true);
drop policy if exists compra_recebimento_itens_ler on public.compra_recebimento_itens;
create policy compra_recebimento_itens_ler on public.compra_recebimento_itens for select to authenticated using (true);
