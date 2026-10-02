import type { SupabaseClient } from "@supabase/supabase-js";

export type ItemFicha = {
  id: string;
  ingrediente_id: string;
  quantidade: number;
  unidade: string;
  ingredientes: { nome: string } | null;
  custo_unitario: number;
};

export async function listarPratos(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("ingredientes")
    .select("id, nome, preco_venda, ativo")
    .eq("tipo_produto", "prato")
    .order("nome");
  if (error) throw error;
  return data || [];
}

export async function getFichaTecnica(supabase: SupabaseClient, produtoId: string, unidadeId: string) {
  const { data: itens, error } = await supabase
    .from("ficha_tecnica_itens")
    .select("id, ingrediente_id, quantidade, unidade, ingredientes(nome)")
    .eq("produto_acabado_id", produtoId);
  if (error) throw error;

  const ids = (itens || []).map((i: any) => i.ingrediente_id);
  let custos: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: estoques } = await supabase
      .from("estoque_saldo")
      .select("ingrediente_id, custo_unitario")
      .eq("unidade_id", unidadeId)
      .in("ingrediente_id", ids);
    (estoques || []).forEach((e: any) => {
      custos[e.ingrediente_id] = Number(e.custo_unitario) || 0;
    });
  }

  const itensComCusto: ItemFicha[] = (itens || []).map((i: any) => ({
    ...i,
    custo_unitario: custos[i.ingrediente_id] || 0,
  }));

  const custoTotal = itensComCusto.reduce((acc, i) => acc + i.quantidade * i.custo_unitario, 0);

  return { itens: itensComCusto, custoTotal };
}

export async function listarIngredientesConsumo(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("ingredientes")
    .select("id, nome, unidade_padrao")
    .eq("tipo_produto", "ingrediente")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data || [];
}

export async function adicionarItemFicha(
  supabase: SupabaseClient,
  params: { produto_acabado_id: string; ingrediente_id: string; quantidade: number; unidade: string }
) {
  const { error } = await supabase.from("ficha_tecnica_itens").insert(params);
  if (error) throw error;
}

export async function removerItemFicha(supabase: SupabaseClient, itemId: string) {
  const { error } = await supabase.from("ficha_tecnica_itens").delete().eq("id", itemId);
  if (error) throw error;
}

export async function salvarPrecoVenda(supabase: SupabaseClient, produtoId: string, preco: number) {
  const { error } = await supabase
    .from("ingredientes")
    .update({ preco_venda: preco })
    .eq("id", produtoId);
  if (error) throw error;
}

export function calcularMargem(custoTotal: number, precoVenda: number) {
  if (!precoVenda) return { margemReais: 0, margemPct: 0 };
  const margemReais = precoVenda - custoTotal;
  const margemPct = (margemReais / precoVenda) * 100;
  return { margemReais, margemPct };
}