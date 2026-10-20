// lib/queries/financeiroContas.ts — contas a pagar/receber, fluxo de caixa e DRE

import type { SupabaseClient } from '@supabase/supabase-js';
import { listarVendas } from './caixa';

export type TipoConta = 'pagar' | 'receber';

export type Conta = {
  id: string;
  descricao: string;
  categoria: string;
  pessoa: string | null; // credor (pagar) ou devedor (receber)
  valor: number;
  vencimento: string; // AAAA-MM-DD
  status: 'aberta' | 'quitada' | 'cancelada';
  quitado_em: string | null;
  forma_pagamento: string | null;
  observacao: string | null;
};

// cada tipo usa uma tabela com nomes de colunas um pouco diferentes
const TABELA = {
  pagar: { tabela: 'contas_pagar', pessoa: 'credor', quitado: 'pago_em', statusQuitada: 'paga' },
  receber: { tabela: 'contas_receber', pessoa: 'devedor', quitado: 'recebido_em', statusQuitada: 'recebida' },
} as const;

export const CATEGORIAS: Record<TipoConta, Record<string, string>> = {
  pagar: {
    fornecedores: 'Fornecedores (mercadoria)',
    aluguel: 'Aluguel',
    energia_agua: 'Energia / água / gás',
    salarios: 'Salários',
    impostos: 'Impostos',
    taxas: 'Taxas (cartão, app, banco)',
    manutencao: 'Manutenção',
    marketing: 'Marketing',
    outros: 'Outros',
  },
  receber: {
    fiado: 'Fiado',
    evento: 'Evento / encomenda',
    convenio: 'Convênio / empresa',
    outros: 'Outros',
  },
};

// ---------- datas ----------

const doisDigitos = (n: number) => String(n).padStart(2, '0');

export function dataLocal(d: Date) {
  return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate());
}

export const hojeISO = () => dataLocal(new Date());

// mes no formato AAAA-MM -> primeiro dia, dia seguinte ao último e quantos dias tem
export function limitesMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const inicio = new Date(ano, m - 1, 1);
  const fim = new Date(ano, m, 1);
  return {
    inicio,
    fim,
    inicioData: dataLocal(inicio),
    fimData: dataLocal(fim),
    dias: new Date(ano, m, 0).getDate(),
  };
}

export function somarMeses(data: string, meses: number) {
  const [ano, m, d] = data.split('-').map(Number);
  const alvo = new Date(ano, m - 1 + meses, 1);
  // dia 31 em mês de 30 dias vira o último dia do mês
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  return dataLocal(alvo);
}

export const formatarData = (data: string) => data.split('-').reverse().join('/');

export const formatarReais = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------- contas ----------

function paraConta(tipo: TipoConta, c: any): Conta {
  const t = TABELA[tipo];
  return {
    id: c.id,
    descricao: c.descricao,
    categoria: c.categoria,
    pessoa: c[t.pessoa],
    valor: Number(c.valor),
    vencimento: c.vencimento,
    status: c.status === t.statusQuitada ? 'quitada' : c.status,
    quitado_em: c[t.quitado],
    forma_pagamento: c.forma_pagamento,
    observacao: c.observacao,
  };
}

export async function listarContas(
  supabase: SupabaseClient,
  tipo: TipoConta,
  unidadeId: string
): Promise<Conta[]> {
  const { data, error } = await supabase
    .from(TABELA[tipo].tabela)
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('vencimento');
  if (error) throw error;
  return (data || []).map((c) => paraConta(tipo, c));
}

