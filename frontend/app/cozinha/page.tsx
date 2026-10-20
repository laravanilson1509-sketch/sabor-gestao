'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  listarFilaCozinha,
  mudarStatusCartao,
  type CartaoCozinha,
  type StatusCozinha,
} from '@/lib/queries/cozinha';

const BTN_PRIMARY =
  'bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition';
const BTN_SECONDARY =
  'px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition';

// de quanto em quanto tempo a tela busca pedidos novos sozinha
const INTERVALO_ATUALIZACAO_MS = 15000;

const COLUNAS: {
  status: StatusCozinha;
  titulo: string;
  cor: string;
  proximo: StatusCozinha | null;
  rotuloProximo: string;
  anterior: StatusCozinha | null;
}[] = [
  {
    status: 'novo',
    titulo: 'Novo',
    cor: 'bg-[#FFF0C7] text-[#7A5A0A]',
    proximo: 'preparando',
    rotuloProximo: 'Iniciar preparo',
    anterior: null,
  },
  {
    status: 'preparando',
    titulo: 'Preparando',
    cor: 'bg-[#DCEEF2] text-[#0B4F5E]',
    proximo: 'pronto',
    rotuloProximo: 'Marcar como pronto',
    anterior: 'novo',
  },
  {
    status: 'pronto',
    titulo: 'Pronto',
    cor: 'bg-[#D9F0E3] text-[#1E6B3F]',
    proximo: null,
    rotuloProximo: '',
    anterior: 'preparando',
  },
];

const ROTULO_ORIGEM: Record<CartaoCozinha['origem'], string> = {
  mesa: 'Salão',
  balcao: 'Balcão',
  delivery: 'Delivery',
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const minutosDesde = (iso: string, agora: number) =>
  Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));

// pedido esperando há muito tempo fica amarelo e depois vermelho
function corTempo(minutos: number, status: StatusCozinha) {
  if (status === 'pronto') return 'text-[#1E6B3F]';
  if (minutos >= 20) return 'text-[#B3261E] font-semibold';
  if (minutos >= 10) return 'text-[#8A5F00] font-semibold';
  return 'text-[#5B6B73]';
}

export default function CozinhaPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [cartoes, setCartoes] = useState<CartaoCozinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<number>(Date.now());
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function carregar() {
    try {
      setCartoes(await listarFilaCozinha(supabase, unidadeId));
      setErro(null);
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar os pedidos da cozinha');
    }
    setAtualizadoEm(Date.now());
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(timer);
  }, []);

  async function mudarStatus(cartao: CartaoCozinha, status: StatusCozinha) {
    if (ocupado) return;
    setOcupado(cartao.chave);
    try {
      await mudarStatusCartao(supabase, cartao, status);
      await carregar();
    } catch (e: any) {
      setErro(e.message || 'Erro ao atualizar o pedido');
    }
    setOcupado(null);
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#16252B]">Cozinha</h1>
            <p className="text-sm text-[#5B6B73]">
              Pedidos do PDV e do delivery · atualizado às {hora(new Date(atualizadoEm).toISOString())}
            </p>
          </div>
          <button onClick={carregar} className={BTN_SECONDARY}>
            Atualizar
          </button>
        </div>

        {erro && (
          <div role="alert" className="mb-4 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {COLUNAS.map((col) => {
              const daColuna = cartoes.filter((c) => c.status === col.status);
              return (
                <section key={col.status} className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5B6B73]">
                      {col.titulo}
                    </h2>
                    <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + col.cor}>
                      {daColuna.length}
                    </span>
                  </div>

                  {daColuna.length === 0 ? (
                    <p className="text-sm text-[#8FA0A8] py-8 text-center">
                      {col.status === 'pronto' ? 'Nada pronto agora' : 'Nenhum pedido'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {daColuna.map((c) => {
                        const minutos = minutosDesde(c.status === 'pronto' ? c.desde : c.chegouEm, atualizadoEm);
                        return (
                          <article key={c.chave} className="bg-white border border-[#DCE3E7] rounded-xl p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0">
                                <p className="text-lg font-bold text-[#16252B]">{c.titulo}</p>
                                <p className="text-xs text-[#5B6B73] truncate">
                                  {ROTULO_ORIGEM[c.origem]}
                                  {c.subtitulo ? ' · ' + c.subtitulo : ''}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={'text-sm ' + corTempo(minutos, c.status)}>
                                  {c.status === 'pronto' ? 'pronto há ' : 'há '}
                                  {minutos} min
                                </p>
                                <p className="text-xs text-[#8FA0A8]">chegou {hora(c.chegouEm)}</p>
                              </div>
                            </div>

                            <ul className="divide-y divide-[#E6ECEF] border-t border-[#E6ECEF] mb-3">
                              {c.itens.map((i, idx) => (
                                <li key={idx} className="py-2">
                                  <p className="text-base text-[#16252B]">
                                    <span className="font-bold">{i.quantidade}×</span> {i.nome}
                                  </p>
                                  {i.observacao && (
                                    <p className="text-sm text-[#7A5A0A] bg-[#FFF0C7] rounded px-2 py-0.5 mt-1">
                                      {i.observacao}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>

                            <div className="flex gap-2">
                              {col.proximo && (
                                <button
                                  onClick={() => mudarStatus(c, col.proximo!)}
                                  disabled={ocupado !== null}
                                  className={BTN_PRIMARY + ' flex-1'}
                                >
                                  {ocupado === c.chave ? 'Salvando...' : col.rotuloProximo}
                                </button>
                              )}
                              {col.anterior && (
                                <button
                                  onClick={() => mudarStatus(c, col.anterior!)}
                                  disabled={ocupado !== null}
                                  className="text-xs font-medium text-[#5B6B73] hover:text-[#16252B] px-2 disabled:opacity-50"
                                >
                                  Voltar
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
