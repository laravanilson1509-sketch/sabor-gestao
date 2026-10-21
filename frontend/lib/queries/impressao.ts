// lib/queries/impressao.ts — impressoras, setores, rotas, terminais e fila de impressão

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Documento } from '@/lib/impressao/layout';

export type Setor = { id: string; nome: string; padrao: boolean; ordem: number; ativo: boolean };

export type Impressora = {
  id: string;
  nome: string;
  largura_mm: 58 | 80;
  conexao: 'navegador' | 'escpos_rede' | 'escpos_usb';
  endereco: string | null;
  copias: number;
  fonte: 'normal' | 'grande';
  cortar_papel: boolean;
  ativo: boolean;
  ultimo_sinal: string | null;
};

export type Rota = {
  id: string;
  documento: 'producao' | 'conta';
  setor_id: string | null;
  terminal_id: string | null;
  impressora_id: string;
};

export type Terminal = { id: string; nome: string };

export type StatusImpressao = 'pendente' | 'imprimindo' | 'impresso' | 'falha' | 'sem_impressora';

export type Impressao = {
  id: string;
  documento: Documento;
  pedido_id: string | null;
  setor_id: string | null;
  impressora_id: string | null;
  titulo: string;
  conteudo: any;
  status: StatusImpressao;
  tentativas: number;
  erro: string | null;
  via: number;
  reimpressao_de: string | null;
  solicitado_por: string | null;
  estacao: string | null;
  criado_em: string;
  impresso_em: string | null;
};

export type ConfigPdv = {
  unidade_id: string;
  nome_estabelecimento: string | null;
  documento: string | null;
  endereco: string | null;
  telefone: string | null;
  rodape: string | null;
  taxa_servico_pct: number;
  taxa_servico_mesa: boolean;
  taxa_servico_balcao: boolean;
  remover_taxa_exige_pin: boolean;
  desconto_max_caixa_pct: number;
  imprimir_producao_auto: boolean;
  imprimir_comprovante_auto: boolean;
  imprimir_via_estabelecimento: boolean;
  exigir_caixa_aberto: boolean;
};

export const ROTULO_STATUS: Record<StatusImpressao, { rotulo: string; cor: string }> = {
  pendente: { rotulo: 'Na fila', cor: 'bg-[#FFF0C7] text-[#7A5A0A]' },
  imprimindo: { rotulo: 'Imprimindo', cor: 'bg-[#DCEEF2] text-[#0B4F5E]' },
  impresso: { rotulo: 'Impresso', cor: 'bg-[#D9F0E3] text-[#1E6B3F]' },
  falha: { rotulo: 'Falhou', cor: 'bg-[#FADBD6] text-[#B3261E]' },
  sem_impressora: { rotulo: 'Sem impressora', cor: 'bg-[#FADBD6] text-[#B3261E]' },
};

// uma estação que não busca a fila há mais que isso é considerada desligada
export const SEGUNDOS_ESTACAO_ONLINE = 60;

export const impressoraOnline = (i: Pick<Impressora, 'ultimo_sinal'>) =>
  !!i.ultimo_sinal && Date.now() - new Date(i.ultimo_sinal).getTime() < SEGUNDOS_ESTACAO_ONLINE * 1000;

const CAMPOS_IMPRESSORA =
  'id, nome, largura_mm, conexao, endereco, copias, fonte, cortar_papel, ativo, ultimo_sinal';
const CAMPOS_IMPRESSAO =
  'id, documento, pedido_id, setor_id, impressora_id, titulo, conteudo, status, tentativas, erro, via, reimpressao_de, solicitado_por, estacao, criado_em, impresso_em';

// ---------- configuração da conta / cupom ----------

export async function carregarConfig(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase.rpc('pdv_obter_config', { p_unidade: unidadeId });
  if (error) throw error;
  return data as ConfigPdv;
}

export async function salvarConfig(supabase: SupabaseClient, config: ConfigPdv) {
  const { error } = await supabase
    .from('pdv_config')
    .update({ ...config, atualizado_em: new Date().toISOString() })
    .eq('unidade_id', config.unidade_id);
  if (error) throw error;
}

