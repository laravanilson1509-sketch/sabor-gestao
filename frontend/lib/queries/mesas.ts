// lib/queries/mesas.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMesas(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("mesas")
    .select("id, numero, capacidade, status, pessoas_atual")
    .eq("unidade_id", unidadeId)
    .order("numero");

  if (error) throw error;
  return data;
}

export async function atualizarStatusMesa(
  supabase: SupabaseClient,
  mesaId: string,
  status: "livre" | "ocupada" | "aguardando_pagamento",
  pessoas?: number
) {
  const { error } = await supabase
    .from("mesas")
    .update({ status, pessoas_atual: status === "livre" ? 0 : pessoas ?? 1 })
    .eq("id", mesaId);

  if (error) throw error;
}
