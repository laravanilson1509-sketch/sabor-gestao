'use client';

import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import { moeda } from '@/lib/numeros';
import CampoMoeda from '@/components/CampoMoeda';
import { combina } from '@/lib/busca';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  buscarCaixaAberto,
  listarCaixasFechados,
  abrirCaixa,
  fecharCaixa,
  listarMovimentacoes,
  adicionarMovimentacao,
  listarVendas,
  resumirVendas,
  calcularDinheiroEsperado,
  rotuloForma,
  type Caixa,
  type Movimentacao,
  type Venda,
} from '@/lib/queries/caixa';
import { listarItens, type ItemPdv } from '@/lib/queries/salao';
import { contarPendenciasAbertas } from '@/lib/queries/pendenciasEstoque';

const INPUT =
  'border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent';
const BTN_PRIMARY =
  'btn btn-primario';
const BTN_SECONDARY =
  'btn btn-secundario';


const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hora(iso);

// "YYYY-MM-DD" do dia de hoje no fuso do navegador
function hojeLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function limitesDoDia(data: string) {
  const inicio = new Date(data + 'T00:00:00');
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

const ROTULO_ORIGEM: Record<Venda['origem'], string> = {
  mesa: 'Salão',
  balcao: 'Balcão',
  delivery: 'Delivery',
};

const COR_ORIGEM: Record<Venda['origem'], string> = {
  mesa: 'bg-accent-soft text-accent-ink',
  balcao: 'bg-line text-ink-soft',
  delivery: 'bg-violet-soft text-violet',
};

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{rotulo}</p>
      <p className="text-2xl font-bold text-ink mt-1">{valor}</p>
      {detalhe && <p className="text-xs text-ink-subtle mt-0.5">{detalhe}</p>}
    </div>
  );
}

