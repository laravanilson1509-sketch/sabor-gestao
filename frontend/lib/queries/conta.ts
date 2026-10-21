// lib/queries/conta.ts — produção, ajustes da comanda e fechamento de conta
//
// Tudo que mexe em dinheiro ou precisa de autorização passa por funções do
// banco (rpc): elas conferem o PIN, travam o pedido enquanto gravam e deixam
// registro na auditoria. O navegador só pede.

import type { SupabaseClient } from '@supabase/supabase-js';

export type Pagamento = {
  id: string;
  forma: string;
  valor: number;
  valor_recebido: number | null;
  troco: number;
  pagador: string | null;
  itens: string[] | null; // divisão por item: ids pagos neste pagamento
  transacao_id: string | null;
  status: 'confirmado' | 'estornado';
  operador_email: string | null;
  criado_em: string;
  estornado_por: string | null;
  estorno_motivo: string | null;
};

export type Fechamento = {
  id: string;
  versao: number;
  total: number;
  fechado_em: string;
  fechado_por: string | null;
  reaberto_em: string | null;
  reaberto_por: string | null;
  reaberto_motivo: string | null;
};

export type RegistroAuditoria = {
  id: string;
  acao: string;
  motivo: string | null;
  detalhes: any;
  operador_email: string | null;
  autorizado_por_nome: string | null;
  criado_em: string;
};

export type Operador = {
  id: string;
  nome: string;
  perfil: 'atendente' | 'caixa' | 'gerente' | 'administrador';
  ativo: boolean;
};

export type Adicional = { nome: string; valor: number };

export const PERFIS: Record<Operador['perfil'], string> = {
  atendente: 'Atendente',
  caixa: 'Caixa',
  gerente: 'Gerente',
  administrador: 'Administrador',
};

// espelho de pdv_perfil_pode() no banco, só para mostrar na tela
export const PERMISSOES: { acao: string; rotulo: string; perfis: Operador['perfil'][] }[] = [
  { acao: 'desconto', rotulo: 'Dar desconto (caixa até o limite configurado)', perfis: ['caixa', 'gerente', 'administrador'] },
  { acao: 'remover_taxa', rotulo: 'Retirar a taxa de serviço', perfis: ['caixa', 'gerente', 'administrador'] },
  { acao: 'cancelar_item', rotulo: 'Cancelar item já enviado à produção', perfis: ['gerente', 'administrador'] },
  { acao: 'cortesia', rotulo: 'Dar cortesia em item', perfis: ['gerente', 'administrador'] },
  { acao: 'cancelar_pedido', rotulo: 'Cancelar pedido com itens em produção', perfis: ['gerente', 'administrador'] },
  { acao: 'estornar_pagamento', rotulo: 'Estornar pagamento', perfis: ['gerente', 'administrador'] },
  { acao: 'fechar_pendente', rotulo: 'Fechar com valor a receber (fiado)', perfis: ['gerente', 'administrador'] },
  { acao: 'reabrir_conta', rotulo: 'Reabrir conta fechada', perfis: ['gerente', 'administrador'] },
  { acao: 'gerenciar_operadores', rotulo: 'Cadastrar operadores e PINs', perfis: ['gerente', 'administrador'] },
];

export const ROTULO_ACAO: Record<string, string> = {
  cancelar_item: 'Item cancelado',
  alterar_item: 'Item alterado',
  cortesia: 'Cortesia',
  cortesia_removida: 'Cortesia retirada',
  desconto: 'Desconto',
  desconto_removido: 'Desconto retirado',
  taxa_removida: 'Taxa de serviço retirada',
  taxa_incluida: 'Taxa de serviço incluída',
  estornar_pagamento: 'Pagamento estornado',
  fechar_pendente: 'Fechada com valor a receber',
  reabrir_conta: 'Conta reaberta',
  cancelar_pedido: 'Pedido cancelado',
  reimpressao: 'Reimpressão',
  operador_salvo: 'Operador salvo',
};

const rpc = async (supabase: SupabaseClient, nome: string, params: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(nome, params);
  if (error) throw new Error(error.message);
  return data;
};

// ---------- produção ----------

export async function enviarProducao(
  supabase: SupabaseClient,
  pedidoId: string,
  itensSemEstoque: string[],
  terminalId: string | null
) {
  return (await rpc(supabase, 'pdv_enviar_producao', {
    p_pedido: pedidoId,
    p_itens_sem_estoque: itensSemEstoque,
    p_terminal: terminalId,
  })) as number;
}

