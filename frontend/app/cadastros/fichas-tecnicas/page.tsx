'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { moeda } from '@/lib/numeros';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { type Coluna, type Ordem } from '@/components/ui/DataTable';
import { combina } from '@/lib/busca';
import { listarPratos, getFichaTecnica, calcularMargem } from '@/lib/queries/fichasTecnicas';
import ModalFichaPrato from '@/components/fichas/ModalFichaPrato';

const POR_PAGINA = 25;

type Produto = {
  id: string;
  nome: string;
  preco_venda: number | null;
  ativo: boolean;
  custoTotal?: number;
};

export default function FichasTecnicasPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [consultando, setConsultando] = useState<Produto | null>(null);
  const [ordem, setOrdem] = useState<Ordem>({ chave: 'nome', direcao: 'asc' });
  const [pagina, setPagina] = useState(1);

  // margem de cada prato (preço - custo da receita), usada na tabela e na ordenação
  const margemDe = (p: Produto) => calcularMargem(p.custoTotal || 0, Number(p.preco_venda) || 0);

  const produtosFiltrados = useMemo(() => {
    const lista = produtos.filter((p) => combina(busca, p.nome));
    if (!ordem) return lista;
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    const valor = (p: Produto) =>
      ordem.chave === 'custo' ? p.custoTotal || 0 : ordem.chave === 'preco' ? Number(p.preco_venda) || 0 : margemDe(p).margemPct;
    return [...lista].sort((a, b) =>
      ordem.chave === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) * sinal : (valor(a) - valor(b)) * sinal
    );
  }, [produtos, busca, ordem]);
  const visiveis = useMemo(() => produtosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), [produtosFiltrados, pagina]);
  useEffect(() => setPagina(1), [busca, ordem]);

  async function carregar() {
    setLoading(true);
    try {
      const lista = await listarPratos(supabase, unidadeId);
      const comCusto = await Promise.all(
        lista.map(async (p: any) => {
          const resultado = await getFichaTecnica(supabase, p.id, unidadeId);
          return { ...p, custoTotal: resultado.custoTotal };
        })
      );
      setProdutos(comCusto);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const colunas: Coluna<Produto>[] = [
    {
      chave: 'nome',
      cabecalho: 'Prato',
      ordenavel: true,
      render: (p) => (
        <button onClick={(e) => { e.stopPropagation(); setConsultando(p); }} className="text-left font-medium text-ink hover:text-accent hover:underline" title="Consultar a ficha">
          {p.nome}
        </button>
      ),
    },
    { chave: 'custo', cabecalho: 'Custo (receita)', alinhar: 'dir', ordenavel: true, render: (p) => moeda(p.custoTotal || 0) },
    {
      chave: 'preco',
      cabecalho: 'Preço de venda',
      alinhar: 'dir',
      ordenavel: true,
      render: (p) => (Number(p.preco_venda) > 0 ? moeda(Number(p.preco_venda)) : <span className="text-ink-subtle">Não definido</span>),
    },
    {
      chave: 'margem',
      cabecalho: 'Margem',
      alinhar: 'dir',
      ordenavel: true,
      render: (p) => {
        const preco = Number(p.preco_venda) || 0;
        const { margemPct, margemReais } = margemDe(p);
        const cor = margemPct >= 50 ? 'text-success' : margemPct >= 20 ? 'text-warning' : 'text-danger';
        return preco > 0 ? (
          <span className={'font-semibold ' + cor}>
            {margemPct.toFixed(0)}% <span className="font-normal text-ink-muted">({moeda(margemReais)})</span>
          </span>
        ) : (
          <span className="text-ink-subtle">—</span>
        );
      },
    },
    {
      chave: 'acoes',
      cabecalho: 'Ações',
      alinhar: 'dir',
      render: (p) => (
        <div className="flex justify-end gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setConsultando(p)} className="btn btn-secundario !px-3 !py-1.5">
            Ver ficha
          </button>
          <Link href={'/cadastros/fichas-tecnicas/' + p.id} className="btn !px-3 !py-1.5 bg-accent-soft text-accent-ink hover:bg-accent-soft-hover">
            Editar receita
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Cadastros', href: '/cadastros' }, { rotulo: 'Fichas técnicas' }]}
          voltarHref="/cadastros"
          titulo="Fichas técnicas"
          descricao="Monte a receita de cada prato para calcular o custo real e definir o preço de venda."
          acoes={
            <Link href="/cadastros/pratos" className="btn btn-secundario">
              Ver pratos
            </Link>
          }
        />

        {!loading && produtos.length > 0 && <BarraBusca valor={busca} onChange={setBusca} debounce={300} atalho placeholder="Buscar prato..." className="mb-4" />}

        {!loading && produtos.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-surface p-10 text-center">
            <p className="font-medium text-ink">Nenhum prato cadastrado</p>
            <p className="mt-1 text-sm text-ink-muted">Cadastre um prato em Cadastros → Pratos primeiro.</p>
          </div>
        ) : (
          <DataTable
            descricao="Fichas técnicas dos pratos"
            colunas={colunas}
            linhas={visiveis}
            chaveLinha={(p) => p.id}
            carregando={loading}
            aoClicarLinha={setConsultando}
            ordem={ordem}
            aoMudarOrdem={setOrdem}
            pagina={pagina}
            porPagina={POR_PAGINA}
            total={produtosFiltrados.length}
            aoMudarPagina={setPagina}
            vazio={<NadaEncontrado busca={busca} />}
          />
        )}
      </div>

      {consultando && (
        <ModalFichaPrato
          supabase={supabase}
          unidadeId={unidadeId}
          produtoId={consultando.id}
          nomeInicial={consultando.nome}
          onFechar={() => setConsultando(null)}
        />
      )}
    </div>
  );
}