export default function CaixaPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // caixa
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [vendasCaixa, setVendasCaixa] = useState<Venda[]>([]);
  const [fechados, setFechados] = useState<Caixa[]>([]);
  const [trocoInicial, setTrocoInicial] = useState('');
  const [movTipo, setMovTipo] = useState<'sangria' | 'suprimento'>('sangria');
  const [movValor, setMovValor] = useState('');
  const [movDescricao, setMovDescricao] = useState('');

  // fechamento
  const [mostrarFechamento, setMostrarFechamento] = useState(false);
  const [valorContado, setValorContado] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');
  const [pendenciasEstoque, setPendenciasEstoque] = useState(0);

  // vendas do dia
  const [data, setData] = useState(hojeLocal());
  const [vendasDia, setVendasDia] = useState<Venda[]>([]);
  const [carregandoDia, setCarregandoDia] = useState(false);
  const [buscaVenda, setBuscaVenda] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [itensAbertos, setItensAbertos] = useState<ItemPdv[]>([]);

  async function carregarCaixa() {
    const [c, f] = await Promise.all([
      buscarCaixaAberto(supabase, unidadeId),
      listarCaixasFechados(supabase, unidadeId),
    ]);
    setCaixa(c);
    setFechados(f);
    if (c) {
      const [m, v] = await Promise.all([
        listarMovimentacoes(supabase, c.id),
        listarVendas(supabase, unidadeId, c.aberto_em, new Date(Date.now() + 60000).toISOString()),
      ]);
      setMovs(m);
      setVendasCaixa(v);
    } else {
      setMovs([]);
      setVendasCaixa([]);
    }
  }

  async function carregarDia(dia: string) {
    setCarregandoDia(true);
    setAberta(null);
    try {
      const { inicio, fim } = limitesDoDia(dia);
      setVendasDia(await listarVendas(supabase, unidadeId, inicio, fim));
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar as vendas');
    }
    setCarregandoDia(false);
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([carregarCaixa(), carregarDia(data)]);
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar o caixa');
      }
      setLoading(false);
    })();
  }, []);

  async function executar(acao: () => Promise<void>, mensagemErro: string) {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      await Promise.all([carregarCaixa(), carregarDia(data)]);
    } catch (e: any) {
      setErro(e.message || mensagemErro);
    }
    setOcupado(false);
  }

  function handleAbrir(e: React.FormEvent) {
    e.preventDefault();
    const valor = parseFloat(trocoInicial) || 0;
    if (valor < 0) {
      setErro('O troco inicial não pode ser negativo.');
      return;
    }
    executar(async () => {
      await abrirCaixa(supabase, unidadeId, valor);
      setTrocoInicial('');
    }, 'Erro ao abrir o caixa');
  }

  function handleMovimentacao(e: React.FormEvent) {
    e.preventDefault();
    if (!caixa) return;
    const valor = parseFloat(movValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    executar(async () => {
      await adicionarMovimentacao(supabase, {
        caixaId: caixa.id,
        tipo: movTipo,
        valor,
        descricao: movDescricao.trim() || null,
      });
      setMovValor('');
      setMovDescricao('');
    }, 'Erro ao registrar a movimentação');
  }

  function abrirFechamento() {
    setValorContado('');
    setObsFechamento('');
    setPendenciasEstoque(0);
    setMostrarFechamento(true);
    // lembrete: conferências de estoque abertas desde que o caixa abriu
    if (caixa) {
      contarPendenciasAbertas(supabase, unidadeId, caixa.aberto_em)
        .then(setPendenciasEstoque)
        .catch(() => setPendenciasEstoque(0));
    }
  }

  function handleFechar(e: React.FormEvent) {
    e.preventDefault();
    if (!caixa) return;
    const contado = parseFloat(valorContado.replace(',', '.'));
    if (isNaN(contado) || contado < 0) {
      setErro('Informe quanto dinheiro tem na gaveta.');
      return;
    }
    executar(async () => {
      await fecharCaixa(supabase, caixa.id, {
        valorEsperado: dinheiro!.esperado,
        valorContado: contado,
        observacao: obsFechamento.trim() || null,
      });
      setMostrarFechamento(false);
    }, 'Erro ao fechar o caixa');
  }

  async function alternarVenda(v: Venda) {
    if (aberta === v.id) {
      setAberta(null);
      return;
    }
    setAberta(v.id);
    setItensAbertos([]);
    if (!v.itensDelivery) {
      try {
        // itens cancelados não fazem parte da venda
        setItensAbertos((await listarItens(supabase, v.id)).filter((i) => !i.cancelado));
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar os itens');
      }
    }
  }

  const resumoCaixa = resumirVendas(vendasCaixa);
  const dinheiro = caixa ? calcularDinheiroEsperado(caixa, vendasCaixa, movs) : null;
  const resumoDia = resumirVendas(vendasDia);
  const vendasFiltradas = vendasDia.filter((v) =>
    combina(buscaVenda, v.titulo, rotuloForma(v.forma), v.valor.toFixed(2).replace('.', ','), hora(v.quando))
  );
  const maiorForma = Math.max(1, ...resumoDia.porForma.map((f) => f.valor));
  const contadoNum = parseFloat(valorContado.replace(',', '.'));
  const diferenca = dinheiro && !isNaN(contadoNum) ? contadoNum - dinheiro.esperado : null;
  const ehHoje = data === hojeLocal();

  if (loading) {
    return <p className="text-center py-12 text-ink-muted">Carregando...</p>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">Caixa</h1>
          <p className="text-sm text-ink-muted">Abertura, fechamento e vendas do dia</p>
        </div>

        {erro && (
          <div role="alert" className="mb-4 text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          {/* ---------------- CAIXA ---------------- */}
          <div className="space-y-4 lg:sticky lg:top-6">
            {!caixa ? (
              <form onSubmit={handleAbrir} className="bg-surface border border-line rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-ink">Caixa</h2>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-line text-ink-muted">
                    Fechado
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-soft mb-1">Troco inicial (R$)</label>
                  <CampoMoeda
                    value={trocoInicial}
                    onChange={setTrocoInicial}
                    placeholder="0,00"
                    className={INPUT + ' w-full'}
                  />
                  <p className="text-xs text-ink-subtle mt-1">Dinheiro que já está na gaveta ao abrir</p>
                </div>
                <button type="submit" disabled={ocupado} className={BTN_PRIMARY + ' w-full'}>
                  Abrir caixa
                </button>
              </form>
            ) : (
              <>
                <div className="bg-surface border border-line rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-base font-semibold text-ink">Caixa</h2>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-success-soft text-success">
                      Aberto
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted mb-4">Aberto em {dataHora(caixa.aberto_em)}</p>

                  <dl className="text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">Vendido no caixa</dt>
                      <dd className="font-semibold text-ink">{moeda(resumoCaixa.total)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">Pedidos</dt>
                      <dd className="text-ink">{resumoCaixa.quantidade}</dd>
                    </div>
                  </dl>

                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mt-5 mb-2">
                    Dinheiro na gaveta
                  </h3>
                  <dl className="text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">Troco inicial</dt>
                      <dd className="text-ink">{moeda(caixa.saldo_inicial)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">+ Vendas em dinheiro</dt>
                      <dd className="text-ink">{moeda(dinheiro!.vendasDinheiro)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">+ Suprimentos</dt>
                      <dd className="text-ink">{moeda(dinheiro!.suprimentos)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">− Sangrias</dt>
                      <dd className="text-ink">{moeda(dinheiro!.sangrias)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-2 mt-2">
                      <dt className="font-medium text-ink">Deve ter na gaveta</dt>
                      <dd className="text-lg font-bold text-accent">{moeda(dinheiro!.esperado)}</dd>
                    </div>
                  </dl>

                  <button onClick={abrirFechamento} disabled={ocupado} className={BTN_PRIMARY + ' w-full mt-4'}>
                    Fechar caixa
                  </button>
                </div>

                <form onSubmit={handleMovimentacao} className="bg-surface border border-line rounded-xl p-4 space-y-3">
                  <h2 className="text-base font-semibold text-ink">Sangria e suprimento</h2>
                  <div className="flex gap-2">
                    {(['sangria', 'suprimento'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMovTipo(t)}
                        className={
                          'flex-1 text-sm px-3 py-2 rounded-lg border font-medium transition ' +
                          (movTipo === t
                            ? 'bg-accent text-accent-contrast border-accent'
                            : 'bg-surface text-ink-soft border-line hover:bg-surface-hover')
                        }
                      >
                        {t === 'sangria' ? 'Sangria (retirada)' : 'Suprimento (entrada)'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <CampoMoeda
                      value={movValor}
                      onChange={setMovValor}
                      placeholder="Valor"
                      className={INPUT + ' w-28'}
                    />
                    <input
                      type="text"
                      value={movDescricao}
                      onChange={(e) => setMovDescricao(e.target.value)}
                      placeholder="Motivo (opcional)"
                      className={INPUT + ' flex-1 min-w-0'}
                    />
                  </div>
                  <button type="submit" disabled={ocupado} className={BTN_SECONDARY + ' w-full'}>
                    Registrar {movTipo}
                  </button>

                  {movs.length > 0 && (
                    <ul className="divide-y divide-line-soft border-t border-line-soft">
                      {movs.map((m) => (
                        <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="text-ink">
                              {m.tipo === 'sangria' ? 'Sangria' : 'Suprimento'}
                              {m.descricao ? ' · ' + m.descricao : ''}
                            </p>
                            <p className="text-xs text-ink-subtle">{hora(m.criado_em)}</p>
                          </div>
                          <span
                            className={
                              'font-semibold shrink-0 ' + (m.tipo === 'sangria' ? 'text-danger' : 'text-success')
                            }
                          >
                            {m.tipo === 'sangria' ? '− ' : '+ '}
                            {moeda(m.valor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </form>
              </>
            )}

            {fechados.length > 0 && (
              <div className="bg-surface border border-line rounded-xl p-4">
                <h2 className="text-base font-semibold text-ink mb-2">Últimos fechamentos</h2>
                <ul className="divide-y divide-line-soft">
                  {fechados.map((f) => {
                    const dif = Number(f.valor_contado ?? 0) - Number(f.valor_esperado ?? 0);
                    return (
                      <li key={f.id} className="py-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-ink">{dataHora(f.fechado_em!)}</span>
                          <span className="font-semibold text-ink">{moeda(Number(f.valor_contado ?? 0))}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-xs">
                          <span className="text-ink-subtle">Aberto {dataHora(f.aberto_em)}</span>
                          <span
                            className={
                              Math.abs(dif) < 0.005
                                ? 'text-success'
                                : dif > 0
                                ? 'text-warning'
                                : 'text-danger'
                            }
                          >
                            {Math.abs(dif) < 0.005
                              ? 'Conferido'
                              : (dif > 0 ? 'Sobrou ' : 'Faltou ') + moeda(Math.abs(dif))}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* ---------------- VENDAS DO DIA ---------------- */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-40">
                <h2 className="text-lg font-bold text-ink">Vendas {ehHoje ? 'de hoje' : 'do dia'}</h2>
                <p className="text-xs text-ink-muted">Pedidos do PDV fechados e delivery entregue</p>
              </div>
              <input
                type="date"
                value={data}
                max={hojeLocal()}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setData(e.target.value);
                  carregarDia(e.target.value);
                }}
                className={INPUT}
              />
              {!ehHoje && (
                <button
                  onClick={() => {
                    setData(hojeLocal());
                    carregarDia(hojeLocal());
                  }}
                  className={BTN_SECONDARY}
                >
                  Hoje
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Indicador rotulo="Total vendido" valor={moeda(resumoDia.total)} />
              <Indicador rotulo="Pedidos" valor={String(resumoDia.quantidade)} />
              <Indicador rotulo="Ticket médio" valor={moeda(resumoDia.ticketMedio)} detalhe="Valor médio por pedido" />
            </div>

            <div className="bg-surface border border-line rounded-xl p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted mb-3">
                Por forma de pagamento
              </h3>
              {resumoDia.porForma.length === 0 ? (
                <p className="text-sm text-ink-muted py-4 text-center">Nenhuma venda neste dia.</p>
              ) : (
                <ul className="space-y-3">
                  {resumoDia.porForma.map((f) => (
                    <li key={f.forma || 'nao_informado'}>
                      <div className="flex justify-between gap-3 text-sm mb-1">
                        <span className="text-ink">
                          {rotuloForma(f.forma)}
                          <span className="text-ink-subtle">
                            {' · '}
                            {f.quantidade} {f.quantidade === 1 ? 'pedido' : 'pedidos'}
                          </span>
                        </span>
                        <span className="font-semibold text-ink">
                          {moeda(f.valor)}
                          <span className="font-normal text-ink-muted">
                            {' '}({resumoDia.total > 0 ? Math.round((f.valor / resumoDia.total) * 100) : 0}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-line-soft overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: (f.valor / maiorForma) * 100 + '%' }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface border border-line rounded-xl overflow-x-auto">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted px-4 pt-4 pb-3">
                Histórico de pedidos
              </h3>
              {vendasDia.length > 0 && (
                <div className="px-4 pb-3">
                  <BarraBusca valor={buscaVenda} onChange={setBuscaVenda} placeholder="Buscar por mesa, pedido, forma de pagamento ou valor..." />
                </div>
              )}
              {carregandoDia ? (
                <p className="text-sm text-ink-muted py-8 text-center">Carregando...</p>
              ) : vendasDia.length === 0 ? (
                <p className="text-sm text-ink-muted py-8 text-center">Nenhum pedido fechado neste dia.</p>
              ) : (
                <table className="w-full min-w-[520px]">
                  <thead className="bg-surface-hover border-y border-line">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Hora</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Pedido</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Pagamento</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {vendasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-muted">
                          Nada encontrado para “{buscaVenda}”.
                        </td>
                      </tr>
                    )}
                    {vendasFiltradas.map((v) => (
                      <Fragment key={v.id}>
                        <tr
                          onClick={() => alternarVenda(v)}
                          className="hover:bg-surface-hover cursor-pointer"
                        >
                          <td className="px-4 py-3 text-sm text-ink-soft">{hora(v.quando)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={'rounded-full px-2 py-0.5 text-xs font-semibold mr-2 ' + COR_ORIGEM[v.origem]}>
                              {ROTULO_ORIGEM[v.origem]}
                            </span>
                            <span className="font-medium text-ink">{v.titulo}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-ink-soft">{rotuloForma(v.forma)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-ink">
                            {moeda(v.valor)}
                            <span className="ml-2 text-ink-subtle">{aberta === v.id ? '▴' : '▾'}</span>
                          </td>
                        </tr>
                        {aberta === v.id && (
                          <tr className="bg-surface-hover">
                            <td colSpan={4} className="px-4 py-3">
                              {(v.itensDelivery || itensAbertos).length === 0 ? (
                                <p className="text-sm text-ink-muted">Carregando itens...</p>
                              ) : (
                                <ul className="text-sm space-y-1">
                                  {(v.itensDelivery || itensAbertos).map((i, idx) => (
                                    <li key={idx} className="flex justify-between gap-3">
                                      <span className="text-ink-soft">
                                        {i.quantidade}× {i.nome}
                                      </span>
                                      <span className="text-ink-muted">
                                        {moeda(i.quantidade * Number(i.preco_unitario))}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {mostrarFechamento && caixa && dinheiro && (
        <div className="fixed inset-0 ui-modal-overlay flex items-center justify-center z-50 p-4">
          <form onSubmit={handleFechar} className="ui-modal-panel p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Fechar caixa</h2>
              <button
                type="button"
                onClick={() => setMostrarFechamento(false)}
                className="text-xl text-ink-subtle hover:text-ink"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {pendenciasEstoque > 0 && (
              <div className="text-sm text-warning bg-warning-soft border border-warning-line rounded-lg px-3 py-2">
                {pendenciasEstoque === 1
                  ? 'Existe 1 conferência de estoque pendente desde a abertura do caixa.'
                  : 'Existem ' + pendenciasEstoque + ' conferências de estoque pendentes desde a abertura do caixa.'}{' '}
                <a href="/estoque" className="font-medium underline">
                  Ver no Estoque
                </a>
              </div>
            )}

            <div className="bg-surface-hover border border-line rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-muted">Vendido no caixa</span>
                <span className="text-ink">{moeda(resumoCaixa.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Deve ter na gaveta</span>
                <span className="font-bold text-accent">{moeda(dinheiro.esperado)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1">
                Quanto dinheiro tem na gaveta? (R$)
              </label>
              <CampoMoeda
                autoFocus
                value={valorContado}
                onChange={setValorContado}
                placeholder="Conte as notas e moedas"
                className={INPUT + ' w-full'}
              />
              {diferenca !== null && (
                <p
                  className={
                    'text-sm font-medium mt-2 rounded-lg px-3 py-2 ' +
                    (Math.abs(diferenca) < 0.005
                      ? 'bg-success-soft text-success'
                      : diferenca > 0
                      ? 'bg-warning-soft text-warning'
                      : 'bg-danger-soft text-danger')
                  }
                >
                  {Math.abs(diferenca) < 0.005
                    ? 'Confere certinho.'
                    : diferenca > 0
                    ? 'Sobrou ' + moeda(diferenca) + ' na gaveta.'
                    : 'Faltou ' + moeda(-diferenca) + ' na gaveta.'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1">Observação (opcional)</label>
              <input
                type="text"
                value={obsFechamento}
                onChange={(e) => setObsFechamento(e.target.value)}
                placeholder="Ex: troco dado a mais"
                className={INPUT + ' w-full'}
              />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={ocupado} className={BTN_PRIMARY + ' flex-1'}>
                {ocupado ? 'Fechando...' : 'Confirmar fechamento'}
              </button>
              <button type="button" onClick={() => setMostrarFechamento(false)} className={BTN_SECONDARY + ' flex-1'}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
