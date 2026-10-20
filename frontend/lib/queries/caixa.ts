// lib/queries/caixa.ts — Caixa e vendas do dia (PDV + delivery)

import type { SupabaseClient } from '@supabase/supabase-js';

export type Caixa = {
  id: string;
  status: 'aberto' | 'fechado';
  saldo_inicial: number;
  aberto_em: string;
  fechado_em: string | null;
  valor_esperado: number | null;
  valor_contado: number | null;
  observacao: string | null;
};

export type Movimentacao = {
  id: string;
  tipo: 'sangria' | 'suprimento';
  valor: number;
  descricao: string | null;
  criado_em: string;
};

export type Venda = {
  id: string;
  origem: 'mesa' | 'balcao' | 'delivery';
  titulo: string;
  forma: string | null;
  valor: number;
  quando: string;
  // delivery já traz os itens no próprio pedido; no PDV eles são buscados ao abrir
  itensDelivery: { nome: string; quantidade: number; preco_unitario: number }[] | null;
};

// rótulos das formas de pagamento (PDV e delivery usam nomes um pouco diferentes)
export const ROTULO_FORMA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  vale_refeicao: 'Vale refeição',
  outro: 'Outro',
};

export const rotuloForma = (forma: string | null) =>
  forma ? ROTULO_FORMA[forma] || forma : 'Não informado';

const CAMPOS_CAIXA =
  'id, status, saldo_inicial, aberto_em, fechado_em, valor_esperado, valor_contado, observacao';

// ---------- Caixa ----------

export async function buscarCaixaAberto(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_caixas')
    .select(CAMPOS_CAIXA)
    .eq('unidade_id', unidadeId)
    .eq('status', 'aberto')
    .maybeSingle();
  if (error) throw error;
  return data as Caixa | null;
}

export async function listarCaixasFechados(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_caixas')
    .select(CAMPOS_CAIXA)
    .eq('unidade_id', unidadeId)
    .eq('status', 'fechado')
    .order('fechado_em', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data || []) as Caixa[];
}

export async function abrirCaixa(supabase: SupabaseClient, unidadeId: string, saldoInicial: number) {
  const { error } = await supabase
    .from('pdv_caixas')
    .insert({ unidade_id: unidadeId, saldo_inicial: saldoInicial });
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um caixa aberto.');
    throw error;
  }
}

export async function fecharCaixa(
  supabase: SupabaseClient,
  caixaId: string,
  params: { valorEsperado: number; valorContado: number; observacao: string | null }
) {
  const { error } = await supabase
    .from('pdv_caixas')
    .update({
      status: 'fechado',
      fechado_em: new Date().toISOString(),
      valor_esperado: params.valorEsperado,
      valor_contado: params.valorContado,
      observacao: params.observacao,
    })
    .eq('id', caixaId);
  if (error) throw error;
}

export async function listarMovimentacoes(supabase: SupabaseClient, caixaId: string) {
  const { data, error } = await supabase
    .from('pdv_caixa_movimentacoes')
    .select('id, tipo, valor, descricao, criado_em')
    .eq('caixa_id', caixaId)
    .order('criado_em');
  if (error) throw error;
  return (data || []) as Movimentacao[];
}

export async function adicionarMovimentacao(
  supabase: SupabaseClient,
  params: { caixaId: string; tipo: 'sangria' | 'suprimento'; valor: number; descricao: string | null }
) {
  const { error } = await supabase.from('pdv_caixa_movimentacoes').insert({
    caixa_id: params.caixaId,
    tipo: params.tipo,
    valor: params.valor,
    descricao: params.descricao,
  });
  if (error) throw error;
}

// ---------- Vendas ----------

// pedidos do PDV fechados + delivery entregue, entre duas datas (ISO)
export async function listarVendas(
  supabase: SupabaseClient,
  unidadeId: string,
  inicio: string,
  fim: string
): Promise<Venda[]> {
  const [resPdv, resMesas, resDelivery] = await Promise.all([
    supabase
      .from('pdv_pedidos')
      .select('id, numero, canal, mesa_id, nome_cliente, forma_pagamento, total, fechado_em')
      .eq('unidade_id', unidadeId)
      .eq('status', 'fechado')
      .gte('fechado_em', inicio)
      .lt('fechado_em', fim),
    supabase.from('pdv_mesas').select('id, numero').eq('unidade_id', unidadeId),
    supabase
      .from('pedidos_delivery')
      .select('id, telefone_cliente, forma_pagamento, valor_total, itens, criado_em')
      .eq('unidade_id', unidadeId)
      .eq('status', 'entregue')
      .gte('criado_em', inicio)
      .lt('criado_em', fim),
  ]);
  if (resPdv.error) throw resPdv.error;
  if (resMesas.error) throw resMesas.error;
  if (resDelivery.error) throw resDelivery.error;

  const numeroMesa = new Map((resMesas.data || []).map((m) => [m.id, m.numero]));

  const vendas: Venda[] = (resPdv.data || []).map((p) => ({
    id: p.id,
    origem: p.canal === 'mesa' ? 'mesa' : 'balcao',
    titulo:
      p.canal === 'mesa'
        ? 'Mesa ' + (numeroMesa.get(p.mesa_id) ?? '')
        : 'Balcão #' + p.numero + (p.nome_cliente ? ' · ' + p.nome_cliente : ''),
    forma: p.forma_pagamento,
    valor: Number(p.total || 0),
    quando: p.fechado_em,
    itensDelivery: null,
  }));

  for (const d of resDelivery.data || []) {
    vendas.push({
      id: d.id,
      origem: 'delivery',
      titulo: 'Delivery' + (d.telefone_cliente ? ' · ' + d.telefone_cliente : ''),
      forma: d.forma_pagamento,
      valor: Number(d.valor_total || 0),
      quando: d.criado_em,
      itensDelivery: d.itens || [],
    });
  }

  return vendas.sort((a, b) => b.quando.localeCompare(a.quando));
}

export function resumirVendas(vendas: Venda[]) {
  const total = vendas.reduce((acc, v) => acc + v.valor, 0);
  const porForma = new Map<string, { quantidade: number; valor: number }>();
  for (const v of vendas) {
    const chave = v.forma || 'nao_informado';
    const atual = porForma.get(chave) || { quantidade: 0, valor: 0 };
    porForma.set(chave, { quantidade: atual.quantidade + 1, valor: atual.valor + v.valor });
  }
  return {
    total,
    quantidade: vendas.length,
    ticketMedio: vendas.length > 0 ? total / vendas.length : 0,
    porForma: [...porForma.entries()]
      .map(([forma, r]) => ({ forma: forma === 'nao_informado' ? null : forma, ...r }))
      .sort((a, b) => b.valor - a.valor),
  };
}

// dinheiro que deveria estar na gaveta: troco + vendas em dinheiro + suprimentos - sangrias
export function calcularDinheiroEsperado(caixa: Caixa, vendas: Venda[], movs: Movimentacao[]) {
  const vendasDinheiro = vendas
    .filter((v) => v.forma === 'dinheiro')
    .reduce((acc, v) => acc + v.valor, 0);
  const suprimentos = movs.filter((m) => m.tipo === 'suprimento').reduce((a, m) => a + Number(m.valor), 0);
  const sangrias = movs.filter((m) => m.tipo === 'sangria').reduce((a, m) => a + Number(m.valor), 0);
  return {
    vendasDinheiro,
    suprimentos,
    sangrias,
    esperado: Number(caixa.saldo_inicial) + vendasDinheiro + suprimentos - sangrias,
  };
}
