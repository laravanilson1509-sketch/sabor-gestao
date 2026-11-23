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
do $$
declare
  v_def text;
  v_velho text := E'  update public.pdv_pedido_itens\n     set status_cozinha = ''novo'', enviado_cozinha_em = now()\n   where id = any(v_ids);';
  v_novo text := E'  -- pratos vão para a cozinha\n'
    || E'  update public.pdv_pedido_itens\n     set status_cozinha = ''novo'', enviado_cozinha_em = now()\n   where id = any(v_ids)\n'
    || E'     and not exists (select 1 from public.ingredientes g where g.id = pdv_pedido_itens.produto_id\n'
    || E'                      and g.tipo_produto in (''acabado'',''bebida''));\n'
    || E'  -- bebida e acabado não passam pela cozinha: ficam "a levar" e já baixam o estoque\n'
    || E'  update public.pdv_pedido_itens\n     set status_cozinha = ''pronto'', enviado_cozinha_em = now(), iniciado_em = now(), pronto_em = now(),\n'
    || E'         entrega_status = ''a_levar''\n   where id = any(v_ids)\n'
    || E'     and exists (select 1 from public.ingredientes g where g.id = pdv_pedido_itens.produto_id\n'
    || E'                  and g.tipo_produto in (''acabado'',''bebida''));';
begin
  v_def := pg_get_functiondef('public.pdv_enviar_producao(uuid,uuid[],uuid)'::regprocedure);
  if position('entrega_status' in v_def) > 0 then
    return; -- já aplicado
  end if;
  if position(v_velho in v_def) = 0 then
    raise exception 'pdv_enviar_producao: trecho esperado não encontrado (rode a 0018 antes)';
  end if;
  execute replace(v_def, v_velho, v_novo);
end $$;

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
