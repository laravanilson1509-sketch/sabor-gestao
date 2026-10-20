// lib/queries/pendenciasEstoque.ts — conferências geradas pela baixa automática
// do estoque (quando a cozinha marca um item do PDV como pronto)

import type { SupabaseClient } from '@supabase/supabase-js';
import { registrarMovimentacao } from '@/lib/queries/estoque';

export type PendenciaEstoque = {
  id: string;
  tipo: 'sem_ficha' | 'estoque_insuficiente' | 'unidade_diferente';
  produto_id: string | null;
  produto_nome: string;
  ingrediente_id: string | null;
  ingrediente_nome: string | null;
  quantidade_necessaria: number | null;
  quantidade_baixada: number | null;
  unidade: string | null;
  origem: string | null;
  criado_em: string;
};

// avisa o menu lateral para atualizar o contador
export const EVENTO_PENDENCIAS = 'pendencias-estoque-alteradas';

export async function listarPendenciasAbertas(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from('pdv_estoque_pendencias')
    .select(
      'id, tipo, produto_id, produto_nome, ingrediente_id, ingrediente_nome, quantidade_necessaria, quantidade_baixada, unidade, origem, criado_em'
    )
    .eq('unidade_id', unidadeId)
    .eq('status', 'aberta')
    .order('criado_em');
  if (error) throw error;
  return (data || []) as PendenciaEstoque[];
}

export async function contarPendenciasAbertas(
  supabase: SupabaseClient,
  unidadeId: string,
  desde?: string
) {
  let query = supabase
    .from('pdv_estoque_pendencias')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidadeId)
    .eq('status', 'aberta');
  if (desde) query = query.gte('criado_em', desde);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function conferirPendencia(
  supabase: SupabaseClient,
  params: {
    pendencia: PendenciaEstoque;
    unidadeId: string;
    quantidadeContada: number | null; // quanto tem de verdade no estoque agora
    observacao: string | null;
  }
) {
  const { pendencia, unidadeId, quantidadeContada } = params;
  let observacao = params.observacao;

  // ajusta o saldo para o valor contado, registrando a diferença como entrada ou consumo
  if (quantidadeContada !== null && pendencia.ingrediente_id) {
    const { data: saldo, error } = await supabase
      .from('estoque_saldo')
      .select('quantidade_disponivel, unidade')
      .eq('ingrediente_id', pendencia.ingrediente_id)
      .eq('unidade_id', unidadeId)
      .maybeSingle();
    if (error) throw error;

    const atual = Number(saldo?.quantidade_disponivel || 0);
    const diferenca = Math.round((quantidadeContada - atual) * 1000) / 1000;
    if (diferenca !== 0) {
      await registrarMovimentacao(supabase, {
        ingrediente_id: pendencia.ingrediente_id,
        unidade_id: unidadeId,
        tipo: diferenca > 0 ? 'entrada' : 'consumo',
        quantidade: Math.abs(diferenca),
        observacao: 'Ajuste na conferência: contado ' + quantidadeContada + ' ' + (saldo?.unidade || ''),
      });
    }
    const contagem = 'Contado: ' + quantidadeContada + ' ' + (saldo?.unidade || '');
    observacao = observacao ? contagem + ' · ' + observacao : contagem;
  }

  const { data: usuario } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('pdv_estoque_pendencias')
    .update({
      status: 'conferida',
      conferido_em: new Date().toISOString(),
      conferido_por: usuario.user?.email || null,
      observacao,
    })
    .eq('id', pendencia.id);
  if (error) throw error;
}