// cria a conta; com "repetir" > 1 cria uma por mês (ex.: aluguel do ano)
export async function criarConta(
  supabase: SupabaseClient,
  tipo: TipoConta,
  params: {
    unidade_id: string;
    descricao: string;
    categoria: string;
    pessoa: string | null;
    valor: number;
    vencimento: string;
    observacao: string | null;
    repetir: number;
  }
) {
  const t = TABELA[tipo];
  const linhas = Array.from({ length: Math.max(1, params.repetir) }, (_, i) => ({
    unidade_id: params.unidade_id,
    descricao: params.repetir > 1 ? `${params.descricao} (${i + 1}/${params.repetir})` : params.descricao,
    categoria: params.categoria,
    [t.pessoa]: params.pessoa,
    valor: params.valor,
    vencimento: somarMeses(params.vencimento, i),
    observacao: params.observacao,
  }));
  const { error } = await supabase.from(t.tabela).insert(linhas);
  if (error) throw error;
}

export async function quitarConta(
  supabase: SupabaseClient,
  tipo: TipoConta,
  id: string,
  params: { data: string; forma_pagamento: string | null }
) {
  const t = TABELA[tipo];
  const { error } = await supabase
    .from(t.tabela)
    .update({ status: t.statusQuitada, [t.quitado]: params.data, forma_pagamento: params.forma_pagamento })
    .eq('id', id);
  if (error) throw error;
}

// volta a conta para "aberta" (pagou por engano, cancelou sem querer...)
export async function reabrirConta(supabase: SupabaseClient, tipo: TipoConta, id: string) {
  const t = TABELA[tipo];
  const { error } = await supabase
    .from(t.tabela)
    .update({ status: 'aberta', [t.quitado]: null, forma_pagamento: null })
    .eq('id', id);
  if (error) throw error;
}

export async function cancelarConta(supabase: SupabaseClient, tipo: TipoConta, id: string) {
  const { error } = await supabase.from(TABELA[tipo].tabela).update({ status: 'cancelada' }).eq('id', id);
  if (error) throw error;
}

export async function excluirConta(supabase: SupabaseClient, tipo: TipoConta, id: string) {
  const { error } = await supabase.from(TABELA[tipo].tabela).delete().eq('id', id);
  if (error) throw error;
}

// situação para mostrar na tela, olhando a data de hoje
export function situacaoConta(c: Conta, hoje: string) {
  if (c.status !== 'aberta') return c.status;
  if (c.vencimento < hoje) return 'vencida';
  if (c.vencimento <= somarDias(hoje, 3)) return 'vence_logo';
  return 'aberta';
}

function somarDias(data: string, dias: number) {
  const [ano, m, d] = data.split('-').map(Number);
  return dataLocal(new Date(ano, m - 1, d + dias));
}

// contas quitadas dentro do mês (pela data em que foram pagas/recebidas)
async function listarQuitadasNoMes(
  supabase: SupabaseClient,
  tipo: TipoConta,
  unidadeId: string,
  mes: string
) {
  const t = TABELA[tipo];
  const { inicioData, fimData } = limitesMes(mes);
  const { data, error } = await supabase
    .from(t.tabela)
    .select('*')
    .eq('unidade_id', unidadeId)
    .eq('status', t.statusQuitada)
    .gte(t.quitado, inicioData)
    .lt(t.quitado, fimData);
  if (error) throw error;
  return (data || []).map((c) => paraConta(tipo, c));
}

// ---------- fluxo de caixa ----------

export type DiaFluxo = { data: string; vendas: number; recebidas: number; pagas: number; saldo: number };

