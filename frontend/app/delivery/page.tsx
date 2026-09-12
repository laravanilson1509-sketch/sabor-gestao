'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  listarPedidosDelivery,
  atualizarStatusDelivery,
  getStatusDelivery,
  getStatusPagamento,
  type StatusDelivery,
} from '@/lib/queries/delivery';

type Pedido = {
  id: string;
  telefone_cliente: string;
  endereco_entrega: string;
  forma_pagamento: string;
  status_pagamento: string;
  itens: { nome: string; quantidade: number; preco_unitario: number }[];
  valor_total: number;
  status: StatusDelivery;
  criado_em: string;
};

const FILTROS: { label: string; value: StatusDelivery | 'todos' }[] = [
  { label: '🔍 Todos', value: 'todos' },
  { label: '🆕 Novos', value: 'novo' },
  { label: '🍳 Em preparo', value: 'em_preparo' },
  { label: '🛵 Saiu', value: 'saiu_entrega' },
  { label: '✅ Entregues', value: 'entregue' },
  { label: '❌ Cancelados', value: 'cancelado' },
];

export default function DeliveryPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<StatusDelivery | 'todos'>('todos');
  const [pedidoAberto, setPedidoAberto] = useState<Pedido | null>(null);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [paraCancelar, setParaCancelar] = useState<Pedido | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const data = await listarPedidosDelivery(
        supabase,
        unidadeId,
        filtro === 'todos' ? undefined : filtro
      );
      setPedidos(data as any);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [filtro]);

  async function avancarStatus(pedido: Pedido) {
    const statusInfo = getStatusDelivery(pedido.status);
    if (!statusInfo.proximo) return;
    setAtualizando(pedido.id);
    try {
      await atualizarStatusDelivery(supabase, pedido.id, statusInfo.proximo);
      await carregar();
      if (pedidoAberto?.id === pedido.id) {
        setPedidoAberto(prev => prev ? { ...prev, status: statusInfo.proximo! } : null);
      }
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setAtualizando(null);
    }
  }

  async function cancelar(pedido: Pedido) {
    setAtualizando(pedido.id);
    try {
      await atualizarStatusDelivery(supabase, pedido.id, 'cancelado');
      setParaCancelar(null);
      setPedidoAberto(null);
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setAtualizando(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🛵 Delivery</h1>
          <button onClick={carregar} className="text-sm text-blue-600 hover:underline">
            🔄 Atualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                filtro === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center py-12 text-gray-500">Carregando...</p>
        ) : pedidos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pedidos.map((pedido) => {
              const statusInfo = getStatusDelivery(pedido.status);
              const pagamentoInfo = getStatusPagamento(pedido.status_pagamento);
              const hora = new Date(pedido.criado_em).toLocaleTimeString('pt-BR', {
                hour: '2-digit', minute: '2-digit'
              });
              const data = new Date(pedido.criado_em).toLocaleDateString('pt-BR');

              return (
                <div key={pedido.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.cor}`}>
                          {statusInfo.emoji} {statusInfo.label}
                        </span>
                        <span className="text-xs text-gray-400">{data} às {hora}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">📱 {pedido.telefone_cliente}</p>
                      <p className="text-sm text-gray-600">📍 {pedido.endereco_entrega}</p>
                      <p className="text-sm text-gray-600">
                        💳 {pedido.forma_pagamento.charAt(0).toUpperCase() + pedido.forma_pagamento.slice(1)}
                        {' — '}
                        <span className={pagamentoInfo.cor}>{pagamentoInfo.label}</span>
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        Total: R$ {Number(pedido.valor_total).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => setPedidoAberto(pedido)}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
                      >
                        📋 Ver itens
                      </button>
                      {statusInfo.proximo && (
                        <button
                          onClick={() => avancarStatus(pedido)}
                          disabled={atualizando === pedido.id}
                          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                        >
                          {atualizando === pedido.id ? '...' : statusInfo.labelProximo}
                        </button>
                      )}
                      {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
                        <button
                          onClick={() => setParaCancelar(pedido)}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg"
                        >
                          ❌ Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Ver itens */}
      {pedidoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">📋 Itens do pedido</h2>
              <button onClick={() => setPedidoAberto(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-2 mb-4">
              {pedidoAberto.itens.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{item.quantidade}x {item.nome}</span>
                  <span className="font-medium">R$ {(item.quantidade * item.preco_unitario).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>R$ {Number(pedidoAberto.valor_total).toFixed(2)}</span>
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              <p>📍 {pedidoAberto.endereco_entrega}</p>
              <p>📱 {pedidoAberto.telefone_cliente}</p>
              <p>💳 {pedidoAberto.forma_pagamento} — {getStatusPagamento(pedidoAberto.status_pagamento).label}</p>
            </div>
            {getStatusDelivery(pedidoAberto.status).proximo && (
              <button
                onClick={() => { avancarStatus(pedidoAberto); setPedidoAberto(null); }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium"
              >
                {getStatusDelivery(pedidoAberto.status).labelProximo}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal: Confirmar cancelamento */}
      {paraCancelar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-red-700">❌ Cancelar pedido?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Tem certeza que quer cancelar o pedido de <strong>{paraCancelar.telefone_cliente}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => cancelar(paraCancelar)}
                disabled={atualizando === paraCancelar.id}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium"
              >
                {atualizando === paraCancelar.id ? 'Cancelando...' : 'Sim, cancelar'}
              </button>
              <button
                onClick={() => setParaCancelar(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}