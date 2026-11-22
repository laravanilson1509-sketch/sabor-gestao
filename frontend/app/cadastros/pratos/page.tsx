'use client';

import { useEffect, useState } from 'react';
import { moeda } from '@/lib/numeros';
import { ConteudoVoltar } from '@/components/BotaoVoltar';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import { combina } from '@/lib/busca';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarPratos } from '@/lib/queries/fichasTecnicas';
import { criarPratoSimples, deletarIngrediente } from '@/lib/queries/estoque';

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
  const pratosFiltrados = pratos.filter((p) => combina(busca, p.nome));

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

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link
            href="/cadastros"
            className="btn-voltar"
            aria-label="Voltar para Cadastros"
          >
            <ConteudoVoltar />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-ink">Pratos</h1>
            <p className="text-sm text-ink-muted">Pratos do cardápio e seus preços de venda</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="btn btn-primario"
          >
            {showForm ? 'Cancelar' : '+ Novo prato'}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCriar}
            className="bg-surface border border-line rounded-xl p-4 mb-6 flex gap-2 flex-wrap"
          >
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do prato. Ex: Tacacá"
              className="flex-1 min-w-48 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
            <button
              type="submit"
              disabled={salvando}
              className="btn btn-primario"
            >
              {salvando ? 'Salvando...' : 'Cadastrar prato'}
            </button>
            {erro && (
              <p role="alert" className="w-full text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">
                {erro}
              </p>
            )}
          </form>
        )}

        {!loading && pratos.length > 0 && (
          <BarraBusca valor={busca} onChange={setBusca} placeholder="Buscar prato..." className="mb-4" />
        )}

        {loading ? (
          <p className="text-center py-12 text-ink-muted">Carregando...</p>
        ) : pratos.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-8 text-center">
            <p className="text-ink">Nenhum prato cadastrado</p>
            <p className="text-sm text-ink-muted mt-2">Clique em + Novo prato para começar</p>
          </div>
        ) : pratosFiltrados.length === 0 ? (
          <NadaEncontrado busca={busca} />
        ) : (
          <div className="bg-surface border border-line rounded-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-hover border-b border-line">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Prato</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Preço de venda</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {pratosFiltrados.map((p) => (
                  <tr key={p.id} className={'hover:bg-surface-hover ' + (p.ativo ? '' : 'opacity-60')}>
                    <td className="px-4 py-4 text-sm font-medium text-ink">{p.nome}</td>
                    <td className="px-4 py-4 text-right text-sm text-ink-soft">
                      {Number(p.preco_venda) > 0
                        ? moeda(Number(p.preco_venda))
                        : 'Não definido'}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {p.ativo ? (
                        <span className="inline-block rounded-full bg-success-soft text-success px-3 py-1 text-xs font-semibold">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-warning-soft text-warning px-3 py-1 text-xs font-semibold">
                          Pausado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        <Link
                          href={'/cadastros/fichas-tecnicas/' + p.id}
                          className="text-sm px-3 py-1.5 rounded-lg bg-accent-soft text-accent-ink font-medium hover:bg-accent-soft-hover transition"
                        >
                          Ficha técnica
                        </Link>
                        <button onClick={() => renomear(p)} className={BTN}>
                          Renomear
                        </button>
                        <button onClick={() => alternarAtivo(p)} className={BTN}>
                          {p.ativo ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => excluir(p)}
                          className="text-sm px-3 py-1.5 rounded-lg border border-danger-line bg-surface text-danger hover:bg-danger-soft transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}