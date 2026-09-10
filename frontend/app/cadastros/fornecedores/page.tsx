'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarCadastros, deletarCadastro } from '@/lib/queries/cadastros';

type Fornecedor = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cnpj_cpf: string | null;
  ativo: boolean;
};

export default function FornecedoresPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [itens, setItens] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [paraDeletar, setParaDeletar] = useState<Fornecedor | null>(null);
  const [deletando, setDeletando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const data = await listarCadastros(supabase, 'fornecedores', unidadeId);
      setItens(data as any);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function confirmarExclusao() {
    if (!paraDeletar) return;
    setDeletando(true);
    try {
      await deletarCadastro(supabase, 'fornecedores', paraDeletar.id);
      setParaDeletar(null);
      await carregar();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setDeletando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/cadastros" className="text-gray-500 hover:text-gray-700 text-xl">←</Link>
          <h1 className="text-2xl font-bold text-gray-900 flex-1">🚚 Fornecedores</h1>
          <Link
            href="/cadastros/fornecedores/cadastro"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            + Novo fornecedor
          </Link>
        </div>

        {loading ? (
          <p className="text-center py-12 text-gray-600">Carregando...</p>
        ) : itens.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Nenhum fornecedor cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Telefone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">CNPJ/CPF</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itens.map((f) => (
                  <tr key={f.id} className={`hover:bg-gray-50 ${!f.ativo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{f.telefone || '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{f.cnpj_cpf || '-'}</td>
                    <td className="px-4 py-4 text-sm">
                      {f.ativo ? '✅ Ativo' : '⏸️ Inativo'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1 justify-center">
                        <Link
                          href={`/cadastros/fornecedores/cadastro?id=${f.id}`}
                          className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded"
                        >
                          ✏️
                        </Link>
                        <button
                          onClick={() => setParaDeletar(f)}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
                        >
                          🗑️
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

      {paraDeletar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-red-700">🗑️ Excluir fornecedor?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Tem certeza que quer excluir <strong>{paraDeletar.nome}</strong>? Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmarExclusao}
                disabled={deletando}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium"
              >
                {deletando ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button
                onClick={() => setParaDeletar(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}