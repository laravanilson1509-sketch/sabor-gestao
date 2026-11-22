// lib/queries/cozinha.ts — Cozinha (KDS): junta itens do PDV e pedidos do delivery

import type { SupabaseClient } from '@supabase/supabase-js';

export type StatusCozinha = 'novo' | 'preparando' | 'pronto';

export type CartaoCozinha = {
  chave: string;
  origem: 'mesa' | 'balcao' | 'delivery';
  titulo: string;
  subtitulo: string | null;
  status: StatusCozinha;
  chegouEm: string; // quando o pedido chegou na cozinha
  desde: string; // quando entrou no status atual
  itens: { nome: string; quantidade: number; observacao: string | null; semEstoque: boolean; produtoId: string | null }[];
  pedidoId: string | null; // PDV: o pedido deste cartão (delivery não tem)
  itemIds: string[]; // PDV: os itens deste cartão
  deliveryId: string | null;
  deliveryStatus: string | null;
  codigo: string | null; // código da comanda (C0123); delivery não tem
  enviadoPor: string | null; // login de quem mandou o pedido para a cozinha
  alertaEm: string | null; // quando a cozinha avisou que está pronto
};

// Erro de "coluna não existe": o SQL 0022 ainda não foi rodado no Supabase.
const faltaColuna = (e: any) => e && (e.code === '42703' || /column .* does not exist|Could not find the .* column/i.test(e.message || ''));

const COLUNAS_ITEM = 'id, pedido_id, produto_id, nome, quantidade, observacao, restricao, adicionais, status_cozinha, enviado_cozinha_em, iniciado_em, pronto_em, sem_estoque';
const COLUNAS_ITEM_NOVAS = COLUNAS_ITEM + ', enviado_por, alerta_em, alerta_por, retirado_em';

// por quanto tempo um pedido pronto continua aparecendo na coluna "Pronto"
const MINUTOS_PRONTO_VISIVEL = 30;

const menorData = (datas: (string | null)[]) =>
  datas.filter(Boolean).sort()[0] as string | undefined;
const maiorData = (datas: (string | null)[]) =>
  datas.filter(Boolean).sort().reverse()[0] as string | undefined;

