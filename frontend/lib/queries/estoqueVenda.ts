// lib/queries/estoqueVenda.ts — confere se há estoque para os itens do PDV
// antes de irem para a cozinha (só avisa, nunca bloqueia)

import type { SupabaseClient } from '@supabase/supabase-js';

export type FaltaEstoque = {
  ingrediente_id: string;
  ingrediente_nome: string;
  unidade: string;
  necessario: number; // total que a cozinha vai precisar (fila + o que está sendo enviado)
  disponivel: number; // o que o sistema tem no estoque
  naFila: number; // parte do necessário que já está na cozinha esperando
  produtos: string[]; // pratos do envio que usam esse ingrediente
  itemIds: string[];
};

type Base = {
  tipos: Map<string, string>;
  nomes: Map<string, string>;
  fichas: Map<string, { ingrediente_id: string; quantidade: number; unidade: string | null }[]>;
  saldo: Map<string, { disponivel: number; unidade: string }>;
};

// tolerância para arredondamento de números quebrados (ex.: 0,1 + 0,2)
const MARGEM = 0.0005;

async function carregarBase(supabase: SupabaseClient, unidadeId: string): Promise<Base> {
  const [resIngredientes, resFichas, resSaldo] = await Promise.all([
    supabase.from('ingredientes').select('id, nome, tipo_produto'),
    supabase.from('ficha_tecnica_itens').select('produto_acabado_id, ingrediente_id, quantidade, unidade'),
    supabase
      .from('estoque_saldo')
      .select('ingrediente_id, quantidade_disponivel, unidade')
      .eq('unidade_id', unidadeId),
  ]);
  if (resIngredientes.error) throw resIngredientes.error;
  if (resFichas.error) throw resFichas.error;
  if (resSaldo.error) throw resSaldo.error;

  const fichas: Base['fichas'] = new Map();
  for (const f of resFichas.data || []) {
    fichas.set(f.produto_acabado_id, [
      ...(fichas.get(f.produto_acabado_id) || []),
      { ingrediente_id: f.ingrediente_id, quantidade: Number(f.quantidade), unidade: f.unidade },
    ]);
  }

  return {
    tipos: new Map((resIngredientes.data || []).map((i) => [i.id, i.tipo_produto])),
    nomes: new Map((resIngredientes.data || []).map((i) => [i.id, i.nome])),
    fichas,
    saldo: new Map(
      (resSaldo.data || []).map((s) => [
        s.ingrediente_id,
        { disponivel: Number(s.quantidade_disponivel || 0), unidade: s.unidade },
      ])
    ),
  };
}

// quanto de cada ingrediente um item consome — mesma regra da baixa no banco:
// prato usa a ficha técnica, produto acabado consome ele mesmo
function consumoDoItem(base: Base, produtoId: string | null, quantidade: number) {
  if (!produtoId) return [];
  const tipo = base.tipos.get(produtoId);
  if (tipo === 'acabado') return [{ ingrediente_id: produtoId, quantidade }];
  if (tipo !== 'prato') return [];
  return (base.fichas.get(produtoId) || [])
    .filter((f) => {
      // unidade diferente da do estoque não dá para comparar (vira conferência depois)
      const saldo = base.saldo.get(f.ingrediente_id);
      return !f.unidade || !saldo?.unidade || f.unidade.toLowerCase() === saldo.unidade.toLowerCase();
    })
    .map((f) => ({ ingrediente_id: f.ingrediente_id, quantidade: f.quantidade * quantidade }));
}

// produtos do cardápio que não têm estoque nem para 1 unidade
export async function listarProdutosSemEstoque(supabase: SupabaseClient, unidadeId: string) {
  const base = await carregarBase(supabase, unidadeId);
  const semEstoque = new Set<string>();
  for (const [produtoId, tipo] of base.tipos) {
    if (tipo !== 'prato' && tipo !== 'acabado') continue;
    const falta = consumoDoItem(base, produtoId, 1).some(
      (c) => c.quantidade > (base.saldo.get(c.ingrediente_id)?.disponivel || 0) + MARGEM
    );
    if (falta) semEstoque.add(produtoId);
  }
  return semEstoque;
}

// confere os itens da comanda que ainda não foram para a cozinha, somando o que
// já está na fila (novo/preparando) e ainda não saiu do estoque
export async function verificarEstoqueEnvio(
  supabase: SupabaseClient,
  unidadeId: string,
  pedidoId: string
): Promise<FaltaEstoque[]> {
  const [base, resEnvio, resFila] = await Promise.all([
    carregarBase(supabase, unidadeId),
    supabase
      .from('pdv_pedido_itens')
      .select('id, produto_id, nome, quantidade')
      .eq('pedido_id', pedidoId)
      .eq('cancelado', false)
      .is('status_cozinha', null),
    supabase
      .from('pdv_pedido_itens')
      .select('id, produto_id, quantidade, pdv_pedidos!inner(unidade_id, status)')
      .in('status_cozinha', ['novo', 'preparando'])
      .eq('cancelado', false)
      .eq('pdv_pedidos.unidade_id', unidadeId)
      .eq('pdv_pedidos.status', 'aberto'),
  ]);
  if (resEnvio.error) throw resEnvio.error;
  if (resFila.error) throw resFila.error;

  const fila = new Map<string, number>();
  for (const item of resFila.data || []) {
    for (const c of consumoDoItem(base, item.produto_id, Number(item.quantidade))) {
      fila.set(c.ingrediente_id, (fila.get(c.ingrediente_id) || 0) + c.quantidade);
    }
  }

  const envio = new Map<string, { quantidade: number; produtos: Set<string>; itemIds: string[] }>();
  for (const item of resEnvio.data || []) {
    for (const c of consumoDoItem(base, item.produto_id, Number(item.quantidade))) {
      const atual = envio.get(c.ingrediente_id) || { quantidade: 0, produtos: new Set(), itemIds: [] };
      atual.quantidade += c.quantidade;
      atual.produtos.add(item.nome);
      atual.itemIds.push(item.id);
      envio.set(c.ingrediente_id, atual);
    }
  }

  const faltas: FaltaEstoque[] = [];
  for (const [ingredienteId, e] of envio) {
    const naFila = fila.get(ingredienteId) || 0;
    const saldo = base.saldo.get(ingredienteId);
    const disponivel = saldo?.disponivel || 0;
    if (naFila + e.quantidade > disponivel + MARGEM) {
      faltas.push({
        ingrediente_id: ingredienteId,
        ingrediente_nome: base.nomes.get(ingredienteId) || 'Ingrediente',
        unidade: saldo?.unidade || '',
        necessario: naFila + e.quantidade,
        disponivel,
        naFila,
        produtos: [...e.produtos],
        itemIds: [...new Set(e.itemIds)],
      });
    }
  }
  return faltas;
}
