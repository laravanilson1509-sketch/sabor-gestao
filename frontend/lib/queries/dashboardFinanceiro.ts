// lib/queries/dashboardFinanceiro.ts — indicadores do painel financeiro por período

import type { SupabaseClient } from '@supabase/supabase-js';
import { calcularCmv, dataLocal, hojeISO, listarQuitadasEntre, type Conta } from './financeiroContas';
import { listarCustosFixos } from './financeiro';

export type TipoPeriodo = 'dia' | 'mes' | 'ano' | 'periodo';
export type Agrupamento = 'hora' | 'dia' | 'mes';

export type Periodo = { inicio: Date; fim: Date; agrupamento: Agrupamento };

export type Fatia = { chave: string; valor: number; quantidade: number };

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// ---------- períodos ----------

// referencia: AAAA-MM-DD (dia), AAAA-MM (mes), AAAA (ano); periodo usa de/ate (AAAA-MM-DD)
export function montarPeriodo(tipo: TipoPeriodo, referencia: string, ate?: string): Periodo {
  const [a, m = 1, d = 1] = referencia.split('-').map(Number);
  if (tipo === 'dia') return { inicio: new Date(a, m - 1, d), fim: new Date(a, m - 1, d + 1), agrupamento: 'hora' };
  if (tipo === 'mes') return { inicio: new Date(a, m - 1, 1), fim: new Date(a, m, 1), agrupamento: 'dia' };
  if (tipo === 'ano') return { inicio: new Date(a, 0, 1), fim: new Date(a + 1, 0, 1), agrupamento: 'mes' };

  const [a2, m2, d2] = (ate || referencia).split('-').map(Number);
  const inicio = new Date(a, m - 1, d);
  const fim = new Date(a2, m2 - 1, d2 + 1);
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86400000);
  return { inicio, fim, agrupamento: dias <= 1 ? 'hora' : dias <= 62 ? 'dia' : 'mes' };
}

// mesmo tamanho, logo antes (mês anterior, ano anterior, ontem...)
export function periodoAnterior(tipo: TipoPeriodo, p: Periodo): Periodo {
  const { inicio, fim } = p;
  if (tipo === 'mes') return { ...p, inicio: new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1), fim: inicio };
  if (tipo === 'ano') return { ...p, inicio: new Date(inicio.getFullYear() - 1, 0, 1), fim: inicio };
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86400000);
  const novoInicio = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() - dias);
  return { ...p, inicio: novoInicio, fim: inicio };
}

function chaveBucket(d: Date, agrupamento: Agrupamento) {
  if (agrupamento === 'hora') return String(d.getHours()).padStart(2, '0');
  if (agrupamento === 'dia') return dataLocal(d);
  return dataLocal(d).slice(0, 7);
}

// todas as "fatias" do eixo do gráfico, mesmo as sem venda
function listarBuckets(p: Periodo) {
  const lista: { chave: string; rotulo: string }[] = [];
  if (p.agrupamento === 'hora') {
    for (let h = 0; h < 24; h++) lista.push({ chave: String(h).padStart(2, '0'), rotulo: h + 'h' });
    return lista;
  }
  const cursor = new Date(p.inicio);
  while (cursor < p.fim) {
    if (p.agrupamento === 'dia') {
      lista.push({ chave: dataLocal(cursor), rotulo: String(cursor.getDate()).padStart(2, '0') + '/' + String(cursor.getMonth() + 1).padStart(2, '0') });
      cursor.setDate(cursor.getDate() + 1);
    } else {
      lista.push({ chave: dataLocal(cursor).slice(0, 7), rotulo: MESES_CURTOS[cursor.getMonth()] + '/' + String(cursor.getFullYear()).slice(2) });
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }
  }
  return lista;
}

// ---------- leitura ----------

// o Supabase devolve no máximo 1000 linhas por vez; aqui buscamos de 1000 em 1000
async function buscarTodos(montar: () => any) {
  const linhas: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < 1000) return linhas;
  }
}

// antes do SQL 0016 ser rodado as tabelas de contas não existem: tratamos como vazio
async function contasOuVazio(promessa: Promise<Conta[]>) {
  try {
    return await promessa;
  } catch (err: any) {
    if (err?.code === 'PGRST205') return [];
    throw err;
  }
}

function somarEm(mapa: Map<string, Fatia>, chave: string, valor: number, quantidade = 1) {
  const atual = mapa.get(chave) || { chave, valor: 0, quantidade: 0 };
  atual.valor += valor;
  atual.quantidade += quantidade;
  mapa.set(chave, atual);
}

const ordenar = (mapa: Map<string, Fatia>) => [...mapa.values()].sort((a, b) => b.valor - a.valor);