// restrição (alergia) vem primeiro e em maiúsculas; depois adicionais e observação
function juntarObservacao(i: { observacao: string | null; restricao?: string | null; adicionais?: { nome: string }[] }) {
  const partes = [
    i.restricao ? '⚠ ' + i.restricao.toUpperCase() : null,
    ...(i.adicionais || []).map((a) => '+ ' + a.nome),
    i.observacao,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : null;
}

export async function listarFilaCozinha(
  supabase: SupabaseClient,
  unidadeId: string
): Promise<CartaoCozinha[]> {
  const buscarPedidos = (colunas: string) =>
    supabase.from('pdv_pedidos').select(colunas).eq('unidade_id', unidadeId).eq('status', 'aberto');
  let resPedidosBruto: any = await buscarPedidos('id, numero, canal, mesa_id, nome_cliente, codigo');
  const migrado = !faltaColuna(resPedidosBruto.error);
  if (!migrado) resPedidosBruto = await buscarPedidos('id, numero, canal, mesa_id, nome_cliente');

  const [resMesas, resDelivery] = await Promise.all([
    supabase.from('pdv_mesas').select('id, numero').eq('unidade_id', unidadeId),
    supabase
      .from('pedidos_delivery')
      .select('id, telefone_cliente, itens, status, status_cozinha, criado_em, iniciado_em, pronto_em')
      .eq('unidade_id', unidadeId)
      .not('status_cozinha', 'is', null)
      .not('status', 'in', '(cancelado,entregue,saiu_entrega)'),
  ]);
  const resPedidos = resPedidosBruto as { data: any[] | null; error: any };
  if (resPedidos.error) throw resPedidos.error;
  if (resMesas.error) throw resMesas.error;
  if (resDelivery.error) throw resDelivery.error;

  const pedidos = resPedidos.data || [];
  const numeroMesa = new Map((resMesas.data || []).map((m) => [m.id, m.numero]));

  let itensPdv: any[] = [];
  if (pedidos.length > 0) {
    const { data, error } = await supabase
      .from('pdv_pedido_itens')
      .select(migrado ? COLUNAS_ITEM_NOVAS : COLUNAS_ITEM)
      .in('pedido_id', pedidos.map((p) => p.id))
      .not('status_cozinha', 'is', null)
      .eq('cancelado', false);
    if (error) throw error;
    // quem já foi retirado sai da fila (vai para os finalizados)
    itensPdv = ((data as any[]) || []).filter((i) => !i.retirado_em);
  }

  const cartoes: CartaoCozinha[] = [];

  // PDV: um cartão por pedido + status (uma mesa pode ter uma rodada nova
  // enquanto a anterior ainda está sendo preparada)
  const grupos = new Map<string, any[]>();
  for (const item of itensPdv) {
    const chave = item.pedido_id + ':' + item.status_cozinha;
    grupos.set(chave, [...(grupos.get(chave) || []), item]);
  }
  for (const [chave, itens] of grupos) {
    const pedido = pedidos.find((p) => p.id === itens[0].pedido_id)!;
    const status = itens[0].status_cozinha as StatusCozinha;
    const chegouEm = menorData(itens.map((i) => i.enviado_cozinha_em))!;
    const desde =
      status === 'novo'
        ? chegouEm
        : status === 'preparando'
        ? menorData(itens.map((i) => i.iniciado_em)) || chegouEm
        : maiorData(itens.map((i) => i.pronto_em)) || chegouEm;

    cartoes.push({
      chave,
      origem: pedido.canal === 'mesa' ? 'mesa' : 'balcao',
      titulo:
        pedido.canal === 'mesa'
          ? 'Mesa ' + (numeroMesa.get(pedido.mesa_id) ?? '')
          : 'Balcão #' + pedido.numero,
      subtitulo: pedido.nome_cliente,
      status,
      chegouEm,
      desde,
      itens: itens.map((i) => ({
        nome: i.nome,
        quantidade: i.quantidade,
        observacao: juntarObservacao(i),
        semEstoque: Boolean(i.sem_estoque),
        produtoId: i.produto_id || null,
      })),
      pedidoId: pedido.id,
      itemIds: itens.map((i) => i.id),
      deliveryId: null,
      deliveryStatus: null,
      codigo: pedido.codigo || null,
      enviadoPor: itens.find((i) => i.enviado_por)?.enviado_por || null,
      alertaEm: maiorData(itens.map((i) => i.alerta_em)) || null,
    });
  }

  for (const d of resDelivery.data || []) {
    const status = d.status_cozinha as StatusCozinha;
    cartoes.push({
      chave: 'delivery:' + d.id,
      origem: 'delivery',
      titulo: 'Delivery',
      subtitulo: d.telefone_cliente,
      status,
      chegouEm: d.criado_em,
      desde:
        status === 'novo'
          ? d.criado_em
          : status === 'preparando'
          ? d.iniciado_em || d.criado_em
          : d.pronto_em || d.criado_em,
      itens: (d.itens || []).map((i: any) => ({
        nome: i.nome,
        quantidade: i.quantidade,
        observacao: i.observacao || null,
        semEstoque: false,
        produtoId: i.ingrediente_id || null,
      })),
      pedidoId: null,
      itemIds: [],
      deliveryId: d.id,
      deliveryStatus: d.status,
      codigo: null,
      enviadoPor: null,
      alertaEm: null,
    });
  }

  const limitePronto = Date.now() - MINUTOS_PRONTO_VISIVEL * 60000;
  return cartoes
    // pedido do PDV pronto fica até o colaborador retirar; o do delivery some depois de um tempo
    .filter((c) => c.status !== 'pronto' || !c.deliveryId || new Date(c.desde).getTime() >= limitePronto)
    .sort((a, b) => a.chegouEm.localeCompare(b.chegouEm));
}

export async function mudarStatusCartao(
  supabase: SupabaseClient,
  cartao: CartaoCozinha,
  status: StatusCozinha
) {
  if (cartao.deliveryId) {
    const dados: Record<string, string> = { status_cozinha: status };
    // a tela de Delivery acompanha: começou o preparo, o pedido fica "Em preparo"
    if (status === 'preparando' && cartao.deliveryStatus === 'novo') dados.status = 'em_preparo';
    const { error } = await supabase.from('pedidos_delivery').update(dados).eq('id', cartao.deliveryId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('pdv_pedido_itens')
    .update({ status_cozinha: status })
    .in('id', cartao.itemIds);
  if (error) throw error;
}


// ---------------------------------------------------------------------------
// Retirada: alerta ao colaborador, confirmação e pedidos finalizados
// ---------------------------------------------------------------------------

// A cozinha avisa quem enviou o pedido que ele já pode ser retirado.
export async function enviarAlerta(supabase: SupabaseClient, cartao: CartaoCozinha, porEmail: string) {
  const { error } = await supabase
    .from('pdv_pedido_itens')
    .update({ alerta_em: new Date().toISOString(), alerta_por: porEmail })
    .in('id', cartao.itemIds);
  if (error) throw error;
}

// Confirma que o pedido foi retirado: ele sai de "Prontos" e vai para "Finalizados".
export async function confirmarRetirada(supabase: SupabaseClient, itemIds: string[], porEmail: string) {
  const { error } = await supabase
    .from('pdv_pedido_itens')
    .update({ retirado_em: new Date().toISOString(), retirado_por: porEmail })
    .in('id', itemIds);
  if (error) throw error;
}

// confere se o SQL 0022 já foi rodado
export async function retiradaDisponivel(supabase: SupabaseClient) {
  const { error } = await supabase.from('pdv_pedido_itens').select('retirado_em').limit(1);
  return !faltaColuna(error);
}

export type PedidoRetirada = {
  chave: string;
  pedidoId: string;
  itemIds: string[];
  titulo: string; // Mesa 5 · Balcão #12
  codigo: string | null;
  cliente: string | null; // nome do pedido ou de quem reservou a mesa
  enviadoPor: string | null;
  alertaEm: string | null;
  alertaPor: string | null;
  prontoEm: string | null;
  retiradoEm: string | null;
  retiradoPor: string | null;
  itens: { nome: string; quantidade: number }[];
};

// monta os grupos a partir de linhas de itens + dados dos pedidos e mesas
async function montarRetiradas(supabase: SupabaseClient, itens: any[], agruparPorRetirada: boolean): Promise<PedidoRetirada[]> {
  if (itens.length === 0) return [];
  const ids = Array.from(new Set(itens.map((i) => i.pedido_id)));
  const { data: pedidos, error } = await supabase
    .from('pdv_pedidos')
    .select('id, numero, canal, mesa_id, nome_cliente, codigo')
    .in('id', ids);
  if (error) throw error;
  const mesaIds = Array.from(new Set((pedidos || []).map((p: any) => p.mesa_id).filter(Boolean)));
  const { data: mesas } = mesaIds.length ? await supabase.from('pdv_mesas').select('id, numero').in('id', mesaIds) : { data: [] as any[] };
  const numeroMesa = new Map((mesas || []).map((m: any) => [m.id, m.numero]));
  const porId = new Map((pedidos || []).map((p: any) => [p.id, p]));

  const grupos = new Map<string, any[]>();
  for (const i of itens) {
    const chave = i.pedido_id + (agruparPorRetirada ? ':' + i.retirado_em : '');
    grupos.set(chave, [...(grupos.get(chave) || []), i]);
  }
  return Array.from(grupos, ([chave, lista]) => {
    const p: any = porId.get(lista[0].pedido_id) || {};
    return {
      chave,
      pedidoId: lista[0].pedido_id,
      itemIds: lista.map((i) => i.id),
      titulo: p.canal === 'mesa' ? 'Mesa ' + (numeroMesa.get(p.mesa_id) ?? '') : 'Balcão #' + (p.numero ?? ''),
      codigo: p.codigo || null,
      cliente: p.nome_cliente || null,
      enviadoPor: lista.find((i) => i.enviado_por)?.enviado_por || null,
      alertaEm: maiorData(lista.map((i) => i.alerta_em)) || null,
      alertaPor: lista.find((i) => i.alerta_por)?.alerta_por || null,
      prontoEm: maiorData(lista.map((i) => i.pronto_em)) || null,
      retiradoEm: maiorData(lista.map((i) => i.retirado_em)) || null,
      retiradoPor: lista.find((i) => i.retirado_por)?.retirado_por || null,
      itens: lista.map((i) => ({ nome: i.nome, quantidade: i.quantidade })),
    };
  });
}

const COLUNAS_RETIRADA = 'id, pedido_id, nome, quantidade, pronto_em, enviado_por, alerta_em, alerta_por, retirado_em, retirado_por';

// avisos de pedido pronto para o colaborador que enviou (aparecem em qualquer tela)
export async function listarAlertasPara(supabase: SupabaseClient, email: string) {
  const { data, error } = await supabase
    .from('pdv_pedido_itens')
    .select(COLUNAS_RETIRADA)
    .eq('enviado_por', email)
    .eq('status_cozinha', 'pronto')
    .not('alerta_em', 'is', null)
    .is('retirado_em', null)
    .eq('cancelado', false);
  if (error) {
    if (faltaColuna(error)) return [];
    throw error;
  }
  return montarRetiradas(supabase, data || [], false);
}

// pedidos finalizados (retirados) entre duas datas, mais recentes primeiro
export async function listarFinalizados(supabase: SupabaseClient, params: { de: string; ate: string }) {
  const { data, error } = await supabase
    .from('pdv_pedido_itens')
    .select(COLUNAS_RETIRADA)
    .not('retirado_em', 'is', null)
    .gte('retirado_em', params.de)
    .lt('retirado_em', params.ate)
    .order('retirado_em', { ascending: false })
    .limit(2000);
  if (error) throw error;
  const lista = await montarRetiradas(supabase, data || [], true);
  return lista.sort((a, b) => (b.retiradoEm || '').localeCompare(a.retiradoEm || ''));
}