export async function carregarFluxoCaixa(supabase: SupabaseClient, unidadeId: string, mes: string) {
  const { inicio, fim, dias } = limitesMes(mes);
  const [vendas, recebidas, pagas] = await Promise.all([
    listarVendas(supabase, unidadeId, inicio.toISOString(), fim.toISOString()),
    listarQuitadasNoMes(supabase, 'receber', unidadeId, mes),
    listarQuitadasNoMes(supabase, 'pagar', unidadeId, mes),
  ]);

  const porDia = new Map<string, DiaFluxo>();
  for (let d = 1; d <= dias; d++) {
    const data = mes + '-' + doisDigitos(d);
    porDia.set(data, { data, vendas: 0, recebidas: 0, pagas: 0, saldo: 0 });
  }
  for (const v of vendas) {
    const dia = porDia.get(dataLocal(new Date(v.quando)));
    if (dia) dia.vendas += v.valor;
  }
  for (const c of recebidas) {
    const dia = porDia.get(c.quitado_em!);
    if (dia) dia.recebidas += c.valor;
  }
  for (const c of pagas) {
    const dia = porDia.get(c.quitado_em!);
    if (dia) dia.pagas += c.valor;
  }

  const lista = [...porDia.values()];
  lista.forEach((d) => (d.saldo = d.vendas + d.recebidas - d.pagas));

  const totais = lista.reduce(
    (acc, d) => ({
      vendas: acc.vendas + d.vendas,
      recebidas: acc.recebidas + d.recebidas,
      pagas: acc.pagas + d.pagas,
    }),
    { vendas: 0, recebidas: 0, pagas: 0 }
  );

  return { dias: lista, totais: { ...totais, saldo: totais.vendas + totais.recebidas - totais.pagas } };
}

// ---------- DRE ----------

export async function carregarDre(supabase: SupabaseClient, unidadeId: string, mes: string) {
  const { inicio, fim } = limitesMes(mes);
  const [vendas, recebidas, pagas, resMov, resCustos] = await Promise.all([
    listarVendas(supabase, unidadeId, inicio.toISOString(), fim.toISOString()),
    listarQuitadasNoMes(supabase, 'receber', unidadeId, mes),
    listarQuitadasNoMes(supabase, 'pagar', unidadeId, mes),
    supabase
      .from('movimentacoes_estoque')
      .select('ingrediente_id, tipo, quantidade, observacao')
      .eq('unidade_id', unidadeId)
      .in('tipo', ['consumo', 'entrada'])
      .gte('criado_em', inicio.toISOString())
      .lt('criado_em', fim.toISOString()),
    supabase.from('estoque_saldo').select('ingrediente_id, custo_unitario').eq('unidade_id', unidadeId),
  ]);
  if (resMov.error) throw resMov.error;
  if (resCustos.error) throw resCustos.error;

  // CMV: o que saiu do estoque nas vendas, menos o que voltou (estorno da cozinha),
  // usando o custo unitário atual de cada produto
  const custo = new Map((resCustos.data || []).map((e) => [e.ingrediente_id, Number(e.custo_unitario) || 0]));
  let cmv = 0;
  for (const m of resMov.data || []) {
    const valor = Number(m.quantidade) * (custo.get(m.ingrediente_id) || 0);
    if (m.tipo === 'consumo') cmv += valor;
    else if ((m.observacao || '').startsWith('Estorno')) cmv -= valor;
  }

  const faturamentoVendas = vendas.reduce((a, v) => a + v.valor, 0);
  const outrasReceitas = recebidas.reduce((a, c) => a + c.valor, 0);
  const faturamento = faturamentoVendas + outrasReceitas;

  // compra de mercadoria vira estoque; ela entra no lucro pelo CMV quando é vendida
  const comprasMercadoria = pagas
    .filter((c) => c.categoria === 'fornecedores')
    .reduce((a, c) => a + c.valor, 0);

  const porCategoria = new Map<string, number>();
  for (const c of pagas) {
    if (c.categoria === 'fornecedores') continue;
    porCategoria.set(c.categoria, (porCategoria.get(c.categoria) || 0) + c.valor);
  }
  const despesas = [...porCategoria.entries()]
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const totalDespesas = despesas.reduce((a, d) => a + d.valor, 0);

  const lucroBruto = faturamento - cmv;
  const lucroLiquido = lucroBruto - totalDespesas;

  return {
    faturamentoVendas,
    outrasReceitas,
    faturamento,
    cmv,
    lucroBruto,
    despesas,
    totalDespesas,
    lucroLiquido,
    margemPct: faturamento > 0 ? (lucroLiquido / faturamento) * 100 : null,
    comprasMercadoria,
    quantidadeVendas: vendas.length,
  };
}
