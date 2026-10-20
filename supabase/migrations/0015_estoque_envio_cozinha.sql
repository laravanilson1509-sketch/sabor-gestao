-- =============================================================================
-- Falta de estoque passa a ser avisada no PDV, antes de enviar para a cozinha
-- =============================================================================
-- 1. pdv_pedido_itens.sem_estoque: o atendente enviou mesmo sem estoque no
--    sistema (a cozinha vê "Conferir estoque" e o gerente recebe a pendência).
-- 2. A baixa no "Pronto" não cria mais pendência de estoque insuficiente:
--    só baixa o que tiver. Sem ficha e unidade diferente continuam.
-- 3. O "Voltar" da cozinha não apaga a pendência criada no envio pelo PDV.
-- =============================================================================

alter table public.pdv_pedido_itens
  add column if not exists sem_estoque boolean not null default false;


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

    -- baixa só o que tiver: a falta já foi avisada no PDV
    v_baixa := greatest(least(coalesce(v_disponivel, 0), v_linha.qtd), 0);

    if v_baixa > 0 then
      insert into public.movimentacoes_estoque (ingrediente_id, unidade_id, tipo, quantidade, observacao)
      values (v_linha.ingrediente_id, v_pedido.unidade_id, 'consumo', v_baixa,
              'Venda PDV: ' || v_item.quantidade || 'x ' || v_item.nome || ' (' || v_origem || ')');
      insert into public.pdv_estoque_baixas (item_id, ingrediente_id, unidade_id, quantidade)
      values (v_item.id, v_linha.ingrediente_id, v_pedido.unidade_id, v_baixa);
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
  -- a pendência de estoque insuficiente vem do envio no PDV e continua valendo
  delete from public.pdv_estoque_pendencias
   where item_id = p_item_id and status = 'aberta'
     and tipo in ('sem_ficha','unidade_diferente');
end;
$$;


-- =============================================================================
-- Regras de acesso (RLS) das tabelas novas — o Supabase ligou o RLS sem regras,
-- o que bloqueava tudo. Mesmo padrão de pdv_pedidos/pdv_pedido_itens (acesso
-- liberado); a revisão de segurança de todas as tabelas fica para depois.
-- =============================================================================

drop policy if exists pdv_caixas_all on public.pdv_caixas;
create policy pdv_caixas_all on public.pdv_caixas for all using (true) with check (true);

drop policy if exists pdv_caixa_mov_all on public.pdv_caixa_movimentacoes;
create policy pdv_caixa_mov_all on public.pdv_caixa_movimentacoes for all using (true) with check (true);

drop policy if exists pdv_estoque_baixas_all on public.pdv_estoque_baixas;
create policy pdv_estoque_baixas_all on public.pdv_estoque_baixas for all using (true) with check (true);

drop policy if exists pdv_estoque_pendencias_all on public.pdv_estoque_pendencias;
create policy pdv_estoque_pendencias_all on public.pdv_estoque_pendencias for all using (true) with check (true);
