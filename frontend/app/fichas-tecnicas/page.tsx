'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarProdutosAcabados, getFichaTecnica, calcularMargem } from '@/lib/queries/fichasTecnicas';

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

  async function carregar() {
    setLoading(true);
    try {
      const lista = await listarProdutosAcabados(supabase, unidadeId);
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Fichas Tecnicas</h1>
        </div>
        <p className="text-gray-600 mb-6 text-sm">
          Monte a receita de cada produto acabado para calcular o custo real e a margem de lucro.
        </p>

        {loading ? (
          <p className="text-center py-12 text-gray-600">Carregando...</p>
        ) : produtos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Nenhum produto acabado cadastrado</p>
            <p className="text-sm text-gray-500 mt-2">
              Cadastre produtos do tipo Acabado no Estoque primeiro
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Produto</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Custo (receita)</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Preco venda</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Margem</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {produtos.map((p) => {
                  const preco = Number(p.preco_venda) || 0;
                  const custo = p.custoTotal || 0;
                  const margemCalculo = calcularMargem(custo, preco);
                  const margemReais = margemCalculo.margemReais;
                  const margemPct = margemCalculo.margemPct;
                  const corMargem = margemPct >= 50 ? 'text-green-600' : margemPct >= 20 ? 'text-yellow-600' : 'text-red-600';

                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{p.nome}</td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">R$ {custo.toFixed(2)}</td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">
                        {preco > 0 ? 'R$ ' + preco.toFixed(2) : '-'}
                      </td>
                      <td className={'px-4 py-4 text-right text-sm font-semibold ' + corMargem}>
                        {preco > 0 ? margemPct.toFixed(0) + '% (R$ ' + margemReais.toFixed(2) + ')' : '-'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Link
                          href={'/fichas-tecnicas/' + p.id}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg"
                        >
                          Editar receita
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}