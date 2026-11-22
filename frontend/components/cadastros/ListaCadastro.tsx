'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Pencil, Plus, Power, RotateCcw } from 'lucide-react';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { type Coluna, type Ordem } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { combina } from '@/lib/busca';
import { listarCadastros, atualizarCadastro } from '@/lib/queries/cadastros';
import { diaMes, proximoAniversario } from '@/lib/queries/aniversarios';

type ColunaConfig = { chave: string; rotulo: string; tipo?: 'aniversario' };

type Props = {
  tabela: string;
  titulo: string;
  singular: string;
  rota: string;
  colunas: ColunaConfig[];
};

type Registro = Record<string, any> & { id: string; nome: string; ativo?: boolean };
type FiltroStatus = 'todos' | 'ativo' | 'inativo';

const POR_PAGINA = 25;

const FILTROS: { valor: FiltroStatus; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ativo', rotulo: 'Ativos' },
  { valor: 'inativo', rotulo: 'Inativos' },
];

// valor usado para ordenar uma coluna (aniversário ordena pelo próximo a chegar)
function valorOrdenacao(r: Registro, chave: string, tipo?: 'aniversario'): string | number {
  if (tipo === 'aniversario') return r[chave] ? proximoAniversario(r[chave]).faltam : Number.MAX_SAFE_INTEGER;
  return String(r[chave] ?? '');
}

function celulaAniversario(data: string | null) {
  if (!data) return <span className="text-ink-subtle">—</span>;
  const { faltam } = proximoAniversario(data);
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      {diaMes(data)}
      {faltam === 0 && <StatusBadge status="warning">Hoje!</StatusBadge>}
      {faltam > 0 && faltam <= 7 && (
        <span className="text-xs text-ink-subtle">
          em {faltam} {faltam === 1 ? 'dia' : 'dias'}
        </span>
      )}
    </span>
  );
}

