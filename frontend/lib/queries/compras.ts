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
    origem?: "manual" | "sugestao";
    itens: { ingrediente_id: string; quantidade: number; unidade: string }[];
  }
) {
  const { data: solicitacao, error: e1 } = await supabase
    .from("solicitacoes_compra")
    .insert({ unidade_id: params.unidade_id, observacao: params.observacao, origem: params.origem ?? "manual" })
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
    prazo_entrega_dias?: number | null;
    condicoes_pagamento?: string | null;
    precos: { solicitacao_item_id: string; preco_unitario: number }[];
  }
) {
  // uma cotação por fornecedor: cotar de novo substitui a anterior
  const { error: e0 } = await supabase
    .from("cotacoes")
    .delete()
    .eq("solicitacao_id", params.solicitacao_id)
    .eq("fornecedor_id", params.fornecedor_id);
  if (e0) throw e0;

  const { data: cotacao, error: e1 } = await supabase
    .from("cotacoes")
    .insert({
      solicitacao_id: params.solicitacao_id,
      fornecedor_id: params.fornecedor_id,
      prazo_entrega_dias: params.prazo_entrega_dias ?? null,
      condicoes_pagamento: params.condicoes_pagamento?.trim() || null,
    })
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

export async function deletarCotacao(supabase: SupabaseClient, cotacaoId: string, solicitacaoId: string) {
  const { error } = await supabase.from("cotacoes").delete().eq("id", cotacaoId);
  if (error) throw error;
  // sem nenhuma cotação, a solicitação volta a aguardar
  const { count } = await supabase
    .from("cotacoes")
    .select("id", { count: "exact", head: true })
    .eq("solicitacao_id", solicitacaoId);
  if (!count) {
    await supabase
      .from("solicitacoes_compra")
      .update({ status: "aguardando_cotacao" })
      .eq("id", solicitacaoId)
      .eq("status", "cotado");
  }
}

// ========== SUGESTÃO DE COMPRA (estoque mínimo) ==========

export type SugestaoCompra = {
  ingrediente_id: string;
  nome: string;
  unidade: string;
  disponivel: number;
  minimo: number;
  sugerido: number; // quanto comprar para chegar a 2x o mínimo
  jaSolicitado: boolean; // já está em uma solicitação em andamento
};

const STATUS_EM_ANDAMENTO = ["aguardando_cotacao", "cotado", "aprovado", "pedido_enviado"];
const TIPOS_COMPRAVEIS = ["ingrediente", "acabado", "bebida"];

export async function sugerirCompra(supabase: SupabaseClient, unidadeId: string): Promise<SugestaoCompra[]> {
  const { data, error } = await supabase
    .from("estoque_saldo")
    .select("quantidade_disponivel, estoque_minimo, unidade, ingredientes(id, nome, tipo_produto, ativo)")
    .eq("unidade_id", unidadeId)
    .gt("estoque_minimo", 0);
  if (error) throw error;

  // o que já está pedido em solicitações em andamento (se o SQL de compras ainda não foi rodado, segue sem isso)
  const emAndamento = new Set<string>();
  const { data: itensAbertos, error: erroAbertos } = await supabase
    .from("solicitacoes_compra_itens")
    .select("ingrediente_id, solicitacoes_compra!inner(status, unidade_id)")
    .eq("solicitacoes_compra.unidade_id", unidadeId)
    .in("solicitacoes_compra.status", STATUS_EM_ANDAMENTO);
  if (!erroAbertos) for (const i of itensAbertos || []) emAndamento.add((i as any).ingrediente_id);

  return ((data || []) as any[])
    .filter((r) => r.ingredientes && r.ingredientes.ativo !== false && TIPOS_COMPRAVEIS.includes(r.ingredientes.tipo_produto))
    .filter((r) => Number(r.quantidade_disponivel) <= Number(r.estoque_minimo))
    .map((r) => {
      const disponivel = Number(r.quantidade_disponivel) || 0;
      const minimo = Number(r.estoque_minimo) || 0;
      return {
        ingrediente_id: r.ingredientes.id,
        nome: r.ingredientes.nome,
        unidade: r.unidade || "un",
        disponivel,
        minimo,
        sugerido: Math.max(Math.ceil((minimo * 2 - disponivel) * 100) / 100, minimo),
        jaSolicitado: emAndamento.has(r.ingredientes.id),
      };
    })
    .sort((a, b) => a.disponivel / a.minimo - b.disponivel / b.minimo);
}

// ========== RECEBIMENTO COM CONFERÊNCIA ==========

export type ItemConferido = {
  item_id: string;
  qtd_recebida: number;
  preco_unitario: number;
  observacao: string;
};

export async function receberCompra(
  supabase: SupabaseClient,
  params: {
    solicitacaoId: string;
    numeroNota: string;
    dataRecebimento: string;
    vencimento: string | null;
    observacao: string;
    itens: ItemConferido[];
  }
) {
  const { data, error } = await supabase.rpc("compra_receber", {
    p_solicitacao: params.solicitacaoId,
    p_numero_nota: params.numeroNota || null,
    p_data_recebimento: params.dataRecebimento || null,
    p_vencimento: params.vencimento || null,
    p_observacao: params.observacao || null,
    p_itens: params.itens,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function buscarRecebimento(supabase: SupabaseClient, solicitacaoId: string) {
  const { data: rec, error } = await supabase
    .from("compra_recebimentos")
    .select("*")
    .eq("solicitacao_id", solicitacaoId)
    .maybeSingle();
  if (error || !rec) return null;
  const { data: itens } = await supabase
    .from("compra_recebimento_itens")
    .select("*, ingredientes(nome)")
    .eq("recebimento_id", rec.id);
  return { recebimento: rec as any, itens: (itens || []) as any[] };
}

// ========== HISTÓRICO DE PREÇOS ==========

export type PontoPreco = {
  ingrediente_id: string;
  fornecedor_id: string | null;
  fornecedor: string | null;
  data: string;
  preco_unitario: number;
  unidade: string;
  origem: "nota" | "cotacao";
};

export async function listarHistoricoPrecos(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("compras_historico_precos")
    .select("ingrediente_id, fornecedor_id, fornecedor, data, preco_unitario, unidade, origem")
    .eq("unidade_id", unidadeId)
    .order("data");
  if (error) throw error;
  const pontos = ((data || []) as any[]).map((p) => ({ ...p, preco_unitario: Number(p.preco_unitario) })) as PontoPreco[];

  const ids = [...new Set(pontos.map((p) => p.ingrediente_id))];
  const nomes = new Map<string, string>();
  if (ids.length > 0) {
    const { data: ings } = await supabase.from("ingredientes").select("id, nome").in("id", ids);
    for (const i of ings || []) nomes.set(i.id, i.nome);
  }
  return { pontos, nomes };
}

// ========== UTILITÁRIOS ==========

export function getStatusLabel(status: string) {
  const map: Record<string, { label: string; cor: string; emoji: string }> = {
    aguardando_cotacao: { label: "Aguardando cotação", cor: "text-[#5B6B73] bg-[#E3E9EC]", emoji: "📝" },
    cotado: { label: "Cotado", cor: "text-[#0B4F5E] bg-[#DCEEF2]", emoji: "💰" },
    aprovado: { label: "Aprovado", cor: "text-[#3F3A8C] bg-[#E6E4F7]", emoji: "✅" },
    pedido_enviado: { label: "Pedido enviado", cor: "text-[#7A5A0A] bg-[#FFF0C7]", emoji: "📤" },
    recebido: { label: "Recebido", cor: "text-[#1E6B3F] bg-[#D9F0E3]", emoji: "📦" },
    cancelado: { label: "Cancelado", cor: "text-[#B3261E] bg-[#FADBD6]", emoji: "❌" },
  };
  return map[status] || map.aguardando_cotacao;
}