import type { SupabaseClient } from "@supabase/supabase-js";

// ========== LEITURA ==========

export async function getEstoqueComStatus(
  supabase: SupabaseClient,
  unidadeId: string,
  filtros?: { tipo?: "consumo" | "acabado" | "todos"; ativo?: "ativo" | "inativo" | "todos" }
) {
  let query = supabase
    .from("estoque_saldo")
    .select(
      "id, quantidade_disponivel, custo_unitario, estoque_minimo, unidade, ingredientes(id, nome, tipo_produto, ativo)"
    )
    .eq("unidade_id", unidadeId);

  const { data, error } = await query.order("id");
  if (error) throw error;

  let resultado = (data || []) as any[];

  if (filtros?.tipo && filtros.tipo !== "todos") {
    resultado = resultado.filter((r) => r.ingredientes?.tipo_produto === filtros.tipo);
  }
  if (filtros?.ativo && filtros.ativo !== "todos") {
    const querAtivo = filtros.ativo === "ativo";
    resultado = resultado.filter((r) => r.ingredientes?.ativo === querAtivo);
  }

  return resultado;
}

export async function getIngredientePorId(supabase: SupabaseClient, ingredienteId: string) {
  const { data: ingrediente, error: e1 } = await supabase
    .from("ingredientes")
    .select("*")
    .eq("id", ingredienteId)
    .single();
  if (e1) throw e1;

  const { data: estoque, error: e2 } = await supabase
    .from("estoque_saldo")
    .select("*")
    .eq("ingrediente_id", ingredienteId)
    .maybeSingle();
  if (e2) throw e2;

  return { ingrediente, estoque };
}

export async function getMovimentacoes(
  supabase: SupabaseClient,
  ingredienteId: string,
  limit = 20
) {
  const { data, error } = await supabase
    .from("movimentacoes_estoque")
    .select("*")
    .eq("ingrediente_id", ingredienteId)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ========== ESCRITA ==========

export async function criarIngredienteComEstoque(
  supabase: SupabaseClient,
  params: {
    nome: string;
    tipo_produto: "consumo" | "acabado";
    unidade_padrao: string;
    ativo: boolean;
    quantidade_disponivel: number;
    custo_unitario: number;
    estoque_minimo: number;
    unidade_id: string;
  }
) {
  const { data: novo, error: erroIngrediente } = await supabase
    .from("ingredientes")
    .insert({
      nome: params.nome,
      tipo_produto: params.tipo_produto,
      unidade_padrao: params.unidade_padrao,
      ativo: params.ativo,
    })
    .select("id")
    .single();

  if (erroIngrediente) throw erroIngrediente;

  const { error: erroEstoque } = await supabase.from("estoque_saldo").insert({
    ingrediente_id: novo.id,
    quantidade_disponivel: params.quantidade_disponivel,
    custo_unitario: params.custo_unitario,
    estoque_minimo: params.estoque_minimo,
    unidade: params.unidade_padrao,
    unidade_id: params.unidade_id,
  });

  if (erroEstoque) throw erroEstoque;

  return novo.id;
}

export async function atualizarIngrediente(
  supabase: SupabaseClient,
  ingredienteId: string,
  params: {
    nome: string;
    tipo_produto: "consumo" | "acabado";
    ativo: boolean;
    custo_unitario: number;
    estoque_minimo: number;
  }
) {
  const { error: e1 } = await supabase
    .from("ingredientes")
    .update({
      nome: params.nome,
      tipo_produto: params.tipo_produto,
      ativo: params.ativo,
    })
    .eq("id", ingredienteId);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from("estoque_saldo")
    .update({
      custo_unitario: params.custo_unitario,
      estoque_minimo: params.estoque_minimo,
    })
    .eq("ingrediente_id", ingredienteId);
  if (e2) throw e2;
}

export async function deletarIngrediente(supabase: SupabaseClient, ingredienteId: string) {
  await supabase.from("movimentacoes_estoque").delete().eq("ingrediente_id", ingredienteId);
  await supabase.from("estoque_saldo").delete().eq("ingrediente_id", ingredienteId);
  const { error } = await supabase.from("ingredientes").delete().eq("id", ingredienteId);
  if (error) throw error;
}

export async function registrarMovimentacao(
  supabase: SupabaseClient,
  params: {
    ingrediente_id: string;
    unidade_id: string;
    tipo: "entrada" | "consumo";
    quantidade: number;
    observacao?: string;
  }
) {
  const { error } = await supabase.from("movimentacoes_estoque").insert(params);
  if (error) throw error;
}

// ========== UTILITÁRIOS ==========

export function calcularStatus(
  quantidade: number,
  minimo: number
): "ok" | "alerta" | "critico" {
  if (quantidade <= 0) return "critico";
  if (quantidade <= minimo) return "alerta";
  return "ok";
}

export function getStatusDisplay(status: "ok" | "alerta" | "critico") {
  const map = {
    ok: { emoji: "🟢", label: "OK", cor: "text-green-600" },
    alerta: { emoji: "🟡", label: "Aviso", cor: "text-yellow-600" },
    critico: { emoji: "🔴", label: "Crítico", cor: "text-red-600" },
  };
  return map[status];
}