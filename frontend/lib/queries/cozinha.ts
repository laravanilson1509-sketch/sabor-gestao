// lib/queries/cozinha.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getFilaCozinha(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("vw_fila_cozinha")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("pedido_criado_em", { ascending: true });

  if (error) throw error;
  return data;
}

export async function avancarStatusProducao(
  supabase: SupabaseClient,
  itemId: string,
  status: "fila" | "preparo" | "pronto"
) {
  // o resto acontece sozinho: trigger grava iniciado_em/pronto_em e, quando
  // todos os itens do pedido ficam prontos, o pedido inteiro vira 'pronto'
  const { error } = await supabase
    .from("pedido_itens")
    .update({ status_producao: status })
    .eq("id", itemId);

  if (error) throw error;
}
