'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  listarFilaCozinha,
  mudarStatusCartao,
  enviarAlerta,
  confirmarRetirada,
  retiradaDisponivel,
  type CartaoCozinha,
  type StatusCozinha,
} from '@/lib/queries/cozinha';
import MenuCartao from '@/components/cozinha/MenuCartao';
import ModalFichaPrato from '@/components/fichas/ModalFichaPrato';
import HistoricoPedido from '@/components/pdv/HistoricoPedido';
import { ABAS_COZINHA, type AbaCozinha } from '@/lib/navegacao';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import PedidosProntos from '@/components/cozinha/PedidosProntos';
import PedidosFinalizados from '@/components/cozinha/PedidosFinalizados';


const BTN_PRIMARY =
  'btn btn-primario';
const BTN_SECONDARY =
  'btn btn-secundario';

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
    cor: 'bg-warning-soft text-warning',
    proximo: 'preparando',
    rotuloProximo: 'Iniciar preparo',
    anterior: null,
  },
  {
    status: 'preparando',
    titulo: 'Preparando',
    cor: 'bg-accent-soft text-accent-ink',
    proximo: 'pronto',
    rotuloProximo: 'Marcar como pronto',
    anterior: 'novo',
  },
  {
    status: 'pronto',
    titulo: 'Pronto',
    cor: 'bg-success-soft text-success',
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

// 45 min · 2h 10min · 3 dias
function formatarTempo(minutos: number) {
  if (minutos < 60) return minutos + ' min';
  if (minutos < 1440) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return h + 'h' + (m ? ' ' + m + 'min' : '');
  }
  const d = Math.floor(minutos / 1440);
  return d + (d === 1 ? ' dia' : ' dias');
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// pedido esperando há muito tempo fica amarelo e depois vermelho
function corTempo(minutos: number, status: StatusCozinha) {
  if (status === 'pronto') return 'text-success';
  if (minutos >= 20) return 'text-danger font-semibold';
  if (minutos >= 10) return 'text-warning font-semibold';
  return 'text-ink-muted';
}

export default function TelaCozinha() {
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
  const [atualizadoEm, setAtualizadoEm] = useState<number>(0); // preenchido ao carregar (evita diferença entre servidor e navegador)
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ficha, setFicha] = useState<{ produtoId: string; nome: string } | null>(null);
  const [detalhes, setDetalhes] = useState<CartaoCozinha | null>(null);
  const [impressoes, setImpressoes] = useState<CartaoCozinha | null>(null);
  // a aba é a última parte do endereço (/cozinha/prontos): o menu lateral abre cada uma direto
  const pathname = usePathname() || '';
  const parte = pathname.split('/')[2];
  const aba: AbaCozinha = ABAS_COZINHA.some((a) => a.id === parte) ? (parte as AbaCozinha) : 'producao';
  const [email, setEmail] = useState('');
  const [retiradaOk, setRetiradaOk] = useState(true); // false = SQL 0022 ainda não foi rodado
  const [aviso, setAviso] = useState<string | null>(null);

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
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ''));
    retiradaDisponivel(supabase).then(setRetiradaOk);
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

  async function alertar(c: CartaoCozinha) {
    if (ocupado) return;
    setOcupado(c.chave);
    try {
      await enviarAlerta(supabase, c, email);
      setAviso('Alerta enviado para ' + (c.enviadoPor || 'o colaborador') + '.');
      await carregar();
    } catch (e: any) {
      setErro(e.message || 'Erro ao enviar o alerta');
    }
    setOcupado(null);
  }

  async function retirado(c: CartaoCozinha) {
    if (ocupado) return;
    setOcupado(c.chave);
    try {
      await confirmarRetirada(supabase, c.itemIds, email);
      setAviso('Pedido ' + c.titulo + ' finalizado.');
      await carregar();
    } catch (e: any) {
      setErro(e.message || 'Erro ao confirmar a retirada');
    }
    setOcupado(null);
  }

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const prontos = cartoes.filter((c) => c.status === 'pronto');
  const quantidades: Partial<Record<AbaCozinha, number>> = { producao: cartoes.length - prontos.length, prontos: prontos.length };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Cozinha' }]}
          titulo="Cozinha"
          descricao={'Pedidos do PDV e do delivery' + (atualizadoEm ? ' · atualizado às ' + hora(new Date(atualizadoEm).toISOString()) : '')}
          acoes={
            <button onClick={carregar} className={BTN_SECONDARY}>
              Atualizar
            </button>
          }
        />

        {erro && (
          <div role="alert" className="mb-4 text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        {!retiradaOk && (
          <div role="alert" className="mb-4 text-sm text-warning bg-warning-soft rounded-lg px-3 py-2">
            Para usar alerta e retirada, rode o SQL <strong>0022_cozinha_retirada</strong> no Supabase (SQL Editor).
          </div>
        )}
        {aviso && (
          <div role="status" className="mb-4 text-sm text-success bg-success-soft rounded-lg px-3 py-2">
            {aviso}
          </div>
        )}

        <div role="tablist" aria-label="Telas da cozinha" className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {ABAS_COZINHA.map((a) => (
            <Link
              key={a.id}
              href={'/cozinha/' + a.id}
              role="tab"
              aria-selected={aba === a.id}
              className={
                'ui-focus whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition ' +
                (aba === a.id ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface text-ink-soft hover:bg-surface-hover')
              }
            >
              {a.rotulo}
              {quantidades[a.id] !== undefined && !loading && <span className="ml-2 tabular-nums opacity-80">{quantidades[a.id]}</span>}
            </Link>
          ))}
        </div>

        {aba === 'finalizados' ? (
          <PedidosFinalizados supabase={supabase} />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="ui-skeleton h-56 rounded-xl" />
            ))}
          </div>
        ) : aba === 'prontos' ? (
          <PedidosProntos
            cartoes={prontos}
            agora={atualizadoEm}
            ocupado={ocupado}
            onAlerta={alertar}
            onRetirada={retirado}
            onVoltar={(c) => mudarStatus(c, 'preparando')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {COLUNAS.filter((c) => c.status !== 'pronto').map((col) => {
              const daColuna = cartoes.filter((c) => c.status === col.status);
              return (
                <section key={col.status} className="bg-surface-hover border border-line rounded-xl p-3">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                      {col.titulo}
                    </h2>
                    <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + col.cor}>
                      {daColuna.length}
                    </span>
                  </div>

                  {daColuna.length === 0 ? (
                    <p className="text-sm text-ink-subtle py-8 text-center">
                      {col.status === 'pronto' ? 'Nada pronto agora' : 'Nenhum pedido'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {daColuna.map((c) => {
                        const minutos = minutosDesde(c.status === 'pronto' ? c.desde : c.chegouEm, atualizadoEm);
                        return (
                          <article key={c.chave} className="bg-surface border border-line rounded-xl p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0">
                                <p className="text-lg font-bold text-ink">{c.titulo}</p>
                                <p className="text-xs text-ink-muted truncate">
                                  {c.codigo && <span className="font-semibold tabular-nums text-ink-soft">{c.codigo} · </span>}
                                  {ROTULO_ORIGEM[c.origem]}
                                  {c.subtitulo ? ' · ' + c.subtitulo : ''}
                                </p>
                              </div>
                              <div className="flex items-start gap-1 shrink-0">
                                <div className="text-right">
                                  <p className={'text-sm ' + corTempo(minutos, c.status)}>
                                    {c.status === 'pronto' ? 'pronto há ' : 'há '}
                                    {formatarTempo(minutos)}
                                  </p>
                                  <p className="text-xs text-ink-subtle">
                                    chegou {minutos >= 1440 ? dataHora(c.chegouEm) : hora(c.chegouEm)}
                                  </p>
                                </div>
                                <MenuCartao
                                  itens={c.itens}
                                  temPedido={Boolean(c.pedidoId)}
                                  onFicha={(produtoId, nome) => setFicha({ produtoId, nome })}
                                  onDetalhes={() => setDetalhes(c)}
                                  onImpressoes={() => setImpressoes(c)}
                                />
                              </div>
                            </div>

                            <ul className="divide-y divide-line-soft border-t border-line-soft mb-3">
                              {c.itens.map((i, idx) => (
                                <li key={idx} className="py-2">
                                  <p className="text-base text-ink">
                                    <span className="font-bold">{i.quantidade}×</span> {i.nome}
                                  </p>
                                  {i.semEstoque && (
                                    <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-danger-soft text-danger">
                                      Conferir estoque
                                    </span>
                                  )}
                                  {i.observacao && (
                                    <p className="text-sm text-warning bg-warning-soft rounded px-2 py-0.5 mt-1">
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
                                  className="text-xs font-medium text-ink-muted hover:text-ink px-2 disabled:opacity-50"
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

      {ficha && (
        <ModalFichaPrato
          supabase={supabase}
          unidadeId={unidadeId}
          produtoId={ficha.produtoId}
          nomeInicial={ficha.nome}
          onFechar={() => setFicha(null)}
        />
      )}

      {impressoes?.pedidoId && (
        <HistoricoPedido
          supabase={supabase}
          unidadeId={unidadeId}
          pedidoId={impressoes.pedidoId}
          titulo={impressoes.titulo}
          onFechar={() => setImpressoes(null)}
        />
      )}

      <Modal
        aberto={!!detalhes}
        onFechar={() => setDetalhes(null)}
        titulo={detalhes ? 'Pedido ' + detalhes.titulo + (detalhes.codigo ? ' · ' + detalhes.codigo : '') : ''}
        rodape={
          <button onClick={() => setDetalhes(null)} className="btn btn-primario">
            Fechar
          </button>
        }
      >
        {detalhes && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              {ROTULO_ORIGEM[detalhes.origem]}
              {detalhes.subtitulo ? ' · ' + detalhes.subtitulo : ''}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-surface-hover rounded-lg p-3">
                <dt className="text-xs text-ink-muted">Situação</dt>
                <dd className="font-semibold text-ink">{COLUNAS.find((x) => x.status === detalhes.status)?.titulo}</dd>
              </div>
              <div className="bg-surface-hover rounded-lg p-3">
                <dt className="text-xs text-ink-muted">Tempo desde que chegou</dt>
                <dd className="font-semibold text-ink">{formatarTempo(minutosDesde(detalhes.chegouEm, atualizadoEm))}</dd>
              </div>
              <div className="bg-surface-hover rounded-lg p-3">
                <dt className="text-xs text-ink-muted">Chegou na cozinha</dt>
                <dd className="font-semibold text-ink">{dataHora(detalhes.chegouEm)}</dd>
              </div>
              <div className="bg-surface-hover rounded-lg p-3">
                <dt className="text-xs text-ink-muted">Na situação atual desde</dt>
                <dd className="font-semibold text-ink">{dataHora(detalhes.desde)}</dd>
              </div>
            </dl>
            <ul className="divide-y divide-line-soft border border-line-soft rounded-lg">
              {detalhes.itens.map((i, k) => (
                <li key={k} className="px-3 py-2 text-sm">
                  <span className="font-bold">{i.quantidade}×</span> {i.nome}
                  {i.observacao && <p className="text-xs text-warning mt-0.5">{i.observacao}</p>}
                </li>
              ))}
            </ul>
            {minutosDesde(detalhes.chegouEm, atualizadoEm) >= 1440 && (
              <p className="text-sm text-warning bg-warning-soft rounded-lg px-3 py-2">
                Este pedido está parado há mais de um dia. Confira se ele ainda é necessário e, se já foi entregue, marque como pronto para sair da fila.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
