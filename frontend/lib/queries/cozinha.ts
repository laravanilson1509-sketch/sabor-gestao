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
  itens: { nome: string; quantidade: number; observacao: string | null }[];
  itemIds: string[]; // PDV: os itens deste cartão
  deliveryId: string | null;
  deliveryStatus: string | null;
};

// por quanto tempo um pedido pronto continua aparecendo na coluna "Pronto"
const MINUTOS_PRONTO_VISIVEL = 30;

const menorData = (datas: (string | null)[]) =>
  datas.filter(Boolean).sort()[0] as string | undefined;
const maiorData = (datas: (string | null)[]) =>
  datas.filter(Boolean).sort().reverse()[0] as string | undefined;

export async function listarFilaCozinha(
  supabase: SupabaseClient,
  unidadeId: string
): Promise<CartaoCozinha[]> {
  const [resPedidos, resMesas, resDelivery] = await Promise.all([
    supabase
      .from('pdv_pedidos')
      .select('id, numero, canal, mesa_id, nome_cliente')
      .eq('unidade_id', unidadeId)
      .eq('status', 'aberto'),
    supabase.from('pdv_mesas').select('id, numero').eq('unidade_id', unidadeId),
    supabase
      .from('pedidos_delivery')
      .select('id, telefone_cliente, itens, status, status_cozinha, criado_em, iniciado_em, pronto_em')
      .eq('unidade_id', unidadeId)
      .not('status_cozinha', 'is', null)
      .not('status', 'in', '(cancelado,entregue,saiu_entrega)'),
  ]);
  if (resPedidos.error) throw resPedidos.error;
  if (resMesas.error) throw resMesas.error;
  if (resDelivery.error) throw resDelivery.error;

  const pedidos = resPedidos.data || [];
  const numeroMesa = new Map((resMesas.data || []).map((m) => [m.id, m.numero]));

  let itensPdv: any[] = [];
  if (pedidos.length > 0) {
    const { data, error } = await supabase
      .from('pdv_pedido_itens')
      .select('id, pedido_id, nome, quantidade, observacao, status_cozinha, enviado_cozinha_em, iniciado_em, pronto_em')
      .in('pedido_id', pedidos.map((p) => p.id))
      .not('status_cozinha', 'is', null);
    if (error) throw error;
    itensPdv = data || [];
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
      itens: itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, observacao: i.observacao })),
      itemIds: itens.map((i) => i.id),
      deliveryId: null,
      deliveryStatus: null,
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
      })),
      itemIds: [],
      deliveryId: d.id,
      deliveryStatus: d.status,
    });
  }

  const limitePronto = Date.now() - MINUTOS_PRONTO_VISIVEL * 60000;
  return cartoes
    .filter((c) => c.status !== 'pronto' || new Date(c.desde).getTime() >= limitePronto)
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