export async function alterarItem(
  supabase: SupabaseClient,
  params: {
    itemId: string;
    observacao: string;
    restricao: string;
    adicionais: Adicional[];
    separarUm: boolean;
    terminalId: string | null;
  }
) {
  await rpc(supabase, 'pdv_alterar_item', {
    p_item: params.itemId,
    p_observacao: params.observacao,
    p_restricao: params.restricao,
    p_adicionais: params.adicionais,
    p_separar_um: params.separarUm,
    p_terminal: params.terminalId,
  });
}

export async function cancelarItem(
  supabase: SupabaseClient,
  params: {
    itemId: string;
    quantidade: number;
    motivo: string;
    devolverEstoque: boolean;
    pin: string;
    terminalId: string | null;
  }
) {
  await rpc(supabase, 'pdv_cancelar_item', {
    p_item: params.itemId,
    p_quantidade: params.quantidade,
    p_motivo: params.motivo,
    p_devolver_estoque: params.devolverEstoque,
    p_pin: params.pin,
    p_terminal: params.terminalId,
  });
}

export async function definirCortesia(
  supabase: SupabaseClient,
  params: { itemId: string; cortesia: boolean; motivo: string; pin: string; terminalId: string | null }
) {
  await rpc(supabase, 'pdv_cortesia_item', {
    p_item: params.itemId,
    p_cortesia: params.cortesia,
    p_motivo: params.motivo,
    p_pin: params.pin,
    p_terminal: params.terminalId,
  });
}

export async function cancelarPedidoAutorizado(
  supabase: SupabaseClient,
  params: { pedidoId: string; motivo: string; pin: string; terminalId: string | null }
) {
  await rpc(supabase, 'pdv_cancelar_pedido', {
    p_pedido: params.pedidoId,
    p_motivo: params.motivo,
    p_pin: params.pin || null,
    p_terminal: params.terminalId,
  });
}

// ---------- conta ----------

export async function aplicarDesconto(
  supabase: SupabaseClient,
  params: { pedidoId: string; valor: number | null; pct: number | null; motivo: string; pin: string; terminalId: string | null }
) {
  await rpc(supabase, 'pdv_aplicar_desconto', {
    p_pedido: params.pedidoId,
    p_valor: params.valor,
    p_pct: params.pct,
    p_motivo: params.motivo,
    p_pin: params.pin || null,
    p_terminal: params.terminalId,
  });
}

export async function definirTaxaServico(
  supabase: SupabaseClient,
  params: { pedidoId: string; cobrar: boolean; motivo: string; pin: string; terminalId: string | null }
) {
  await rpc(supabase, 'pdv_definir_taxa_servico', {
    p_pedido: params.pedidoId,
    p_cobrar: params.cobrar,
    p_motivo: params.motivo,
    p_pin: params.pin || null,
    p_terminal: params.terminalId,
  });
}

export async function imprimirPreConta(
  supabase: SupabaseClient,
  pedidoId: string,
  pessoas: number,
  terminalId: string | null
) {
  await rpc(supabase, 'pdv_imprimir_pre_conta', {
    p_pedido: pedidoId,
    p_pessoas: pessoas,
    p_terminal: terminalId,
  });
}

export async function listarPagamentos(supabase: SupabaseClient, pedidoId: string) {
  const { data, error } = await supabase
    .from('pdv_pagamentos')
    .select('id, forma, valor, valor_recebido, troco, pagador, itens, transacao_id, status, operador_email, criado_em, estornado_por, estorno_motivo')
    .eq('pedido_id', pedidoId)
    .order('criado_em');
  if (error) throw error;
  return (data || []) as Pagamento[];
}

// a chave é gerada uma vez por tentativa: clicar de novo com a mesma chave
// devolve o pagamento já gravado em vez de cobrar duas vezes
export async function registrarPagamento(
  supabase: SupabaseClient,
  params: {
    pedidoId: string;
    forma: string;
    valor: number;
    valorRecebido: number | null;
    pagador: string;
    transacao: string;
    itens: string[] | null;
    chave: string;
    terminalId: string | null;
  }
) {
  return (await rpc(supabase, 'pdv_registrar_pagamento', {
    p_pedido: params.pedidoId,
    p_forma: params.forma,
    p_valor: params.valor,
    p_valor_recebido: params.valorRecebido,
    p_pagador: params.pagador,
    p_transacao: params.transacao,
    p_itens: params.itens,
    p_chave: params.chave,
    p_terminal: params.terminalId,
  })) as Pagamento;
}

