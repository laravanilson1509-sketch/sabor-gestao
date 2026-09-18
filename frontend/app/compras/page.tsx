'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarSolicitacoes, getStatusLabel } from '@/lib/queries/compras';

type Solicitacao = {
  id: string;
  status: string;
  observacao: string | null;
  criado_em: string;
  fornecedores: { nome: string } | null;
};

export default function ComprasPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [itens, setItens] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    try {
      const data = await listarSolicitacoes(supabase, unidadeId);
      setItens(data as any);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🛒 Compras</h1>
          <Link
            href="/compras/nova"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            + Nova solicitação
          </Link>
        </div>

        {loading ? (
          <p className="text-center py-12 text-gray-600">Carregando...</p>
        ) : itens.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Nenhuma solicitação de compra ainda</p>
            <p className="text-sm text-gray-500 mt-2">Clica em "+ Nova solicitação" para começar</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {itens.map((s) => {
              const statusInfo = getStatusLabel(s.status);
              const data = new Date(s.criado_em).toLocaleDateString('pt-BR');
              return (
                <Link
                  key={s.id}
                  href={`/compras/${s.id}`}
                  className="bg-white rounded-lg shadow p-4 hover:shadow-md transition flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.cor}`}>
                        {statusInfo.emoji} {statusInfo.label}
                      </span>
                      <span className="text-xs text-gray-400">{data}</span>
                    </div>
                    <p className="text-sm text-gray-900">
                      {s.fornecedores?.nome ? `Fornecedor: ${s.fornecedores.nome}` : 'Sem fornecedor definido'}
                    </p>
                    {s.observacao && <p className="text-xs text-gray-500 mt-1">{s.observacao}</p>}
                  </div>
                  <span className="text-gray-400">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}