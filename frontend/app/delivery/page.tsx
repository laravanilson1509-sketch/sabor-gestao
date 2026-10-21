'use client';

import { useEffect, useState } from 'react';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import { combina } from '@/lib/busca';
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
  { label: 'Todos', value: 'todos' },
  { label: 'Novos', value: 'novo' },
  { label: 'Em preparo', value: 'em_preparo' },
  { label: 'Saiu para entrega', value: 'saiu_entrega' },
  { label: 'Entregues', value: 'entregue' },
  { label: 'Cancelados', value: 'cancelado' },
];

// Cores dos selos de status (visual claro)
const COR_STATUS: Record<string, string> = {
  novo: 'bg-[#DCEEF2] text-[#0B4F5E]',
  em_preparo: 'bg-[#FFF0C7] text-[#7A5A0A]',
  saiu_entrega: 'bg-[#E6E4F7] text-[#3F3A8C]',
  entregue: 'bg-[#D9F0E3] text-[#1E6B3F]',
  cancelado: 'bg-[#FADBD6] text-[#9B2C1F]',
};

// Remove emojis/símbolos no começo de textos vindos da lib (ex: "🍳 Iniciar preparo")
function limpar(texto: string | undefined | null) {
  return (texto || '').replace(/^[^A-Za-zÀ-ÿ0-9]+/, '');
}

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
  const [busca, setBusca] = useState('');
  const pedidosFiltrados = pedidos.filter((p) =>
    combina(busca, p.telefone_cliente, p.endereco_entrega, p.forma_pagamento, p.valor_total, ...(p.itens || []).map((i) => i.nome))
  );

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

  useEffect(() => {
    carregar();
  }, [filtro]);

  async function avancarStatus(pedido: Pedido) {
    const statusInfo = getStatusDelivery(pedido.status);
    if (!statusInfo.proximo) return;
    setAtualizando(pedido.id);
    try {
      await atualizarStatusDelivery(supabase, pedido.id, statusInfo.proximo);
      await carregar();
      if (pedidoAberto?.id === pedido.id) {
        setPedidoAberto((prev) => (prev ? { ...prev, status: statusInfo.proximo! } : null));
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
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#16252B]">Delivery</h1>
            <p className="text-sm text-[#5B6B73] mt-1">Acompanhe os pedidos de entrega</p>
          </div>
          <button
            onClick={carregar}
            className="px-4 py-2 rounded-lg border border-[#DCE3E7] bg-white text-sm font-medium text-[#2B3C44] hover:bg-[#F1F5F7] transition"
          >
            Atualizar
          </button>
        </div>

        <BarraBusca valor={busca} onChange={setBusca} placeholder="Buscar por telefone, endereço ou item..." className="mb-4" />

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={
                'text-sm px-3.5 py-1.5 rounded-full font-medium transition ' +
                (filtro === f.value
                  ? 'bg-[#0E6B7E] text-white'
                  : 'bg-white text-[#5B6B73] border border-[#DCE3E7] hover:bg-[#F1F5F7]')
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : pedidos.length > 0 && pedidosFiltrados.length === 0 ? (
          <NadaEncontrado busca={busca} />
        ) : pedidos.length === 0 ? (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
            <p className="text-[#16252B]">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pedidosFiltrados.map((pedido) => {
              const statusInfo = getStatusDelivery(pedido.status);
              const pagamentoInfo = getStatusPagamento(pedido.status_pagamento);
              const hora = new Date(pedido.criado_em).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const data = new Date(pedido.criado_em).toLocaleDateString('pt-BR');
              const corStatus = COR_STATUS[pedido.status] || statusInfo.cor;

              return (
                <div key={pedido.id} className="bg-white border border-[#DCE3E7] rounded-xl p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={'text-xs font-semibold px-2.5 py-1 rounded-full ' + corStatus}>
                          {limpar(statusInfo.label)}
                        </span>
                        <span className="text-xs text-[#8FA0A8]">
                          {data} às {hora}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#16252B]">{pedido.telefone_cliente}</p>
                      <p className="text-sm text-[#5B6B73]">{pedido.endereco_entrega}</p>
                      <p className="text-sm text-[#5B6B73] mt-1">
                        Pagamento:{' '}
                        {pedido.forma_pagamento.charAt(0).toUpperCase() + pedido.forma_pagamento.slice(1)}
                        {' — '}
                        <span className={pagamentoInfo.cor}>{limpar(pagamentoInfo.label)}</span>
                      </p>
                      <p className="text-base font-bold text-[#16252B] mt-2">
                        Total: R$ {Number(pedido.valor_total).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        onClick={() => setPedidoAberto(pedido)}
                        className="text-sm px-4 py-2 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] hover:bg-[#F1F5F7] transition"
                      >
                        Ver itens
                      </button>
                      {statusInfo.proximo && (
                        <button
                          onClick={() => avancarStatus(pedido)}
                          disabled={atualizando === pedido.id}
                          className="text-sm px-4 py-2 rounded-lg bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white font-medium transition"
                        >
                          {atualizando === pedido.id ? '...' : limpar(statusInfo.labelProximo)}
                        </button>
                      )}
                      {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
                        <button
                          onClick={() => setParaCancelar(pedido)}
                          className="text-sm px-4 py-2 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] hover:bg-[#FADBD6] transition"
                        >
                          Cancelar
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

      {/* Janela: ver itens */}
      {pedidoAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[#16252B]">Itens do pedido</h2>
              <button
                onClick={() => setPedidoAberto(null)}
                className="h-9 w-9 text-xl text-[#5B6B73] hover:text-[#16252B]"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {pedidoAberto.itens.map((item, i) => (
                <div key={i} className="flex justify-between text-sm text-[#2B3C44]">
                  <span>
                    {item.quantidade}x {item.nome}
                  </span>
                  <span className="font-medium">
                    R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t border-[#DCE3E7] pt-2 flex justify-between font-bold text-[#16252B]">
                <span>Total</span>
                <span>R$ {Number(pedidoAberto.valor_total).toFixed(2)}</span>
              </div>
            </div>
            <div className="text-sm text-[#5B6B73] space-y-1 mb-4">
              <p>Endereço: {pedidoAberto.endereco_entrega}</p>
              <p>Telefone: {pedidoAberto.telefone_cliente}</p>
              <p>
                Pagamento: {pedidoAberto.forma_pagamento} —{' '}
                {limpar(getStatusPagamento(pedidoAberto.status_pagamento).label)}
              </p>
            </div>
            {getStatusDelivery(pedidoAberto.status).proximo && (
              <button
                onClick={() => {
                  avancarStatus(pedidoAberto);
                  setPedidoAberto(null);
                }}
                className="w-full bg-[#0E6B7E] hover:bg-[#0B5A6A] text-white py-2.5 rounded-lg font-medium"
              >
                {limpar(getStatusDelivery(pedidoAberto.status).labelProximo)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Janela: confirmar cancelamento */}
      {paraCancelar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-[#B3261E]">Cancelar pedido?</h2>
            <p className="text-sm text-[#5B6B73] mb-6">
              Tem certeza que quer cancelar o pedido de{' '}
              <strong className="text-[#16252B]">{paraCancelar.telefone_cliente}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => cancelar(paraCancelar)}
                disabled={atualizando === paraCancelar.id}
                className="flex-1 bg-[#B3261E] hover:bg-[#971F18] disabled:opacity-50 text-white py-2.5 rounded-lg font-medium"
              >
                {atualizando === paraCancelar.id ? 'Cancelando...' : 'Sim, cancelar'}
              </button>
              <button
                onClick={() => setParaCancelar(null)}
                className="flex-1 bg-[#F1F5F7] hover:bg-[#E3E9EC] text-[#2B3C44] py-2.5 rounded-lg font-medium"
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