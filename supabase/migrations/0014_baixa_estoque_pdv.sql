-- =============================================================================
-- Baixa de estoque automática quando a cozinha marca um item do PDV como pronto
-- =============================================================================
-- Prato: baixa os ingredientes da ficha técnica. Produto acabado: baixa ele mesmo.
-- A baixa só registra um 'consumo' em movimentacoes_estoque; o trigger que já
-- existe (aplicar_movimentacao_estoque) atualiza o saldo e não deixa ficar
-- negativo. Quando falta estoque, não tem ficha ou a unidade não bate, a venda
-- segue e fica uma pendência para o gerente conferir.
-- Se a cozinha voltar o item de "Pronto", o que foi baixado volta como 'entrada'.
-- =============================================================================

-- 1. O QUE FOI BAIXADO POR ITEM (para conseguir devolver no "Voltar") ---------
create table if not exists public.pdv_estoque_baixas (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.pdv_pedido_itens(id) on delete cascade,
  ingrediente_id uuid not null,
  unidade_id uuid not null,
  quantidade numeric(12,3) not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pdv_estoque_baixas_item on public.pdv_estoque_baixas (item_id);


-- 2. PENDÊNCIAS PARA O GERENTE CONFERIR ----------------------------------------
create table if not exists public.pdv_estoque_pendencias (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  item_id uuid references public.pdv_pedido_itens(id) on delete set null,
  tipo text not null check (tipo in ('sem_ficha','estoque_insuficiente','unidade_diferente')),
  produto_id uuid,
  produto_nome text not null,
  ingrediente_id uuid,
  ingrediente_nome text,
  quantidade_necessaria numeric(12,3),
  quantidade_baixada numeric(12,3),
  unidade text,
  origem text,                       -- ex.: 'Mesa 3', 'Balcão #12'
  status text not null default 'aberta' check (status in ('aberta','conferida')),
  criado_em timestamptz not null default now(),
  conferido_em timestamptz,
  conferido_por text,
  observacao text
);

create index if not exists idx_pdv_estoque_pendencias_abertas
  on public.pdv_estoque_pendencias (unidade_id, criado_em)
  where status = 'aberta';


-- 3. BAIXA DE UM ITEM ----------------------------------------------------------
create or replace function public.pdv_baixar_estoque_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item public.pdv_pedido_itens%rowtype;
  v_pedido public.pdv_pedidos%rowtype;
  v_tipo text;
  v_origem text;
  v_linha record;
  v_disponivel numeric;
  v_unidade_saldo text;
  v_baixa numeric;
  v_achou boolean := false;
begin
  select * into v_item from public.pdv_pedido_itens where id = p_item_id;
  select * into v_pedido from public.pdv_pedidos where id = v_item.pedido_id;
  select tipo_produto into v_tipo from public.ingredientes where id = v_item.produto_id;

  v_origem := case
    when v_pedido.canal = 'mesa' then
      'Mesa ' || coalesce((select numero::text from public.pdv_mesas where id = v_pedido.mesa_id), '')
    else 'Balcão #' || v_pedido.numero
  end;

  for v_linha in
    select f.ingrediente_id, f.quantidade * v_item.quantidade as qtd, f.unidade, i.nome
      from public.ficha_tecnica_itens f
      join public.ingredientes i on i.id = f.ingrediente_id
     where f.produto_acabado_id = v_item.produto_id and v_tipo = 'prato'
    union all
    select v_item.produto_id, v_item.quantidade::numeric, null::text, v_item.nome
     where v_tipo = 'acabado'
  loop
    v_achou := true;
    v_disponivel := null;
    v_unidade_saldo := null;

    select quantidade_disponivel, unidade into v_disponivel, v_unidade_saldo
      from public.estoque_saldo
     where ingrediente_id = v_linha.ingrediente_id and unidade_id = v_pedido.unidade_id;

    -- ficha em kg e estoque em g (por exemplo): não dá para baixar com segurança
    if v_linha.unidade is not null and v_unidade_saldo is not null
       and lower(v_linha.unidade) <> lower(v_unidade_saldo) then
      insert into public.pdv_estoque_pendencias
        (unidade_id, item_id, tipo, produto_id, produto_nome, ingrediente_id, ingrediente_nome,
         quantidade_necessaria, quantidade_baixada, unidade, origem)
      values
        (v_pedido.unidade_id, v_item.id, 'unidade_diferente', v_item.produto_id, v_item.nome,
         v_linha.ingrediente_id, v_linha.nome, v_linha.qtd, 0,
         v_linha.unidade || ' (estoque em ' || v_unidade_saldo || ')', v_origem);
      continue;
    end if;

    v_baixa := greatest(least(coalesce(v_disponivel, 0), v_linha.qtd), 0);

    if v_baixa > 0 then
      insert into public.movimentacoes_estoque (ingrediente_id, unidade_id, tipo, quantidade, observacao)
      values (v_linha.ingrediente_id, v_pedido.unidade_id, 'consumo', v_baixa,
              'Venda PDV: ' || v_item.quantidade || 'x ' || v_item.nome || ' (' || v_origem || ')');
      insert into public.pdv_estoque_baixas (item_id, ingrediente_id, unidade_id, quantidade)
      values (v_item.id, v_linha.ingrediente_id, v_pedido.unidade_id, v_baixa);
    end if;

    if v_baixa < v_linha.qtd then
      insert into public.pdv_estoque_pendencias
        (unidade_id, item_id, tipo, produto_id, produto_nome, ingrediente_id, ingrediente_nome,
         quantidade_necessaria, quantidade_baixada, unidade, origem)
      values
        (v_pedido.unidade_id, v_item.id, 'estoque_insuficiente', v_item.produto_id, v_item.nome,
         v_linha.ingrediente_id, v_linha.nome, v_linha.qtd, v_baixa,
         coalesce(v_linha.unidade, v_unidade_saldo), v_origem);
    end if;
  end loop;

  if not v_achou then
    insert into public.pdv_estoque_pendencias
      (unidade_id, item_id, tipo, produto_id, produto_nome, quantidade_necessaria, origem)
    values
      (v_pedido.unidade_id, v_item.id, 'sem_ficha', v_item.produto_id, v_item.nome, v_item.quantidade, v_origem);
  end if;
end;
$$;


-- 4. DEVOLUÇÃO QUANDO O ITEM SAI DE "PRONTO" ------------------------------------
create or replace function public.pdv_estornar_estoque_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_baixa record;
begin
  for v_baixa in select * from public.pdv_estoque_baixas where item_id = p_item_id loop
    insert into public.movimentacoes_estoque (ingrediente_id, unidade_id, tipo, quantidade, observacao)
    values (v_baixa.ingrediente_id, v_baixa.unidade_id, 'entrada', v_baixa.quantidade,
            'Estorno: item voltou da coluna Pronto na cozinha');
  end loop;

  delete from public.pdv_estoque_baixas where item_id = p_item_id;
  delete from public.pdv_estoque_pendencias where item_id = p_item_id and status = 'aberta';
end;
$$;


-- 5. GATILHO NOS ITENS DO PDV ---------------------------------------------------
create or replace function public.trg_pdv_item_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status_cozinha = 'pronto' and old.status_cozinha is distinct from 'pronto' then
    perform public.pdv_baixar_estoque_item(new.id);
  elsif old.status_cozinha = 'pronto' and new.status_cozinha is distinct from 'pronto' then
    perform public.pdv_estornar_estoque_item(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pdv_item_estoque_au on public.pdv_pedido_itens;
create trigger trg_pdv_item_estoque_au
  after update of status_cozinha on public.pdv_pedido_itens
  for each row execute function public.trg_pdv_item_estoque();
