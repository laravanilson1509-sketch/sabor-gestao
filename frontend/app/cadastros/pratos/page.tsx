'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, X } from 'lucide-react';
import { moeda } from '@/lib/numeros';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { type Coluna, type Ordem } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { combina } from '@/lib/busca';
import { listarPratos } from '@/lib/queries/fichasTecnicas';
import { criarPratoSimples, deletarIngrediente } from '@/lib/queries/estoque';

const POR_PAGINA = 25;

type Prato = {
  id: string;
  nome: string;
  preco_venda: number | null;
  ativo: boolean;
};

const BTN =
  'text-sm px-3 py-1.5 rounded-lg border border-line bg-surface text-ink-soft hover:bg-surface-hover transition';

export default function PratosPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [pratos, setPratos] = useState<Prato[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Ordem>({ chave: 'nome', direcao: 'asc' });
  const [pagina, setPagina] = useState(1);
  const router = useRouter();

  const pratosFiltrados = useMemo(() => {
    const lista = pratos.filter((p) => combina(busca, p.nome));
    if (!ordem) return lista;
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) =>
      ordem.chave === 'preco'
        ? (Number(a.preco_venda) - Number(b.preco_venda)) * sinal
        : a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) * sinal
    );
  }, [pratos, busca, ordem]);
  const visiveis = useMemo(() => pratosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), [pratosFiltrados, pagina]);
  useEffect(() => setPagina(1), [busca, ordem]);

  async function carregar() {
    setLoading(true);
    try {
      const lista = await listarPratos(supabase, unidadeId);
      setPratos(lista as Prato[]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro('Informe o nome do prato.');
      return;
    }
    const jaExiste = pratos.some((p) => p.nome.trim().toLowerCase() === nomeLimpo.toLowerCase());
    if (jaExiste) {
      setErro('Já existe um prato com esse nome.');
      return;
    }
    setSalvando(true);
    try {
      await criarPratoSimples(supabase, { nome: nomeLimpo, ativo: true });
      setNome('');
      setShowForm(false);
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function renomear(p: Prato) {
    const novo = window.prompt('Novo nome do prato:', p.nome);
    if (!novo || !novo.trim() || novo.trim() === p.nome) return;
    const { error } = await supabase
      .from('ingredientes')
      .update({ nome: novo.trim() })
      .eq('id', p.id);
    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    await carregar();
  }

  async function alternarAtivo(p: Prato) {
    const { error } = await supabase
      .from('ingredientes')
      .update({ ativo: !p.ativo })
      .eq('id', p.id);
    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    await carregar();
  }

  async function excluir(p: Prato) {
    const ok = window.confirm(
      'Excluir o prato "' + p.nome + '"? Isso apaga também a ficha técnica dele. Não pode ser desfeito.'
    );
    if (!ok) return;
    try {
      await deletarIngrediente(supabase, p.id);
      await carregar();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  }

  const abrirFicha = useCallback((p: Prato) => router.push('/cadastros/fichas-tecnicas/' + p.id), [router]);

  const colunas: Coluna<Prato>[] = [
    { chave: 'nome', cabecalho: 'Prato', ordenavel: true, render: (p) => <span className="font-medium text-ink">{p.nome}</span> },
    {
      chave: 'preco',
      cabecalho: 'Preço de venda',
      alinhar: 'dir',
      ordenavel: true,
      render: (p) => (Number(p.preco_venda) > 0 ? moeda(Number(p.preco_venda)) : <span className="text-ink-subtle">Não definido</span>),
    },
    {
      chave: 'status',
      cabecalho: 'Status',
      render: (p) => <StatusBadge status={p.ativo ? 'success' : 'warning'}>{p.ativo ? 'Ativo' : 'Pausado'}</StatusBadge>,
    },
    {
      chave: 'acoes',
      cabecalho: 'Ações',
      alinhar: 'dir',
      render: (p) => (
        // os botões não podem abrir a ficha da linha ao serem clicados
        <div className="flex flex-wrap justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Link href={'/cadastros/fichas-tecnicas/' + p.id} className="btn btn-secundario !px-3 !py-1.5">
            Ficha técnica
          </Link>
          <button onClick={() => renomear(p)} className="btn btn-secundario !px-3 !py-1.5">
            Renomear
          </button>
          <button onClick={() => alternarAtivo(p)} className="btn btn-secundario !px-3 !py-1.5">
            {p.ativo ? 'Pausar' : 'Ativar'}
          </button>
          <button onClick={() => excluir(p)} className="btn btn-perigo !px-3 !py-1.5">
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Cadastros', href: '/cadastros' }, { rotulo: 'Pratos' }]}
          voltarHref="/cadastros"
          titulo="Pratos"
          descricao={loading ? ' ' : pratos.length + (pratos.length === 1 ? ' prato' : ' pratos') + ' · cardápio e preços de venda'}
          acoes={
            <button onClick={() => setShowForm((v) => !v)} className={showForm ? 'btn btn-secundario' : 'btn btn-primario'}>
              {showForm ? (
                <>
                  <X size={16} aria-hidden /> Cancelar
                </>
              ) : (
                <>
                  <Plus size={16} strokeWidth={2} aria-hidden /> Novo prato
                </>
              )}
            </button>
          }
        />

        {showForm && (
          <form onSubmit={handleCriar} className="bg-surface border border-line rounded-card shadow-token-sm p-4 mb-6 flex gap-2 flex-wrap">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do prato. Ex: Tacacá"
              aria-label="Nome do prato"
              className="flex-1 min-w-48 border border-line-strong rounded-token px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
            <button type="submit" disabled={salvando} className="btn btn-primario">
              {salvando ? 'Salvando...' : 'Cadastrar prato'}
            </button>
            {erro && (
              <p role="alert" className="w-full text-sm text-danger bg-danger-soft rounded-token px-3 py-2">
                {erro}
              </p>
            )}
          </form>
        )}

        {!loading && pratos.length > 0 && <BarraBusca valor={busca} onChange={setBusca} debounce={300} atalho placeholder="Buscar prato..." className="mb-4" />}

        {!loading && pratos.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
            <p className="font-medium text-ink">Nenhum prato cadastrado</p>
            <p className="mt-1 text-sm text-ink-muted">Clique em “Novo prato” para começar.</p>
          </div>
        ) : (
          <DataTable
            descricao="Lista de pratos"
            colunas={colunas}
            linhas={visiveis}
            chaveLinha={(p) => p.id}
            carregando={loading}
            aoClicarLinha={abrirFicha}
            classeLinha={(p) => (p.ativo ? '' : 'opacity-60')}
            ordem={ordem}
            aoMudarOrdem={setOrdem}
            pagina={pagina}
            porPagina={POR_PAGINA}
            total={pratosFiltrados.length}
            aoMudarPagina={setPagina}
            vazio={<NadaEncontrado busca={busca} />}
          />
        )}
      </div>
    </div>
  );
}
