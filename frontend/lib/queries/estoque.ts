// lib/queries/estoque.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getEstoqueAlertas(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("vw_estoque_alertas")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("nome");

  if (error) throw error;
  return data;
}

export async function buscarIngredientes(supabase: SupabaseClient, unidadeId: string, termo: string) {
  const { data, error } = await supabase
    .from("ingredientes")
    .select("id, nome, estoque_minimo, estoque_maximo, unidade_medida, estoque_saldo(quantidade_atual)")
    .eq("unidade_id", unidadeId)
    .ilike("nome", `%${termo}%`)
    .order("nome");

  if (error) throw error;
  return data;
}

export async function registrarMovimentacao(
  supabase: SupabaseClient,
  params: {
    unidadeId: string;
    ingredienteId: string;
    tipo: "entrada" | "saida" | "ajuste" | "perda" | "inventario";
    quantidade: number;
    custoUnitario?: number;
    motivo?: string;
  }
) {
  // 'entrada' com custoUnitario recalcula o custo médio e propaga pras fichas
  // técnicas sozinho — não precisa (nem deve) atualizar o custo do ingrediente
  // manualmente depois desta chamada
  const { error } = await supabase.from("movimentacoes_estoque").insert({
    unidade_id: params.unidadeId,
    ingrediente_id: params.ingredienteId,
    tipo: params.tipo,
    quantidade: params.quantidade,
    custo_unitario: params.custoUnitario ?? null,
    motivo: params.motivo ?? null,
  });

  if (error) throw error;
}
