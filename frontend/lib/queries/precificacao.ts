// lib/queries/precificacao.ts

import type { SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------
// Custos fixos
// -----------------------------------------------------------------------

export async function getCustosFixos(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("custos_fixos")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("criado_em");

  if (error) throw error;
  return data;
}

export async function criarCustoFixo(
  supabase: SupabaseClient,
  params: { unidadeId: string; nome: string; valorMensal: number }
) {
  // insert dispara trg_custos_fixos_aiud -> recalcula todas as fichas
  // técnicas da unidade sozinho (custo_fixo_rateado, preco_sugerido, margem)
  const { data, error } = await supabase
    .from("custos_fixos")
    .insert({ unidade_id: params.unidadeId, nome: params.nome, valor_mensal: params.valorMensal })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarCustoFixo(
  supabase: SupabaseClient,
  id: string,
  params: Partial<{ nome: string; valorMensal: number; ativo: boolean }>
) {
  const { error } = await supabase
    .from("custos_fixos")
    .update({
      ...(params.nome !== undefined && { nome: params.nome }),
      ...(params.valorMensal !== undefined && { valor_mensal: params.valorMensal }),
      ...(params.ativo !== undefined && { ativo: params.ativo }),
    })
    .eq("id", id);

  if (error) throw error;
}

// desativar (não exclui o histórico) — é o caminho recomendado no dia a dia
export async function desativarCustoFixo(supabase: SupabaseClient, id: string) {
  await atualizarCustoFixo(supabase, id, { ativo: false });
}

// exclusão definitiva — só para lançamentos criados por engano
export async function excluirCustoFixo(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("custos_fixos").delete().eq("id", id);
  if (error) throw error;
}

// -----------------------------------------------------------------------
// Configuração de precificação (1 linha por unidade)
// -----------------------------------------------------------------------

export async function getConfiguracaoPrecificacao(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("configuracoes_precificacao")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (error) throw error;
  return data; // null se a unidade ainda não configurou nada — trate como zerado na UI
}

export async function salvarConfiguracaoPrecificacao(
  supabase: SupabaseClient,
  params: {
    unidadeId: string;
    faturamentoMedioMensalEstimado: number;
    percentualImpostos: number;
    percentualTaxasCartao: number;
    margemLucroDesejadaPct: number;
  }
) {
  // upsert: a tabela tem unidade_id como chave primária, então isso cria
  // na primeira vez e atualiza nas seguintes — dispara trg_config_precificacao_au,
  // que recalcula toda a ficha técnica do cardápio
  const { error } = await supabase.from("configuracoes_precificacao").upsert({
    unidade_id: params.unidadeId,
    faturamento_medio_mensal_estimado: params.faturamentoMedioMensalEstimado,
    percentual_impostos: params.percentualImpostos,
    percentual_taxas_cartao: params.percentualTaxasCartao,
    margem_lucro_desejada_pct: params.margemLucroDesejadaPct,
  });

  if (error) throw error;
}