export async function estornarPagamento(
  supabase: SupabaseClient,
  params: { pagamentoId: string; motivo: string; pin: string; terminalId: string | null }
) {
  await rpc(supabase, 'pdv_estornar_pagamento', {
    p_pagamento: params.pagamentoId,
    p_motivo: params.motivo,
    p_pin: params.pin,
    p_terminal: params.terminalId,
  });
}

export async function fecharConta(supabase: SupabaseClient, pedidoId: string, terminalId: string | null) {
  await rpc(supabase, 'pdv_fechar_conta', { p_pedido: pedidoId, p_terminal: terminalId });
}

export async function fecharComPendencia(
  supabase: SupabaseClient,
  params: {
    pedidoId: string;
    devedor: string;
    vencimento: string;
    motivo: string;
    pin: string;
    chave: string;
    terminalId: string | null;
  }
) {
  await rpc(supabase, 'pdv_fechar_com_pendencia', {
    p_pedido: params.pedidoId,
    p_devedor: params.devedor,
    p_vencimento: params.vencimento,
    p_motivo: params.motivo,
    p_pin: params.pin,
    p_chave: params.chave,
    p_terminal: params.terminalId,
  });
}

export async function reabrirConta(
  supabase: SupabaseClient,
  params: { pedidoId: string; motivo: string; pin: string; terminalId: string | null }
) {
  await rpc(supabase, 'pdv_reabrir_conta', {
    p_pedido: params.pedidoId,
    p_motivo: params.motivo,
    p_pin: params.pin,
    p_terminal: params.terminalId,
  });
}

// ---------- histórico ----------

export type ContaFechada = {
  id: string;
  numero: number;
  canal: 'mesa' | 'balcao';
  mesa_id: string | null;
  nome_cliente: string | null;
  forma_pagamento: string | null;
  total: number;
  fechado_em: string;
  fechado_por: string | null;
  reaberturas: number;
};

export async function listarFechadasHoje(supabase: SupabaseClient, unidadeId: string) {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('pdv_pedidos')
    .select('id, numero, canal, mesa_id, nome_cliente, forma_pagamento, total, fechado_em, fechado_por, reaberturas')
    .eq('unidade_id', unidadeId)
    .eq('status', 'fechado')
    .gte('fechado_em', inicio.toISOString())
    .order('fechado_em', { ascending: false });
  if (error) throw error;
  return (data || []) as ContaFechada[];
}

export async function listarHistoricoPedido(supabase: SupabaseClient, pedidoId: string) {
  const [aud, fech] = await Promise.all([
    supabase
      .from('pdv_auditoria')
      .select('id, acao, motivo, detalhes, operador_email, autorizado_por_nome, criado_em')
      .eq('pedido_id', pedidoId)
      .order('criado_em', { ascending: false }),
    supabase
      .from('pdv_fechamentos')
      .select('id, versao, total, fechado_em, fechado_por, reaberto_em, reaberto_por, reaberto_motivo')
      .eq('pedido_id', pedidoId)
      .order('versao'),
  ]);
  if (aud.error) throw aud.error;
  if (fech.error) throw fech.error;
  return {
    auditoria: (aud.data || []) as RegistroAuditoria[],
    fechamentos: (fech.data || []) as Fechamento[],
  };
}

// ---------- operadores (PIN) ----------

export async function listarOperadores(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_operadores')
    .select('id, nome, perfil, ativo')
    .eq('unidade_id', unidadeId)
    .order('nome');
  if (error) throw error;
  return (data || []) as Operador[];
}

export async function salvarOperador(
  supabase: SupabaseClient,
  unidadeId: string,
  params: { id?: string; nome: string; perfil: Operador['perfil']; ativo: boolean; pinNovo: string; pinAutorizador: string }
) {
  await rpc(supabase, 'pdv_salvar_operador', {
    p_unidade: unidadeId,
    p_id: params.id ?? null,
    p_nome: params.nome,
    p_perfil: params.perfil,
    p_ativo: params.ativo,
    p_pin_novo: params.pinNovo || null,
    p_pin_autorizador: params.pinAutorizador || null,
  });
}

export async function listarAuditoria(supabase: SupabaseClient, unidadeId: string, desde: string) {
  const { data, error } = await supabase
    .from('pdv_auditoria')
    .select('id, acao, motivo, detalhes, operador_email, autorizado_por_nome, criado_em')
    .eq('unidade_id', unidadeId)
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []) as RegistroAuditoria[];
}
