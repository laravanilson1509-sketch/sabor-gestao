import type { SupabaseClient } from "@supabase/supabase-js";

export type StatusDelivery = 'novo' | 'em_preparo' | 'saiu_entrega' | 'entregue' | 'cancelado';

export async function listarPedidosDelivery(
  supabase: SupabaseClient,
  unidadeId: string,
  status?: StatusDelivery
) {
  let query = supabase
    .from('pedidos_delivery')
    .select('*')
    .eq('unidade_id', unidadeId)
    .order('criado_em', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function atualizarStatusDelivery(
  supabase: SupabaseClient,
  id: string,
  status: StatusDelivery
) {
  const { error } = await supabase
    .from('pedidos_delivery')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export function getStatusDelivery(status: StatusDelivery) {
  const map = {
    novo: { emoji: '🆕', label: 'Novo', cor: 'bg-blue-100 text-blue-700', proximo: 'em_preparo' as StatusDelivery, labelProximo: '🍳 Iniciar preparo' },
    em_preparo: { emoji: '🍳', label: 'Em preparo', cor: 'bg-yellow-100 text-yellow-700', proximo: 'saiu_entrega' as StatusDelivery, labelProximo: '🛵 Saiu pra entrega' },
    saiu_entrega: { emoji: '🛵', label: 'Saiu pra entrega', cor: 'bg-orange-100 text-orange-700', proximo: 'entregue' as StatusDelivery, labelProximo: '✅ Confirmar entrega' },
    entregue: { emoji: '✅', label: 'Entregue', cor: 'bg-green-100 text-green-700', proximo: null, labelProximo: '' },
    cancelado: { emoji: '❌', label: 'Cancelado', cor: 'bg-red-100 text-red-700', proximo: null, labelProximo: '' },
  };
  return map[status];
}

export function getStatusPagamento(status: string) {
  const map: Record<string, { label: string; cor: string }> = {
    pendente: { label: 'Pendente', cor: 'text-gray-500' },
    informado: { label: 'Informado', cor: 'text-yellow-600' },
    confirmado: { label: 'Confirmado', cor: 'text-green-600' },
  };
  return map[status] || map.pendente;
}