// ---------- setores ----------

export async function listarSetores(supabase: SupabaseClient, unidadeId: string) {
  await supabase.rpc('pdv_garantir_setores', { p_unidade: unidadeId });
  const { data, error } = await supabase
    .from('pdv_setores')
    .select('id, nome, padrao, ordem, ativo')
    .eq('unidade_id', unidadeId)
    .order('ordem');
  if (error) throw error;
  return (data || []) as Setor[];
}

export async function criarSetor(supabase: SupabaseClient, unidadeId: string, nome: string, ordem: number) {
  const { error } = await supabase.from('pdv_setores').insert({ unidade_id: unidadeId, nome, ordem });
  if (error) {
    if (error.code === '23505') throw new Error('Já existe um setor com esse nome.');
    throw error;
  }
}

export async function atualizarSetor(supabase: SupabaseClient, id: string, dados: Partial<Setor>) {
  const { error } = await supabase.from('pdv_setores').update(dados).eq('id', id);
  if (error) throw error;
}

// só um setor pode ser o padrão
export async function definirSetorPadrao(supabase: SupabaseClient, unidadeId: string, id: string) {
  const { error: e1 } = await supabase.from('pdv_setores').update({ padrao: false }).eq('unidade_id', unidadeId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('pdv_setores').update({ padrao: true }).eq('id', id);
  if (e2) throw e2;
}

export type ProdutoSetor = { id: string; nome: string; tipo_produto: string; setor_id: string | null };

export async function listarProdutosComSetor(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('ingredientes')
    .select('id, nome, tipo_produto, setor_id')
    .in('tipo_produto', ['prato', 'acabado'])
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return (data || []) as ProdutoSetor[];
}

export async function definirSetorProduto(supabase: SupabaseClient, produtoId: string, setorId: string | null) {
  const { error } = await supabase.from('ingredientes').update({ setor_id: setorId }).eq('id', produtoId);
  if (error) throw error;
}

// ---------- impressoras ----------

export async function listarImpressoras(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_impressoras')
    .select(CAMPOS_IMPRESSORA)
    .eq('unidade_id', unidadeId)
    .order('nome');
  if (error) throw error;
  return (data || []) as Impressora[];
}

export async function salvarImpressora(
  supabase: SupabaseClient,
  unidadeId: string,
  dados: Omit<Impressora, 'id' | 'ultimo_sinal'> & { id?: string }
) {
  // ultimo_sinal é da estação: o formulário não mexe nele
  const { id, ultimo_sinal: _sinal, ...resto } = dados as typeof dados & { ultimo_sinal?: string | null };
  const { error } = id
    ? await supabase.from('pdv_impressoras').update(resto).eq('id', id)
    : await supabase.from('pdv_impressoras').insert({ ...resto, unidade_id: unidadeId });
  if (error) throw error;
}

export async function excluirImpressora(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('pdv_impressoras').delete().eq('id', id);
  if (error) throw error;
}

// ---------- rotas (qual impressora imprime o quê) ----------

export async function listarRotas(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_rotas_impressao')
    .select('id, documento, setor_id, terminal_id, impressora_id')
    .eq('unidade_id', unidadeId);
  if (error) throw error;
  return (data || []) as Rota[];
}

// grava a rota; impressora vazia apaga a rota
export async function definirRota(
  supabase: SupabaseClient,
  unidadeId: string,
  params: { documento: 'producao' | 'conta'; setorId: string | null; terminalId: string | null; impressoraId: string | null }
) {
  let apagar = supabase
    .from('pdv_rotas_impressao')
    .delete()
    .eq('unidade_id', unidadeId)
    .eq('documento', params.documento);
  apagar = params.setorId ? apagar.eq('setor_id', params.setorId) : apagar.is('setor_id', null);
  apagar = params.terminalId ? apagar.eq('terminal_id', params.terminalId) : apagar.is('terminal_id', null);
  const { error: e1 } = await apagar;
  if (e1) throw e1;
  if (!params.impressoraId) return;
  const { error } = await supabase.from('pdv_rotas_impressao').insert({
    unidade_id: unidadeId,
    documento: params.documento,
    setor_id: params.setorId,
    terminal_id: params.terminalId,
    impressora_id: params.impressoraId,
  });
  if (error) throw error;
}

// ---------- terminais ----------

export async function listarTerminais(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_terminais')
    .select('id, nome')
    .eq('unidade_id', unidadeId)
    .order('nome');
  if (error) throw error;
  return (data || []) as Terminal[];
}

export async function criarTerminal(supabase: SupabaseClient, unidadeId: string, nome: string) {
  const { data, error } = await supabase
    .from('pdv_terminais')
    .insert({ unidade_id: unidadeId, nome })
    .select('id, nome')
    .single();
  if (error) throw error;
  return data as Terminal;
}

export async function renomearTerminal(supabase: SupabaseClient, id: string, nome: string) {
  const { error } = await supabase.from('pdv_terminais').update({ nome }).eq('id', id);
  if (error) throw error;
}

export async function excluirTerminal(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('pdv_terminais').delete().eq('id', id);
  if (error) throw error;
}

// ---------- fila ----------

export async function listarFila(
  supabase: SupabaseClient,
  unidadeId: string,
  filtro: { desde: string; pedidoId?: string; apenasProblemas?: boolean }
) {
  let q = supabase
    .from('pdv_impressoes')
    .select(CAMPOS_IMPRESSAO)
    .eq('unidade_id', unidadeId)
    .order('criado_em', { ascending: false })
    .limit(200);
  q = filtro.pedidoId ? q.eq('pedido_id', filtro.pedidoId) : q.gte('criado_em', filtro.desde);
  if (filtro.apenasProblemas) q = q.in('status', ['falha', 'sem_impressora']);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Impressao[];
}

// quantos documentos estão com problema (falha, sem impressora ou parados na fila)
export async function contarProblemasFila(supabase: SupabaseClient, unidadeId: string) {
  const doisMinutos = new Date(Date.now() - 2 * 60000).toISOString();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [falhas, parados] = await Promise.all([
    supabase
      .from('pdv_impressoes')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId)
      .in('status', ['falha', 'sem_impressora'])
      .gte('criado_em', hoje.toISOString()),
    supabase
      .from('pdv_impressoes')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId)
      .eq('status', 'pendente')
      .lt('criado_em', doisMinutos)
      .gte('criado_em', hoje.toISOString()),
  ]);
  if (falhas.error) throw falhas.error;
  if (parados.error) throw parados.error;
  return (falhas.count || 0) + (parados.count || 0);
}