export async function carregarResumo(
  supabase: SupabaseClient,
  unidadeId: string,
  p: Periodo,
  detalhado: boolean
) {
  const inicioISO = p.inicio.toISOString();
  const fimISO = p.fim.toISOString();
  const inicioData = dataLocal(p.inicio);
  const fimData = dataLocal(p.fim);

  const [pdv, delivery, cancelados, recebidas, pagas, cmv] = await Promise.all([
    buscarTodos(() =>
      supabase
        .from('pdv_pedidos')
        .select('id, canal, forma_pagamento, total, fechado_em')
        .eq('unidade_id', unidadeId)
        .eq('status', 'fechado')
        .gte('fechado_em', inicioISO)
        .lt('fechado_em', fimISO)
        .order('fechado_em')
    ),
    buscarTodos(() =>
      supabase
        .from('pedidos_delivery')
        .select(detalhado ? 'id, forma_pagamento, valor_total, itens, criado_em' : 'id, valor_total, criado_em')
        .eq('unidade_id', unidadeId)
        .eq('status', 'entregue')
        .gte('criado_em', inicioISO)
        .lt('criado_em', fimISO)
        .order('criado_em')
    ),
    supabase
      .from('pdv_pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId)
      .eq('status', 'cancelado')
      .gte('criado_em', inicioISO)
      .lt('criado_em', fimISO),
    contasOuVazio(listarQuitadasEntre(supabase, 'receber', unidadeId, inicioData, fimData)),
    contasOuVazio(listarQuitadasEntre(supabase, 'pagar', unidadeId, inicioData, fimData)),
    calcularCmv(supabase, unidadeId, inicioISO, fimISO),
  ]);
  if (cancelados.error) throw cancelados.error;

  const porBucket = new Map<string, Fatia>();
  const porForma = new Map<string, Fatia>();
  const porCanal = new Map<string, Fatia>();
  let vendas = 0;

  for (const v of pdv) {
    const valor = Number(v.total || 0);
    vendas += valor;
    somarEm(porBucket, chaveBucket(new Date(v.fechado_em), p.agrupamento), valor);
    somarEm(porForma, v.forma_pagamento || 'nao_informado', valor);
    somarEm(porCanal, v.canal === 'mesa' ? 'Mesa' : 'Balcão', valor);
  }
  for (const d of delivery) {
    const valor = Number(d.valor_total || 0);
    vendas += valor;
    somarEm(porBucket, chaveBucket(new Date(d.criado_em), p.agrupamento), valor);
    somarEm(porForma, d.forma_pagamento || 'nao_informado', valor);
    somarEm(porCanal, 'Delivery', valor);
  }

  const outrasReceitas = recebidas.reduce((a, c) => a + c.valor, 0);
  const faturamento = vendas + outrasReceitas;
  const pedidos = pdv.length + delivery.length;

  // compra de mercadoria já entra pelo CMV (igual ao DRE)
  const porDespesa = new Map<string, Fatia>();
  for (const c of pagas) {
    if (c.categoria !== 'fornecedores') somarEm(porDespesa, c.categoria, c.valor);
  }
  const despesas = [...porDespesa.values()].reduce((a, f) => a + f.valor, 0);
  const lucro = faturamento - cmv - despesas;

  const resumo = {
    faturamento,
    vendas,
    outrasReceitas,
    pedidos,
    ticketMedio: pedidos > 0 ? vendas / pedidos : 0,
    cancelados: cancelados.count || 0,
    cmv,
    cmvPct: faturamento > 0 ? (cmv / faturamento) * 100 : null,
    despesas,
    lucro,
    margemPct: faturamento > 0 ? (lucro / faturamento) * 100 : null,
  };
  if (!detalhado) return { ...resumo, detalhe: null };

  // produtos mais vendidos (itens do PDV + itens do delivery)
  const porProduto = new Map<string, Fatia>();
  const ids = pdv.map((v) => v.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from('pdv_pedido_itens')
      .select('nome, quantidade, preco_unitario')
      .in('pedido_id', ids.slice(i, i + 150));
    if (error) throw error;
    for (const it of data || []) {
      somarEm(porProduto, it.nome, Number(it.quantidade) * Number(it.preco_unitario), Number(it.quantidade));
    }
  }
  for (const d of delivery) {
    for (const it of d.itens || []) {
      somarEm(porProduto, it.nome, Number(it.quantidade) * Number(it.preco_unitario), Number(it.quantidade));
    }
  }

  const buckets = listarBuckets(p).map((b) => ({ ...b, valor: porBucket.get(b.chave)?.valor || 0, quantidade: porBucket.get(b.chave)?.quantidade || 0 }));

  return {
    ...resumo,
    detalhe: {
      buckets,
      porForma: ordenar(porForma),
      porCanal: ordenar(porCanal),
      topProdutos: ordenar(porProduto).slice(0, 6),
      porDespesa: ordenar(porDespesa),
    },
  };
}

export type Resumo = Awaited<ReturnType<typeof carregarResumo>>;

// situação das contas hoje (não depende do período escolhido)
export async function carregarPendencias(supabase: SupabaseClient, unidadeId: string) {
  const hoje = hojeISO();
  const [a, m, d] = hoje.split('-').map(Number);
  const daquiUmaSemana = dataLocal(new Date(a, m - 1, d + 7));

  async function abertas(tabela: string) {
    const { data, error } = await supabase
      .from(tabela)
      .select('valor, vencimento')
      .eq('unidade_id', unidadeId)
      .eq('status', 'aberta');
    if (error) {
      if (error.code === 'PGRST205') return [];
      throw error;
    }
    return (data || []).map((c) => ({ valor: Number(c.valor), vencimento: c.vencimento as string }));
  }

  const [pagar, receber, custosFixos] = await Promise.all([
    abertas('contas_pagar'),
    abertas('contas_receber'),
    listarCustosFixos(supabase, unidadeId),
  ]);
  const soma = (l: { valor: number }[]) => l.reduce((acc, c) => acc + c.valor, 0);
  const vencidas = pagar.filter((c) => c.vencimento < hoje);
  const proximas = pagar.filter((c) => c.vencimento >= hoje && c.vencimento <= daquiUmaSemana);

  return {
    vencidas: { quantidade: vencidas.length, valor: soma(vencidas) },
    proximas: { quantidade: proximas.length, valor: soma(proximas) },
    aReceber: { quantidade: receber.length, valor: soma(receber) },
    custosFixosMes: custosFixos.filter((c) => c.ativo).reduce((acc, c) => acc + c.valor_mensal, 0),
  };
}
