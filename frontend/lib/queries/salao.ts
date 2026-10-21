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
  subtotal: number;
  desconto: number;
  desconto_pct: number | null;
  desconto_motivo: string | null;
  taxa_servico_pct: number;
  taxa_servico: number;
  pessoas: number;
  para_viagem: boolean;
  pre_conta_em: string | null;
  reaberturas: number;
};

export type ItemPdv = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao: string | null;
  // null = ainda não foi enviado para a cozinha
  status_cozinha: 'novo' | 'preparando' | 'pronto' | null;
  restricao: string | null;
  adicionais: { nome: string; valor: number }[];
  cortesia: boolean;
  cancelado: boolean;
  cancelado_motivo: string | null;
  cancelado_por: string | null;
};

// valor cobrado de uma linha da comanda (igual a pdv_valor_item no banco)
export const valorItem = (i: ItemPdv) =>
  i.cancelado || i.cortesia
    ? 0
    : i.quantidade * (Number(i.preco_unitario) + (i.adicionais || []).reduce((s, a) => s + Number(a.valor || 0), 0));

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

const CAMPOS_PEDIDO =
  'id, numero, canal, mesa_id, nome_cliente, status, forma_pagamento, total, criado_em, subtotal, desconto, desconto_pct, desconto_motivo, taxa_servico_pct, taxa_servico, pessoas, para_viagem, pre_conta_em, reaberturas';

export async function buscarPedido(supabase: SupabaseClient, pedidoId: string) {
  const { data, error } = await supabase.from('pdv_pedidos').select(CAMPOS_PEDIDO).eq('id', pedidoId).single();
  if (error) throw error;
  return data as PedidoPdv;
}

export async function listarPedidosAbertos(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_pedidos')
    .select(CAMPOS_PEDIDO)
    .eq('unidade_id', unidadeId)
    .eq('status', 'aberto')
    .order('criado_em');
  if (error) throw error;
  return (data || []) as PedidoPdv[];
}

export async function abrirPedido(
  supabase: SupabaseClient,
  params: { unidadeId: string; canal: 'mesa' | 'balcao'; mesaId?: string; paraViagem?: boolean }
) {
  const { data, error } = await supabase
    .from('pdv_pedidos')
    .insert({
      unidade_id: params.unidadeId,
      canal: params.canal,
      mesa_id: params.mesaId ?? null,
      para_viagem: params.paraViagem ?? false,
    })
    .select(CAMPOS_PEDIDO)
    .single();
  if (error) throw error;
  return data as PedidoPdv;
}

export async function listarItens(supabase: SupabaseClient, pedidoId: string) {
  const { data, error } = await supabase
    .from('pdv_pedido_itens')
    .select('id, pedido_id, produto_id, nome, quantidade, preco_unitario, observacao, status_cozinha, restricao, adicionais, cortesia, cancelado, cancelado_motivo, cancelado_por')
    .eq('pedido_id', pedidoId)
    .order('criado_em');
  if (error) throw error;
  return (data || []) as ItemPdv[];
}

export async function adicionarItem(
  supabase: SupabaseClient,
  params: { pedidoId: string; produto: ProdutoCardapio }
) {
  // se o mesmo produto já está na comanda (sem observação e ainda não foi
  // para a cozinha), só aumenta a quantidade
  const { data: existente, error: erroBusca } = await supabase
    .from('pdv_pedido_itens')
    .select('id, quantidade')
    .eq('pedido_id', params.pedidoId)
    .eq('produto_id', params.produto.id)
    .is('observacao', null)
    .is('restricao', null)
    .eq('adicionais', '[]')
    .is('status_cozinha', null)
    .limit(1)
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

// ---------- Reservas ----------

export type Reserva = {
  id: string;
  mesa_id: string;
  nome_cliente: string;
  telefone: string | null;
  pessoas: number;
  data_hora: string;
  observacao: string | null;
  status: 'ativa' | 'concluida' | 'cancelada';
};

export async function listarReservasAtivas(supabase: SupabaseClient, unidadeId: string) {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('pdv_reservas')
    .select('id, mesa_id, nome_cliente, telefone, pessoas, data_hora, observacao, status')
    .eq('unidade_id', unidadeId)
    .eq('status', 'ativa')
    .gte('data_hora', inicioHoje.toISOString())
    .order('data_hora');
  if (error) throw error;
  return (data || []) as Reserva[];
}

export async function criarReserva(
  supabase: SupabaseClient,
  params: {
    unidadeId: string;
    mesaId: string;
    nomeCliente: string;
    telefone?: string;
    pessoas: number;
    dataHora: string; // ISO
    observacao?: string;
  }
) {
  // impede duas reservas na mesma mesa com menos de 2 horas de diferença
  const t = new Date(params.dataHora).getTime();
  const de = new Date(t - 2 * 3600000).toISOString();
  const ate = new Date(t + 2 * 3600000).toISOString();
  const { data: conflito, error: erroConflito } = await supabase
    .from('pdv_reservas')
    .select('id')
    .eq('mesa_id', params.mesaId)
    .eq('status', 'ativa')
    .gt('data_hora', de)
    .lt('data_hora', ate)
    .limit(1);
  if (erroConflito) throw erroConflito;
  if (conflito && conflito.length > 0) {
    throw new Error('Essa mesa já tem reserva em um horário próximo (menos de 2 horas).');
  }

  const { error } = await supabase.from('pdv_reservas').insert({
    unidade_id: params.unidadeId,
    mesa_id: params.mesaId,
    nome_cliente: params.nomeCliente,
    telefone: params.telefone || null,
    pessoas: params.pessoas,
    data_hora: params.dataHora,
    observacao: params.observacao || null,
  });
  if (error) throw error;
}

export async function atualizarStatusReserva(
  supabase: SupabaseClient,
  reservaId: string,
  status: 'concluida' | 'cancelada'
) {
  const { error } = await supabase
    .from('pdv_reservas')
    .update({ status })
    .eq('id', reservaId);
  if (error) throw error;
}
// balcão: comer aqui (senha) ou levar (retirada) — sai assim no ticket
export async function definirParaViagem(supabase: SupabaseClient, pedidoId: string, paraViagem: boolean) {
  const { error } = await supabase.from('pdv_pedidos').update({ para_viagem: paraViagem }).eq('id', pedidoId);
  if (error) throw error;
}
