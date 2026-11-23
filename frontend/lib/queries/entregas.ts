// lib/queries/entregas.ts — bebidas e produtos acabados lançados no PDV: o garçom confirmou que levou?
// Serve para o inventário: item "sem confirmação" com conta fechada = possível falha de confirmação.

import type { SupabaseClient } from '@supabase/supabase-js';

export type SituacaoEntrega = 'confirmada' | 'aguardando' | 'sem_confirmacao';

export type EntregaItem = {
  id: string;
  quando: string; // quando o garçom lançou
  pedidoId: string;
  pedido: string; // Mesa 5 · Balcão #12
  codigo: string | null;
  cliente: string | null;
  item: string;
  quantidade: number;
  lancadoPor: string | null;
  situacao: SituacaoEntrega;
  confirmadoEm: string | null;
  confirmadoPor: string | null;
};

export const ROTULO_SITUACAO: Record<SituacaoEntrega, string> = {
  confirmada: 'Confirmada',
  aguardando: 'Aguardando (conta aberta)',
  sem_confirmacao: 'Sem confirmação (conta fechada)',
};

export async function listarEntregas(supabase: SupabaseClient, params: { de: string; ate: string }): Promise<EntregaItem[]> {
  const { data, error } = await supabase
    .from('pdv_pedido_itens')
    .select('id, pedido_id, nome, quantidade, enviado_cozinha_em, enviado_por, entrega_status, entrega_em, entrega_por')
    .not('entrega_status', 'is', null)
    .eq('cancelado', false)
    .gte('enviado_cozinha_em', params.de)
    .lt('enviado_cozinha_em', params.ate)
    .order('enviado_cozinha_em', { ascending: false })
    .limit(2000);
  if (error) throw error;
  const itens = data || [];
  if (itens.length === 0) return [];

  const ids = Array.from(new Set(itens.map((i: any) => i.pedido_id)));
  const { data: pedidos, error: e2 } = await supabase
    .from('pdv_pedidos')
    .select('id, numero, canal, mesa_id, status, codigo, nome_cliente')
    .in('id', ids);
  if (e2) throw e2;
  const mesaIds = Array.from(new Set((pedidos || []).map((p: any) => p.mesa_id).filter(Boolean)));
  const { data: mesas } = mesaIds.length ? await supabase.from('pdv_mesas').select('id, numero').in('id', mesaIds) : { data: [] as any[] };
  const numeroMesa = new Map((mesas || []).map((m: any) => [m.id, m.numero]));
  const porId = new Map((pedidos || []).map((p: any) => [p.id, p]));

  return itens
    .map((i: any): EntregaItem | null => {
      const p: any = porId.get(i.pedido_id);
      if (!p || p.status === 'cancelado') return null; // pedido cancelado inteiro não conta
      const situacao: SituacaoEntrega =
        i.entrega_status === 'entregue' ? 'confirmada' : p.status === 'aberto' ? 'aguardando' : 'sem_confirmacao';
      return {
        id: i.id,
        quando: i.enviado_cozinha_em,
        pedidoId: i.pedido_id,
        pedido: p.canal === 'mesa' ? 'Mesa ' + (numeroMesa.get(p.mesa_id) ?? '') : 'Balcão #' + p.numero,
        codigo: p.codigo || null,
        cliente: p.nome_cliente || null,
        item: i.nome,
        quantidade: Number(i.quantidade),
        lancadoPor: i.enviado_por || null,
        situacao,
        confirmadoEm: i.entrega_em || null,
        confirmadoPor: i.entrega_por || null,
      };
    })
    .filter((x): x is EntregaItem => x !== null);
}