export async function reimprimir(supabase: SupabaseClient, id: string, terminalId: string | null, motivo: string) {
  const { error } = await supabase.rpc('pdv_reimprimir', {
    p_id: id,
    p_terminal: terminalId,
    p_motivo: motivo || null,
  });
  if (error) throw error;
}

export async function tentarNovamente(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.rpc('pdv_tentar_novamente', { p_id: id });
  if (error) throw error;
}

// ---------- estação de impressão ----------

export async function pegarImpressoes(supabase: SupabaseClient, impressoras: string[], estacao: string) {
  const { data, error } = await supabase.rpc('pdv_pegar_impressoes', {
    p_impressoras: impressoras,
    p_estacao: estacao,
  });
  if (error) throw error;
  return (data || []) as Impressao[];
}

export async function confirmarImpressao(supabase: SupabaseClient, id: string, ok: boolean, erro?: string) {
  const { error } = await supabase.rpc('pdv_confirmar_impressao', {
    p_id: id,
    p_ok: ok,
    p_erro: erro || null,
  });
  if (error) throw error;
}

// mensagem amigável quando o SQL desta parte ainda não foi rodado no Supabase
export function erroImpressao(e: any, padrao: string) {
  const msg: string = e?.message || '';
  if (msg.includes('pdv_') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('Could not find'))) {
    return 'Falta rodar o SQL 0018_impressao_fechamento_conta.sql no Supabase.';
  }
  return msg || padrao;
}
