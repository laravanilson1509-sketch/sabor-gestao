-- =============================================================================
-- Bebidas e produtos acabados: não passam pela Cozinha
-- =============================================================================
-- O garçom lança o item; ele fica "a levar" (vermelho no card da mesa) até o garçom
-- confirmar que levou. O estoque baixa NA HORA DO LANÇAMENTO (o item entra como 'pronto',
-- e o gatilho de baixa que já existe cuida do resto, inclusive devolver se cancelar).
-- Se a conta fechar com item ainda "a levar", ela fecha normal e fica o registro para
-- conferir no inventário (tela Estoque > Entregas).
-- Rode este arquivo inteiro no SQL Editor do Supabase (pode rodar de novo sem problema).
-- =============================================================================

-- 1. COLUNAS -------------------------------------------------------------------
alter table public.pdv_pedido_itens
  add column if not exists entrega_status text check (entrega_status in ('a_levar','entregue')),
  add column if not exists entrega_em timestamptz,   -- quando o garçom confirmou
  add column if not exists entrega_por text;         -- login de quem confirmou

create index if not exists idx_pdv_itens_entrega
  on public.pdv_pedido_itens (entrega_status)
  where entrega_status is not null;

-- 2. ENVIO PARA A PRODUÇÃO: bebida/acabado entram como "a levar" -----------------
-- (a função inteira é recriada; o restante é igual ao da 0018)
create or replace function public.pdv_enviar_producao(
  p_pedido uuid, p_itens_sem_estoque uuid[], p_terminal uuid
) returns int language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_cfg public.pdv_config;
  v_acrescimo boolean;
  v_ids uuid[];
  v_setor record;
  v_qtd int := 0;
begin
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Este pedido não está aberto.'; end if;

  perform public.pdv_garantir_setores(p.unidade_id);
  v_cfg := public.pdv_obter_config(p.unidade_id);

  v_acrescimo := exists (
    select 1 from public.pdv_pedido_itens
     where pedido_id = p_pedido and status_cozinha is not null and not cancelado);

  select array_agg(id) into v_ids from public.pdv_pedido_itens
   where pedido_id = p_pedido and status_cozinha is null and not cancelado;
  if v_ids is null then return 0; end if;

  update public.pdv_pedido_itens
     set sem_estoque = true
   where id = any(v_ids) and id = any(coalesce(p_itens_sem_estoque, '{}'));

  -- pratos vão para a cozinha
  update public.pdv_pedido_itens
     set status_cozinha = 'novo', enviado_cozinha_em = now()
   where id = any(v_ids)
     and not exists (select 1 from public.ingredientes g where g.id = pdv_pedido_itens.produto_id
                      and g.tipo_produto in ('acabado','bebida'));

  -- bebida e acabado não passam pela cozinha: ficam "a levar" e já baixam o estoque
  update public.pdv_pedido_itens
     set status_cozinha = 'pronto', enviado_cozinha_em = now(), iniciado_em = now(), pronto_em = now(),
         entrega_status = 'a_levar'
   where id = any(v_ids)
     and exists (select 1 from public.ingredientes g where g.id = pdv_pedido_itens.produto_id
                  and g.tipo_produto in ('acabado','bebida'));
  v_qtd := array_length(v_ids, 1);

  if not v_cfg.imprimir_producao_auto then return v_qtd; end if;

  -- um ticket por setor (sem setor padrão, sai como "Produção" e fica sem impressora)
  for v_setor in
    select s.id, coalesce(s.nome, 'Produção') as nome,
           jsonb_agg(jsonb_build_object(
             'quantidade', i.quantidade, 'nome', i.nome, 'observacao', i.observacao,
             'restricao', i.restricao, 'adicionais', i.adicionais, 'sem_estoque', i.sem_estoque)
             order by i.criado_em) as itens
      from public.pdv_pedido_itens i
      left join public.ingredientes g on g.id = i.produto_id
      left join public.pdv_setores s on s.id = coalesce(
             (select id from public.pdv_setores where id = g.setor_id and ativo),
             (select id from public.pdv_setores where unidade_id = p.unidade_id and padrao limit 1))
     where i.id = any(v_ids)
     group by s.id, s.nome
  loop
    perform public.pdv_enfileirar(
      p.unidade_id, 'producao', p.id, v_setor.id, p_terminal,
      (public.pdv_identificacao(p) ->> 'rotulo') || ' · ' || v_setor.nome,
      jsonb_build_object(
        'setor', v_setor.nome,
        'identificacao', public.pdv_identificacao(p),
        'acrescimo', v_acrescimo,
        'emitido_em', now(),
        'operador', auth.jwt() ->> 'email',
        'terminal', public.pdv_nome_terminal(p_terminal),
        'itens', v_setor.itens));
  end loop;

  return v_qtd;
end;
$$;


-- 3. ITENS QUE JÁ ESTAVAM PARADOS NA COZINHA ------------------------------------
-- (pedidos abertos) viram "a levar" e baixam o estoque agora
update public.pdv_pedido_itens i
   set status_cozinha = 'pronto', pronto_em = now(), entrega_status = 'a_levar'
 where i.status_cozinha in ('novo','preparando')
   and not i.cancelado
   and exists (select 1 from public.ingredientes g where g.id = i.produto_id and g.tipo_produto in ('acabado','bebida'))
   and exists (select 1 from public.pdv_pedidos p where p.id = i.pedido_id and p.status = 'aberto');

-- os que a cozinha já tinha marcado como pronto (e já baixaram) só saem da fila da cozinha
update public.pdv_pedido_itens i
   set entrega_status = 'entregue', entrega_em = now()
 where i.status_cozinha = 'pronto' and i.entrega_status is null and i.retirado_em is null
   and exists (select 1 from public.ingredientes g where g.id = i.produto_id and g.tipo_produto in ('acabado','bebida'));
