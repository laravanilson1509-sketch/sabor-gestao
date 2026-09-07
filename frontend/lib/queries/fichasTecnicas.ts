// lib/queries/fichasTecnicas.ts

import type { SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------
// Produto preparado (com receita)
// -----------------------------------------------------------------------

export async function criarProdutoPreparado(
  supabase: SupabaseClient,
  params: {
    unidadeId: string;
    nome: string;
    categoriaId?: string;
    precoVenda: number;
    rendimento?: number;
    perdaPrevistaPct?: number;
  }
) {
  const { data: produto, error: erroProduto } = await supabase
    .from("produtos")
    .insert({
      unidade_id: params.unidadeId,
      nome: params.nome,
      categoria_id: params.categoriaId ?? null,
      preco_venda: params.precoVenda,
      tipo: "preparado",
    })
    .select()
    .single();
  if (erroProduto) throw erroProduto;

  const { data: ficha, error: erroFicha } = await supabase
    .from("fichas_tecnicas")
    .insert({
      produto_id: produto.id,
      rendimento: params.rendimento ?? 1,
      perda_prevista_pct: params.perdaPrevistaPct ?? 0,
    })
    .select()
    .single();
  if (erroFicha) throw erroFicha;

  // produto e ficha já existem; itens e custos adicionais são inseridos
  // depois, um a um, com adicionarIngrediente() / adicionarCustoAdicional()
  return { produto, ficha };
}

export async function adicionarIngrediente(
  supabase: SupabaseClient,
  params: { fichaTecnicaId: string; ingredienteId: string; quantidade: number }
) {
  // custo_calculado e os totais da ficha são recalculados sozinhos pelo
  // trigger trg_ficha_item_biu — não envie custo_calculado aqui
  const { error } = await supabase.from("ficha_tecnica_itens").insert({
    ficha_tecnica_id: params.fichaTecnicaId,
    ingrediente_id: params.ingredienteId,
    quantidade: params.quantidade,
  });
  if (error) throw error;
}

export async function removerIngrediente(supabase: SupabaseClient, itemId: string) {
  const { error } = await supabase.from("ficha_tecnica_itens").delete().eq("id", itemId);
  if (error) throw error;
}

export async function adicionarCustoAdicional(
  supabase: SupabaseClient,
  params: {
    fichaTecnicaId: string;
    tipo: "embalagem" | "mao_de_obra" | "gas_energia" | "outro";
    descricao: string;
    valor: number;
  }
) {
  const { error } = await supabase.from("ficha_tecnica_custos_adicionais").insert({
    ficha_tecnica_id: params.fichaTecnicaId,
    tipo: params.tipo,
    descricao: params.descricao,
    valor: params.valor,
  });
  if (error) throw error;
}

export async function removerCustoAdicional(supabase: SupabaseClient, custoId: string) {
  const { error } = await supabase.from("ficha_tecnica_custos_adicionais").delete().eq("id", custoId);
  if (error) throw error;
}

// -----------------------------------------------------------------------
// Produto de revenda direta (item pronto — garrafa de açaí, pacote de farinha...)
// -----------------------------------------------------------------------

export async function criarProdutoRevenda(
  supabase: SupabaseClient,
  params: { unidadeId: string; nome: string; categoriaId?: string; precoVenda: number; ingredienteRevendaId: string }
) {
  // não precisa criar fichas_tecnicas nem ficha_tecnica_itens: o trigger
  // trg_produto_revenda_aiu monta a ficha de 1 item sozinho
  const { data, error } = await supabase
    .from("produtos")
    .insert({
      unidade_id: params.unidadeId,
      nome: params.nome,
      categoria_id: params.categoriaId ?? null,
      preco_venda: params.precoVenda,
      tipo: "revenda",
      ingrediente_revenda_id: params.ingredienteRevendaId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------
// Leitura — ficha completa pronta pra tela de edição
// -----------------------------------------------------------------------

export async function getFichaTecnicaCompleta(supabase: SupabaseClient, produtoId: string) {
  const { data, error } = await supabase
    .from("fichas_tecnicas")
    .select(
      `
      *,
      produtos ( id, nome, tipo, preco_venda ),
      ficha_tecnica_itens ( id, quantidade, custo_calculado, ingredientes ( id, nome, unidade_medida, custo_unitario ) ),
      ficha_tecnica_custos_adicionais ( id, tipo, descricao, valor )
    `
    )
    .eq("produto_id", produtoId)
    .single();

  if (error) throw error;
  return data;
  // custo_ingredientes, custo_adicional, custo_total, custo_fixo_rateado,
  // custo_total_com_fixo, preco_sugerido e margem_pct já vêm calculados —
  // é só exibir na tela, igual à coluna "Formação de preço" da prévia
}
