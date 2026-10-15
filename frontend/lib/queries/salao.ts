// lib/queries/salao.ts — PDV e Mesas (tabelas pdv_*)

import type { SupabaseClient } from '@supabase/supabase-js';

export type Mesa = {
  id: string;
  numero: number;
  capacidade: number;
  ativo: boolean;
};

export type PedidoPdv = {
  id: string;
  numero: number;
  canal: 'mesa' | 'balcao';
  mesa_id: string | null;
  nome_cliente: string | null;
  status: 'aberto' | 'fechado' | 'cancelado';
  forma_pagamento: string | null;
  total: number;
  criado_em: string;
};

export type ItemPdv = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao: string | null;
};

export type ProdutoCardapio = {
  id: string;
  nome: string;
  preco_venda: number;
  tipo_produto: string;
};

export const FORMAS_PAGAMENTO = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'cartao_credito', rotulo: 'Cartão de crédito' },
  { valor: 'cartao_debito', rotulo: 'Cartão de débito' },
  { valor: 'vale_refeicao', rotulo: 'Vale refeição' },
  { valor: 'outro', rotulo: 'Outro' },
];

// ---------- Mesas ----------

export async function listarMesas(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_mesas')
    .select('id, numero, capacidade, ativo')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .order('numero');
  if (error) throw error;
  return (data || []) as Mesa[];
}

export async function criarMesa(
  supabase: SupabaseClient,
  unidadeId: string,
  numero: number,
  capacidade: number
) {
  const { error } = await supabase
    .from('pdv_mesas')
    .insert({ unidade_id: unidadeId, numero, capacidade });
  if (error) {
    if (error.code === '23505') throw new Error('Já existe uma mesa com esse número.');
    throw error;
  }
}

export async function excluirMesa(supabase: SupabaseClient, mesaId: string) {
  const { error } = await supabase.from('pdv_mesas').delete().eq('id', mesaId);
  if (error) throw error;
}

// ---------- Cardápio (pratos e acabados com preço) ----------

export async function listarCardapioPdv(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('ingredientes')
    .select('id, nome, preco_venda, tipo_produto')
    .in('tipo_produto', ['prato', 'acabado'])
    .eq('ativo', true)
    .gt('preco_venda', 0)
    .order('nome');
  if (error) throw error;
  return (data || []) as ProdutoCardapio[];
}

// ---------- Pedidos ----------

export async function listarPedidosAbertos(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_pedidos')
    .select('id, numero, canal, mesa_id, nome_cliente, status, forma_pagamento, total, criado_em')
    .eq('unidade_id', unidadeId)
    .eq('status', 'aberto')
    .order('criado_em');
  if (error) throw error;
  return (data || []) as PedidoPdv[];
}

export async function abrirPedido(
  supabase: SupabaseClient,
  params: { unidadeId: string; canal: 'mesa' | 'balcao'; mesaId?: string }
) {
  const { data, error } = await supabase
    .from('pdv_pedidos')
    .insert({
      unidade_id: params.unidadeId,
      canal: params.canal,
      mesa_id: params.mesaId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PedidoPdv;
}

export async function listarItens(supabase: SupabaseClient, pedidoId: string) {
  const { data, error } = await supabase
    .from('pdv_pedido_itens')
    .select('id, pedido_id, produto_id, nome, quantidade, preco_unitario, observacao')
    .eq('pedido_id', pedidoId)
    .order('criado_em');
  if (error) throw error;
  return (data || []) as ItemPdv[];
}

export async function adicionarItem(
  supabase: SupabaseClient,
  params: { pedidoId: string; produto: ProdutoCardapio }
) {
  // se o mesmo produto já está na comanda, só aumenta a quantidade
  const { data: existente, error: erroBusca } = await supabase
    .from('pdv_pedido_itens')
    .select('id, quantidade')
    .eq('pedido_id', params.pedidoId)
    .eq('produto_id', params.produto.id)
    .is('observacao', null)
    .maybeSingle();
  if (erroBusca) throw erroBusca;

  if (existente) {
    const { error } = await supabase
      .from('pdv_pedido_itens')
      .update({ quantidade: existente.quantidade + 1 })
      .eq('id', existente.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('pdv_pedido_itens').insert({
    pedido_id: params.pedidoId,
    produto_id: params.produto.id,
    nome: params.produto.nome,
    quantidade: 1,
    preco_unitario: Number(params.produto.preco_venda),
  });
  if (error) throw error;
}

export async function alterarQuantidade(
  supabase: SupabaseClient,
  itemId: string,
  quantidade: number
) {
  if (quantidade <= 0) {
    const { error } = await supabase.from('pdv_pedido_itens').delete().eq('id', itemId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('pdv_pedido_itens')
    .update({ quantidade })
    .eq('id', itemId);
  if (error) throw error;
}

export async function fecharPedido(
  supabase: SupabaseClient,
  pedidoId: string,
  formaPagamento: string
) {
  const { error } = await supabase
    .from('pdv_pedidos')
    .update({
      status: 'fechado',
      forma_pagamento: formaPagamento,
      fechado_em: new Date().toISOString(),
    })
    .eq('id', pedidoId);
  if (error) throw error;
}

export async function cancelarPedido(supabase: SupabaseClient, pedidoId: string) {
  const { error } = await supabase
    .from('pdv_pedidos')
    .update({ status: 'cancelado', fechado_em: new Date().toISOString() })
    .eq('id', pedidoId);
  if (error) throw error;
}