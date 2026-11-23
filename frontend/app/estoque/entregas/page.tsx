'use client';

// Estoque › Entregas: bebidas e produtos acabados lançados no PDV e se o garçom confirmou que levou.
// Usada no inventário: item "sem confirmação" com a conta já fechada = possível falha de confirmação
// do garçom (e não necessariamente produto perdido).

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { type Coluna, type Ordem } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { combina } from '@/lib/busca';
import { nomeDoEmail } from '@/lib/nomes';
import { listarEntregas, ROTULO_SITUACAO, type EntregaItem, type SituacaoEntrega } from '@/lib/queries/entregas';

type Filtro = 'todas' | SituacaoEntrega;
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'sem_confirmacao', rotulo: 'Sem confirmação' },
  { valor: 'aguardando', rotulo: 'Aguardando' },
  { valor: 'confirmada', rotulo: 'Confirmadas' },
];
const POR_PAGINA = 25;

const dataISO = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const COR: Record<SituacaoEntrega, 'success' | 'warning' | 'danger'> = { confirmada: 'success', aguardando: 'warning', sem_confirmacao: 'danger' };

export default function EntregasPage() {
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );
  const hoje = dataISO(new Date());
  const seteDias = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return dataISO(d);
  }, []);

  const [de, setDe] = useState(seteDias);
  const [ate, setAte] = useState(hoje);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<EntregaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<Ordem>({ chave: 'quando', direcao: 'desc' });
  const [pagina, setPagina] = useState(1);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const inicio = new Date(de + 'T00:00:00');
      const fim = new Date(ate + 'T00:00:00');
      fim.setDate(fim.getDate() + 1);
      setLista(await listarEntregas(supabase, { de: inicio.toISOString(), ate: fim.toISOString() }));
    } catch (e: any) {
      setErro(
        /entrega_status|does not exist|Could not find/i.test(e?.message || '')
          ? 'Falta rodar o SQL 0023_entrega_direta no Supabase (SQL Editor) para usar esta tela.'
          : e?.message || 'Não foi possível carregar as entregas.'
      );
    }
    setCarregando(false);
  }

  useEffect(() => {
    if (de && ate && de <= ate) carregar();
  }, [de, ate]);

  const totais = useMemo(() => {
    const t = { todas: lista.length, sem_confirmacao: 0, aguardando: 0, confirmada: 0 };
    for (const i of lista) t[i.situacao]++;
    return t;
  }, [lista]);

  const filtradas = useMemo(
    () =>
      lista.filter(
        (i) =>
          (filtro === 'todas' || i.situacao === filtro) &&
          combina(busca, i.item, i.pedido, i.codigo, i.cliente, i.lancadoPor && nomeDoEmail(i.lancadoPor), i.confirmadoPor && nomeDoEmail(i.confirmadoPor))
      ),
    [lista, filtro, busca]
  );

  const ordenadas = useMemo(() => {
    if (!ordem) return filtradas;
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    const valor = (i: EntregaItem) =>
      ordem.chave === 'item' ? i.item : ordem.chave === 'pedido' ? i.pedido : ordem.chave === 'garcom' ? i.lancadoPor || '' : ordem.chave === 'situacao' ? i.situacao : i.quando;
    return [...filtradas].sort((a, b) => String(valor(a)).localeCompare(String(valor(b)), 'pt-BR') * sinal);
  }, [filtradas, ordem]);
  const visiveis = useMemo(() => ordenadas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), [ordenadas, pagina]);
  useEffect(() => setPagina(1), [filtro, busca, ordem, lista]);

  const colunas: Coluna<EntregaItem>[] = [
    { chave: 'quando', cabecalho: 'Lançado em', ordenavel: true, className: 'text-ink-soft whitespace-nowrap', render: (i) => dataHora(i.quando) },
    {
      chave: 'pedido',
      cabecalho: 'Pedido',
      ordenavel: true,
      render: (i) => (
        <>
          <span className="font-medium text-ink">{i.pedido}</span>
          {i.codigo && <span className="ml-2 text-xs font-semibold tabular-nums text-accent">{i.codigo}</span>}
          {i.cliente && <span className="block text-xs text-ink-muted">{i.cliente}</span>}
        </>
      ),
    },
    { chave: 'item', cabecalho: 'Item', ordenavel: true, render: (i) => <span className="text-ink">{i.quantidade}× {i.item}</span> },
    { chave: 'garcom', cabecalho: 'Lançado por', ordenavel: true, className: 'text-ink-soft', render: (i) => (i.lancadoPor ? nomeDoEmail(i.lancadoPor) : '—') },
    {
      chave: 'situacao',
      cabecalho: 'Situação',
      ordenavel: true,
      render: (i) => (
        <>
          <StatusBadge status={COR[i.situacao]}>{ROTULO_SITUACAO[i.situacao]}</StatusBadge>
          {i.confirmadoEm && (
            <span className="mt-1 block text-xs text-ink-muted">
              {dataHora(i.confirmadoEm)}
              {i.confirmadoPor ? ' · ' + nomeDoEmail(i.confirmadoPor) : ''}
            </span>
          )}
        </>
      ),
    },
  ];

  const campoData = 'rounded-token border border-line bg-surface px-3 py-2 text-sm text-ink';

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Estoque', href: '/estoque' }, { rotulo: 'Entregas' }]}
          voltarHref="/estoque"
          titulo="Entregas de bebidas e produtos"
          descricao="Itens que não passam pela cozinha: o garçom confirma que levou à mesa. Use no inventário para separar falha de confirmação de produto que sumiu."
        />

        {erro && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-token bg-danger-soft px-4 py-3 text-sm text-danger">
            <span>{erro}</span>
            <button type="button" onClick={carregar} className="font-semibold underline">
              Tentar de novo
            </button>
          </div>
        )}

        <div role="group" aria-label="Filtrar por situação" className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
              className={
                'ui-focus rounded-card border p-3 text-left transition-colors sm:p-4 ' +
                (filtro === f.valor ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-hover')
              }
            >
              <span className="block text-xs font-medium text-ink-muted sm:text-sm">{f.rotulo}</span>
              <span className={'mt-1 block text-xl font-semibold tabular-nums sm:text-2xl ' + (f.valor === 'sem_confirmacao' && totais.sem_confirmacao > 0 ? 'text-danger' : 'text-ink')}>
                {carregando ? '–' : totais[f.valor]}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <BarraBusca valor={busca} onChange={setBusca} debounce={300} atalho placeholder="Buscar por garçom, mesa, código ou item" className="min-w-[16rem] flex-1" />
          <label className="text-xs text-ink-muted">
            De
            <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={campoData + ' mt-1 block'} />
          </label>
          <label className="text-xs text-ink-muted">
            Até
            <input type="date" value={ate} min={de} max={hoje} onChange={(e) => setAte(e.target.value)} className={campoData + ' mt-1 block'} />
          </label>
        </div>

        <DataTable
          descricao="Entregas de bebidas e produtos acabados"
          colunas={colunas}
          linhas={visiveis}
          chaveLinha={(i) => i.id}
          carregando={carregando}
          ordem={ordem}
          aoMudarOrdem={setOrdem}
          pagina={pagina}
          porPagina={POR_PAGINA}
          total={ordenadas.length}
          aoMudarPagina={setPagina}
          vazio={
            busca || filtro !== 'todas' ? (
              <NadaEncontrado busca={busca || FILTROS.find((f) => f.valor === filtro)!.rotulo} />
            ) : erro ? null : (
              <p className="p-8 text-center text-sm text-ink-muted">Nenhuma bebida ou produto acabado lançado neste período.</p>
            )
          }
          cartaoMobile={(i) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-ink">
                  {i.quantidade}× {i.item}
                </p>
                <StatusBadge status={COR[i.situacao]}>{ROTULO_SITUACAO[i.situacao]}</StatusBadge>
              </div>
              <p className="text-sm text-ink-muted">
                {i.pedido}
                {i.codigo ? ' · ' + i.codigo : ''} · {dataHora(i.quando)}
              </p>
              <p className="text-xs text-ink-muted">
                Lançado por {i.lancadoPor ? nomeDoEmail(i.lancadoPor) : '—'}
                {i.confirmadoEm && ' · levado às ' + dataHora(i.confirmadoEm) + (i.confirmadoPor ? ' por ' + nomeDoEmail(i.confirmadoPor) : '')}
              </p>
            </div>
          )}
        />
      </div>
    </div>
  );
}
