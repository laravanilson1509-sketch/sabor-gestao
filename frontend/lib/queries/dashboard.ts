// lib/queries/dashboard.ts
//
// Todas as funções assumem um cliente Supabase já criado (browser ou server)
// e o unidade_id da unidade ativa (guardado, por exemplo, no contexto de
// sessão do usuário após o login).

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getIndicadoresHoje(supabase: SupabaseClient, unidadeId: string) {
  const hoje = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("vw_indicadores_diarios")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("dia", hoje)
    .maybeSingle();

  if (error) throw error;
  return data; // null se ainda não houve nenhuma venda hoje — trate como zerado na UI
}

export async function getVendasSemana(supabase: SupabaseClient, unidadeId: string) {
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 6);

  const { data, error } = await supabase
    .from("vw_vendas_diarias")
    .select("dia, faturamento")
    .eq("unidade_id", unidadeId)
    .gte("dia", seteDiasAtras.toISOString().slice(0, 10))
    .order("dia", { ascending: true });

  if (error) throw error;
  return data;
}

export async function getAlertasAtivos(supabase: SupabaseClient, unidadeId: string, limite = 10) {
  const { data, error } = await supabase
    .from("alertas")
    .select("id, tipo, severidade, titulo, detalhe, criado_em")
    .eq("unidade_id", unidadeId)
    .eq("lido", false)
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data;
}

export async function marcarAlertaLido(supabase: SupabaseClient, alertaId: string) {
  const { error } = await supabase.from("alertas").update({ lido: true }).eq("id", alertaId);
  if (error) throw error;
}
