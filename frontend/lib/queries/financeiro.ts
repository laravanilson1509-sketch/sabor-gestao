import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfigFinanceira = {
  unidade_id: string;
  margem_lucro_pct: number;
  impostos_pct: number;
  taxa_cartao_pct: number;
  taxa_app_pct: number;
  vendas_previstas_mes: number;
};

export type CustoFixo = {
  id: string;
  nome: string;
  valor_mensal: number;
  ativo: boolean;
};

export async function getConfigFinanceira(
  supabase: SupabaseClient,
  unidadeId: string
): Promise<ConfigFinanceira> {
  const { data, error } = await supabase
    .from("configuracoes_financeiras")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (error) throw error;

  return {
    unidade_id: unidadeId,
    margem_lucro_pct: Number(data?.margem_lucro_pct ?? 50),
    impostos_pct: Number(data?.impostos_pct ?? 0),
    taxa_cartao_pct: Number(data?.taxa_cartao_pct ?? 0),
    taxa_app_pct: Number(data?.taxa_app_pct ?? 0),
    vendas_previstas_mes: Number(data?.vendas_previstas_mes ?? 0),
  };
}

export async function salvarConfigFinanceira(
  supabase: SupabaseClient,
  config: ConfigFinanceira
) {
  const { error } = await supabase
    .from("configuracoes_financeiras")
    .upsert(
      { ...config, atualizado_em: new Date().toISOString() },
      { onConflict: "unidade_id" }
    );
  if (error) throw error;
}

export async function listarCustosFixos(
  supabase: SupabaseClient,
  unidadeId: string
): Promise<CustoFixo[]> {
  const { data, error } = await supabase
    .from("custos_fixos")
    .select("id, nome, valor_mensal, ativo")
    .eq("unidade_id", unidadeId)
    .order("nome");
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    nome: c.nome,
    valor_mensal: Number(c.valor_mensal),
    ativo: c.ativo,
  }));
}

export async function criarCustoFixo(
  supabase: SupabaseClient,
  params: { unidade_id: string; nome: string; valor_mensal: number }
) {
  const { error } = await supabase.from("custos_fixos").insert(params);
  if (error) throw error;
}

export async function atualizarCustoFixo(
  supabase: SupabaseClient,
  id: string,
  params: { nome?: string; valor_mensal?: number; ativo?: boolean }
) {
  const { error } = await supabase.from("custos_fixos").update(params).eq("id", id);
  if (error) throw error;
}

export async function deletarCustoFixo(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("custos_fixos").delete().eq("id", id);
  if (error) throw error;
}

// total dos custos fixos ativos e quanto cabe a cada prato vendido
export function calcularCustoFixoPorPrato(custos: CustoFixo[], vendasPrevistas: number) {
  const total = custos
    .filter((c) => c.ativo)
    .reduce((acc, c) => acc + Number(c.valor_mensal), 0);
  const porPrato = vendasPrevistas > 0 ? total / vendasPrevistas : 0;
  return { total, porPrato };
}

// preço = (ingredientes + custo fixo por prato) / (1 - margem - impostos - taxas)
export function calcularPrecoSugerido(params: {
  custoIngredientes: number;
  custoFixoPorPrato: number;
  config: ConfigFinanceira;
}) {
  const { custoIngredientes, custoFixoPorPrato, config } = params;
  const percentuais =
    config.margem_lucro_pct +
    config.impostos_pct +
    config.taxa_cartao_pct +
    config.taxa_app_pct;
  const custoBase = custoIngredientes + custoFixoPorPrato;

  if (percentuais >= 100) {
    return { preco: 0, custoBase, percentuais, valido: false };
  }

  const preco = custoBase > 0 ? custoBase / (1 - percentuais / 100) : 0;
  return { preco, custoBase, percentuais, valido: true };
}