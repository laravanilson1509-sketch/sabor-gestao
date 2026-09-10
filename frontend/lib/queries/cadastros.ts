import type { SupabaseClient } from "@supabase/supabase-js";

export type TabelaCadastro = "fornecedores" | "clientes" | "funcionarios";

export async function listarCadastros(
  supabase: SupabaseClient,
  tabela: TabelaCadastro,
  unidadeId: string
) {
  const { data, error } = await supabase
    .from(tabela)
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("nome");

  if (error) throw error;
  return data || [];
}

export async function buscarCadastroPorId(
  supabase: SupabaseClient,
  tabela: TabelaCadastro,
  id: string
) {
  const { data, error } = await supabase
    .from(tabela)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function criarCadastro(
  supabase: SupabaseClient,
  tabela: TabelaCadastro,
  params: Record<string, any>
) {
  const { data, error } = await supabase
    .from(tabela)
    .insert(params)
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function atualizarCadastro(
  supabase: SupabaseClient,
  tabela: TabelaCadastro,
  id: string,
  params: Record<string, any>
) {
  const { error } = await supabase.from(tabela).update(params).eq("id", id);
  if (error) throw error;
}

export async function deletarCadastro(
  supabase: SupabaseClient,
  tabela: TabelaCadastro,
  id: string
) {
  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) throw error;
}