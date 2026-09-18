import type { SupabaseClient } from "@supabase/supabase-js";

// ========== SOLICITAÇÕES ==========

export async function listarSolicitacoes(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("solicitacoes_compra")
    .select("*, fornecedores(nome)")
    .eq("unidade_id", unidadeId)
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function buscarSolicitacao(supabase: SupabaseClient, id: string) {
  const { data: solicitacao, error: e1 } = await supabase
    .from("solicitacoes_compra")
    .select("*, fornecedores(nome)")
    .eq("id", id)
    .single();
  if (e1) throw e1;

  const { data: itens, error: e2 } = await supabase
    .from("solicitacoes_compra_itens")
    .select("*, ingredientes(nome)")
    .eq("solicitacao_id", id);
  if (e2) throw e2;

  const { data: cotacoes, error: e3 } = await supabase
    .from("cotacoes")
    .select("*, fornecedores(nome), cotacoes_itens(*)")
    .eq("solicitacao_id", id);
  if (e3) throw e3;

  return { solicitacao, itens: itens || [], cotacoes: cotacoes || [] };
}

export async function criarSolicitacao(
  supabase: SupabaseClient,
  params: {
    unidade_id: string;
    observacao: string | null;
    itens: { ingrediente_id: string; quantidade: number; unidade: string }[];
  }
) {
  const { data: solicitacao, error: e1 } = await supabase
    .from("solicitacoes_compra")
    .insert({ unidade_id: params.unidade_id, observacao: params.observacao })
    .select("id")
    .single();
  if (e1) throw e1;

  const itensParaInserir = params.itens.map((item) => ({
    solicitacao_id: solicitacao.id,
    ingrediente_id: item.ingrediente_id,
    quantidade: item.quantidade,
    unidade: item.unidade,
  }));

  const { error: e2 } = await supabase.from("solicitacoes_compra_itens").insert(itensParaInserir);
  if (e2) throw e2;

  return solicitacao.id as string;
}

export async function atualizarStatusSolicitacao(
  supabase: SupabaseClient,
  id: string,
  status: string,
  fornecedorEscolhidoId?: string
) {
  const params: Record<string, any> = { status };
  if (fornecedorEscolhidoId) params.fornecedor_escolhido_id = fornecedorEscolhidoId;

  const { error } = await supabase.from("solicitacoes_compra").update(params).eq("id", id);
  if (error) throw error;
}

export async function deletarSolicitacao(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("solicitacoes_compra").delete().eq("id", id);
  if (error) throw error;
}

// ========== COTAÇÕES ==========

export async function criarCotacao(
  supabase: SupabaseClient,
  params: {
    solicitacao_id: string;
    fornecedor_id: string;
    precos: { solicitacao_item_id: string; preco_unitario: number }[];
  }
) {
  const { data: cotacao, error: e1 } = await supabase
    .from("cotacoes")
    .insert({ solicitacao_id: params.solicitacao_id, fornecedor_id: params.fornecedor_id })
    .select("id")
    .single();
  if (e1) throw e1;

  const itensParaInserir = params.precos.map((p) => ({
    cotacao_id: cotacao.id,
    solicitacao_item_id: p.solicitacao_item_id,
    preco_unitario: p.preco_unitario,
  }));

  const { error: e2 } = await supabase.from("cotacoes_itens").insert(itensParaInserir);
  if (e2) throw e2;

  await supabase
    .from("solicitacoes_compra")
    .update({ status: "cotado" })
    .eq("id", params.solicitacao_id)
    .eq("status", "aguardando_cotacao");
}

// ========== UTILITÁRIOS ==========

export function getStatusLabel(status: string) {
  const map: Record<string, { label: string; cor: string; emoji: string }> = {
    aguardando_cotacao: { label: "Aguardando cotação", cor: "text-gray-600 bg-gray-100", emoji: "📝" },
    cotado: { label: "Cotado", cor: "text-blue-600 bg-blue-100", emoji: "💰" },
    aprovado: { label: "Aprovado", cor: "text-purple-600 bg-purple-100", emoji: "✅" },
    pedido_enviado: { label: "Pedido enviado", cor: "text-orange-600 bg-orange-100", emoji: "📤" },
    recebido: { label: "Recebido", cor: "text-green-600 bg-green-100", emoji: "📦" },
    cancelado: { label: "Cancelado", cor: "text-red-600 bg-red-100", emoji: "❌" },
  };
  return map[status] || map.aguardando_cotacao;
}