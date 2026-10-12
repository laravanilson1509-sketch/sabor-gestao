'use client';

import { useEffect, useState } from 'react';
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
      setErro('Ja existe um prato com esse nome.');
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
      'Excluir o prato "' + p.nome + '"? Isso apaga tambem a ficha tecnica dele. Nao pode ser desfeito.'
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/cadastros" className="text-gray-500 hover:text-gray-700 text-xl">
            {'<-'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex-1">🍽️ Pratos</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            {showForm ? 'Cancelar' : '+ Novo prato'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCriar} className="bg-white rounded-lg shadow p-4 mb-6 flex gap-2 flex-wrap">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do prato. Ex: Tacaca"
              className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={salvando}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {salvando ? 'Salvando...' : 'Cadastrar prato'}
            </button>
            {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
          </form>
        )}

        {loading ? (
          <p className="text-center py-12 text-gray-600">Carregando...</p>
        ) : pratos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Nenhum prato cadastrado</p>
            <p className="text-sm text-gray-500 mt-2">Clique em + Novo prato para comecar</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Prato</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Preco de venda</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pratos.map((p) => (
                  <tr key={p.id} className={'hover:bg-gray-50 ' + (p.ativo ? '' : 'opacity-50')}>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{p.nome}</td>
                    <td className="px-4 py-4 text-right text-sm text-gray-600">
                      {Number(p.preco_venda) > 0 ? 'R$ ' + Number(p.preco_venda).toFixed(2) : 'Nao definido'}
                    </td>
                    <td className="px-4 py-4 text-sm">{p.ativo ? 'Ativo' : 'Pausado'}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1 justify-center flex-wrap">
                        <Link
                          href={'/cadastros/fichas-tecnicas/' + p.id}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg"
                        >
                          Ficha tecnica
                        </Link>
                        <button
                          onClick={() => renomear(p)}
                          className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-3 py-1.5 rounded-lg"
                        >
                          Renomear
                        </button>
                        <button
                          onClick={() => alternarAtivo(p)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
                        >
                          {p.ativo ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => excluir(p)}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg"
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