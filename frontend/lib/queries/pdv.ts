// lib/queries/pdv.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getProdutosPorCategoria(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, preco_venda, categorias_produto(id, nome)")
    .eq("unidade_id", unidadeId)
    .eq("disponivel", true)
    .eq("status", "ativo")
    .order("nome");

  if (error) throw error;
  return data;
}

export async function abrirPedido(
  supabase: SupabaseClient,
  params: { unidadeId: string; canal: "salao" | "mesa" | "balcao" | "delivery"; mesaId?: string; caixaId?: string }
) {
  const { data, error } = await supabase
    .from("pedidos")
    .insert({
      unidade_id: params.unidadeId,
      canal: params.canal,
      mesa_id: params.mesaId ?? null,
      caixa_id: params.caixaId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function adicionarItemAoPedido(
  supabase: SupabaseClient,
  params: { pedidoId: string; produtoId: string; quantidade: number; precoUnitario: number }
) {
  const { error } = await supabase.from("pedido_itens").insert({
    pedido_id: params.pedidoId,
    produto_id: params.produtoId,
    quantidade: params.quantidade,
    preco_unitario: params.precoUnitario,
  });

  if (error) throw error;
  // o total do pedido é recalculado sozinho pelo trigger trg_pedido_item_aiud —
  // não precisa (nem deve) somar o total manualmente aqui
}

export async function removerItemDoPedido(supabase: SupabaseClient, itemId: string) {
  const { error } = await supabase.from("pedido_itens").delete().eq("id", itemId);
  if (error) throw error;
}

export async function aplicarCupom(supabase: SupabaseClient, pedidoId: string, codigo: string) {
  // chama a função aplicar_cupom() do banco — valida tudo lá (validade, uso
  // máximo, valor mínimo) e já recalcula o total do pedido
  const { error } = await supabase.rpc("aplicar_cupom", { p_pedido_id: pedidoId, p_codigo: codigo });
  if (error) throw error;
}

export async function enviarParaCozinha(supabase: SupabaseClient, pedidoId: string) {
  // dispara a fila de produção (o item some do estado 'aberto' do PDV e
  // aparece no KDS)
  const { error } = await supabase.from("pedidos").update({ status: "confirmado" }).eq("id", pedidoId);
  if (error) throw error;
}

export async function finalizarPedidoBalcao(
  supabase: SupabaseClient,
  pedidoId: string,
  formaPagamento: string
) {
  // venda de balcão simples: pula direto pra 'entregue' — dispara em cascata
  // a baixa de estoque, a conta a receber e o lançamento no fluxo de caixa
  const { error } = await supabase
    .from("pedidos")
    .update({ status: "entregue", forma_pagamento: formaPagamento })
    .eq("id", pedidoId);

  if (error) throw error;
}