export default function ListaCadastro({ tabela, titulo, singular, rota, colunas }: Props) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [itens, setItens] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatus>('todos');
  const [ordem, setOrdem] = useState<Ordem>({ chave: 'nome', direcao: 'asc' });
  const [pagina, setPagina] = useState(1);
  const paginaDaUrl = useRef<number | null>(null);

  const [paraInativar, setParaInativar] = useState<Registro | null>(null);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; desfazer?: Registro } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      setItens(((await listarCadastros(supabase, tabela as any, unidadeId)) as Registro[]) || []);
    } catch (err: any) {
      console.error(err);
      setErroCarga(err?.message || 'Não foi possível carregar a lista.');
    }
    setCarregando(false);
  }, [supabase, tabela, unidadeId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // filtro, ordenação e página são calculados uma vez por mudança, não a cada tecla
  const filtrados = useMemo(
    () =>
      itens.filter(
        (i) =>
          (status === 'todos' || (status === 'ativo' ? !!i.ativo : !i.ativo)) &&
          combina(busca, i.nome, ...colunas.map((c) => i[c.chave]))
      ),
    [itens, busca, status, colunas]
  );

  const ordenados = useMemo(() => {
    if (!ordem) return filtrados;
    const tipo = colunas.find((c) => c.chave === ordem.chave)?.tipo;
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = valorOrdenacao(a, ordem.chave, tipo);
      const vb = valorOrdenacao(b, ordem.chave, tipo);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sinal;
      const aVazio = va === '';
      const bVazio = vb === '';
      if (aVazio !== bVazio) return aVazio ? 1 : -1; // vazios sempre no fim
      return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' }) * sinal;
    });
  }, [filtrados, ordem, colunas]);

  const visiveis = useMemo(() => ordenados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), [ordenados, pagina]);

  // Busca, situação, ordem e página ficam na URL (?q=ana&status=ativo&sort=nome&dir=asc&page=2):
  // ao voltar de uma edição ou recarregar, a tela abre do mesmo jeito.
  const [urlLida, setUrlLida] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const st = p.get('status');
    if (st === 'ativo' || st === 'inativo') setStatus(st);
    if (p.get('q')) setBusca(p.get('q')!);
    if (p.get('sort')) setOrdem({ chave: p.get('sort')!, direcao: p.get('dir') === 'desc' ? 'desc' : 'asc' });
    const pg = Number(p.get('page'));
    // a página lida da URL precisa sobreviver ao "volta para a primeira página" abaixo
    paginaDaUrl.current = pg > 1 ? pg : null;
    setUrlLida(true);
  }, []);

  // mudou busca/filtro/ordem: volta para a primeira página
  useEffect(() => {
    if (!urlLida) return;
    if (paginaDaUrl.current) {
      setPagina(paginaDaUrl.current);
      paginaDaUrl.current = null;
    } else setPagina(1);
  }, [busca, status, ordem, urlLida]);

  useEffect(() => {
    if (!urlLida) return;
    const p = new URLSearchParams();
    if (busca) p.set('q', busca);
    if (status !== 'todos') p.set('status', status);
    if (ordem && !(ordem.chave === 'nome' && ordem.direcao === 'asc')) {
      p.set('sort', ordem.chave);
      p.set('dir', ordem.direcao);
    }
    if (pagina > 1) p.set('page', String(pagina));
    const qs = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }, [busca, status, ordem, pagina, urlLida]);

  const totais = useMemo(
    () => ({ todos: itens.length, ativo: itens.filter((i) => i.ativo).length, inativo: itens.filter((i) => !i.ativo).length }),
    [itens]
  );

  const abrirEdicao = useCallback((r: Registro) => router.push(rota + '/cadastro?id=' + r.id), [router, rota]);

  // Inativar não apaga: o cadastro some das novas escolhas, mas o histórico continua e dá para reativar.
  const mudarStatus = useCallback(async (r: Registro, ativo: boolean) => {
    setSalvandoStatus(true);
    setErroStatus(null);
    try {
      await atualizarCadastro(supabase, tabela as any, r.id, { ativo });
      setItens((l) => l.map((x) => (x.id === r.id ? { ...x, ativo } : x)));
      setParaInativar(null);
      setAviso({ texto: r.nome + (ativo ? ' reativado.' : ' inativado.'), desfazer: ativo ? undefined : r });
    } catch (err: any) {
      setErroStatus('Não foi possível ' + (ativo ? 'reativar' : 'inativar') + ': ' + (err?.message || 'erro desconhecido'));
    } finally {
      setSalvandoStatus(false);
    }
  }, [supabase, tabela]);

  const colunasTabela = useMemo<Coluna<Registro>[]>(
    () => [
      {
        chave: 'nome',
        cabecalho: 'Nome',
        ordenavel: true,
        render: (r) => <span className="font-medium text-ink">{r.nome}</span>,
      },
      ...colunas.map<Coluna<Registro>>((c) => ({
        chave: c.chave,
        cabecalho: c.rotulo,
        ordenavel: true,
        className: 'text-ink-muted',
        render: (r) => (c.tipo === 'aniversario' ? celulaAniversario(r[c.chave]) : r[c.chave] || <span className="text-ink-subtle">—</span>),
      })),
      {
        chave: 'ativo',
        cabecalho: 'Status',
        render: (r) => <StatusBadge status={r.ativo ? 'success' : 'warning'}>{r.ativo ? 'Ativo' : 'Inativo'}</StatusBadge>,
      },
      {
        chave: 'acoes',
        cabecalho: 'Ações',
        alinhar: 'dir',
        render: (r) => (
          // os botões não podem abrir a edição da linha ao serem clicados
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Link href={rota + '/cadastro?id=' + r.id} className="btn btn-secundario !px-3 !py-1.5" aria-label={'Editar ' + r.nome}>
              <Pencil size={14} aria-hidden /> Editar
            </Link>
            {r.ativo ? (
              <button type="button" onClick={() => { setErroStatus(null); setParaInativar(r); }} className="btn btn-perigo !px-3 !py-1.5" aria-label={'Inativar ' + r.nome}>
                <Power size={14} aria-hidden /> Inativar
              </button>
            ) : (
              <button type="button" onClick={() => mudarStatus(r, true)} className="btn btn-secundario !px-3 !py-1.5" aria-label={'Reativar ' + r.nome}>
                <RotateCcw size={14} aria-hidden /> Reativar
              </button>
            )}
          </div>
        ),
      },
    ],
    [colunas, rota, mudarStatus]
  );

  // o aviso some sozinho depois de 6 segundos
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const semCadastros = !carregando && !erroCarga && itens.length === 0;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Cadastros', href: '/cadastros' }, { rotulo: titulo }]}
          voltarHref="/cadastros"
          titulo={titulo}
          descricao={carregando ? ' ' : totais.todos + (totais.todos === 1 ? ' cadastro' : ' cadastros')}
          acoes={
            <Link href={rota + '/cadastro'} className="btn btn-primario">
              <Plus size={16} strokeWidth={2} aria-hidden /> Novo {singular}
            </Link>
          }
        />

        {erroCarga && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-token bg-danger-soft px-4 py-3 text-sm text-danger">
            <span>{erroCarga}</span>
            <button type="button" onClick={carregar} className="font-semibold underline">
              Tentar de novo
            </button>
          </div>
        )}

        {!semCadastros && !erroCarga && (
          <div role="group" aria-label="Filtrar por situação" className="mb-4 grid grid-cols-3 gap-3">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setStatus(f.valor)}
                aria-pressed={status === f.valor}
                className={
                  'ui-focus rounded-card border p-3 text-left transition-colors sm:p-4 ' +
                  (status === f.valor ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-hover')
                }
              >
                <span className="block text-xs font-medium text-ink-muted sm:text-sm">{f.rotulo}</span>
                <span className="mt-1 block text-xl font-semibold tabular-nums text-ink sm:text-2xl">{carregando ? '–' : totais[f.valor]}</span>
              </button>
            ))}
          </div>
        )}

        {!semCadastros && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <BarraBusca
              valor={busca}
              onChange={setBusca}
              debounce={300}
              atalho
              placeholder={'Buscar ' + singular + ' por nome' + (colunas.length ? ', ' + colunas.map((c) => c.rotulo.toLowerCase()).join(', ') : '')}
              className="flex-1 min-w-[16rem]"
            />
          </div>
        )}

        {semCadastros ? (
          <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
            <p className="font-medium text-ink">Nenhum {singular} cadastrado</p>
            <p className="mt-1 text-sm text-ink-muted">Comece cadastrando o primeiro.</p>
            <Link href={rota + '/cadastro'} className="btn btn-primario mt-5">
              <Plus size={16} strokeWidth={2} aria-hidden /> Novo {singular}
            </Link>
          </div>
        ) : (
          <DataTable
            descricao={'Lista de ' + titulo.toLowerCase()}
            colunas={colunasTabela}
            linhas={visiveis}
            chaveLinha={(r) => r.id}
            carregando={carregando}
            aoClicarLinha={abrirEdicao}
            ordem={ordem}
            aoMudarOrdem={setOrdem}
            pagina={pagina}
            porPagina={POR_PAGINA}
            total={ordenados.length}
            aoMudarPagina={setPagina}
            classeLinha={(r) => (r.ativo ? '' : 'opacity-70')}
            cartaoMobile={(r) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-ink">{r.nome}</p>
                  <StatusBadge status={r.ativo ? 'success' : 'warning'}>{r.ativo ? 'Ativo' : 'Inativo'}</StatusBadge>
                </div>
                {colunas.map((c) => (
                  <p key={c.chave} className="flex justify-between gap-3 text-sm">
                    <span className="text-ink-muted">{c.rotulo}</span>
                    <span className="text-right text-ink">{c.tipo === 'aniversario' ? celulaAniversario(r[c.chave]) : r[c.chave] || '—'}</span>
                  </p>
                ))}
                <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Link href={rota + '/cadastro?id=' + r.id} className="btn btn-secundario flex-1 !min-h-[44px]">
                    <Pencil size={14} aria-hidden /> Editar
                  </Link>
                  {r.ativo ? (
                    <button type="button" onClick={() => { setErroStatus(null); setParaInativar(r); }} className="btn btn-perigo flex-1 !min-h-[44px]">
                      <Power size={14} aria-hidden /> Inativar
                    </button>
                  ) : (
                    <button type="button" onClick={() => mudarStatus(r, true)} className="btn btn-secundario flex-1 !min-h-[44px]">
                      <RotateCcw size={14} aria-hidden /> Reativar
                    </button>
                  )}
                </div>
              </div>
            )}
            vazio={busca ? <NadaEncontrado busca={busca} /> : <p className="p-8 text-center text-sm text-ink-muted">Nenhum cadastro nesta situação.</p>}
          />
        )}
      </div>

      <Modal
        aberto={!!paraInativar}
        onFechar={() => !salvandoStatus && setParaInativar(null)}
        titulo={'Inativar ' + singular + '?'}
        tamanho="sm"
        rodape={
          <>
            <button type="button" onClick={() => setParaInativar(null)} disabled={salvandoStatus} className="btn btn-secundario">
              Cancelar
            </button>
            <button type="button" onClick={() => paraInativar && mudarStatus(paraInativar, false)} disabled={salvandoStatus} className="btn btn-perigo-cheio">
              {salvandoStatus ? 'Inativando...' : 'Inativar'}
            </button>
          </>
        }
      >
        <p>
          Inativar <strong className="text-ink">{paraInativar?.nome}</strong>? Não vai aparecer nas novas escolhas, mas o histórico continua guardado e você pode reativar quando quiser.
        </p>
        {erroStatus && (
          <p role="alert" className="mt-3 rounded-token bg-danger-soft px-3 py-2 text-danger">
            {erroStatus}
          </p>
        )}
      </Modal>

      {aviso && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-token border border-line bg-surface px-4 py-3 text-sm text-ink shadow-token-lg">
          <span>{aviso.texto}</span>
          {aviso.desfazer && (
            <button type="button" onClick={() => mudarStatus(aviso.desfazer!, true)} className="font-semibold text-accent underline">
              Desfazer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
