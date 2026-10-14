'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarPratos, getFichaTecnica, calcularMargem } from '@/lib/queries/fichasTecnicas';

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

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link
            href="/cadastros"
            className="h-10 w-10 flex items-center justify-center rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition"
            aria-label="Voltar para Cadastros"
          >
            ←
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#16252B]">Fichas técnicas</h1>
            <p className="text-sm text-[#5B6B73]">
              Monte a receita de cada prato para calcular o custo real e definir o preço de venda.
            </p>
          </div>
          <Link
            href="/cadastros/pratos"
            className="px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] font-medium hover:bg-[#F1F5F7] transition"
          >
            Ver pratos
          </Link>
        </div>

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : produtos.length === 0 ? (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
            <p className="text-[#16252B]">Nenhum prato cadastrado</p>
            <p className="text-sm text-[#5B6B73] mt-2">
              Cadastre um prato em Cadastros → Pratos primeiro.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#DCE3E7] rounded-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Prato</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Custo (receita)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Preço de venda</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Margem</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6ECEF]">
                {produtos.map((p) => {
                  const preco = Number(p.preco_venda) || 0;
                  const custo = p.custoTotal || 0;
                  const margemCalculo = calcularMargem(custo, preco);
                  const margemReais = margemCalculo.margemReais;
                  const margemPct = margemCalculo.margemPct;
                  const corMargem =
                    margemPct >= 50
                      ? 'text-[#1E6B3F]'
                      : margemPct >= 20
                      ? 'text-[#8A5F00]'
                      : 'text-[#B3261E]';

                  return (
                    <tr key={p.id} className="hover:bg-[#F8FAFB]">
                      <td className="px-4 py-4 text-sm font-medium text-[#16252B]">{p.nome}</td>
                      <td className="px-4 py-4 text-right text-sm text-[#2B3C44]">R$ {custo.toFixed(2)}</td>
                      <td className="px-4 py-4 text-right text-sm text-[#2B3C44]">
                        {preco > 0 ? 'R$ ' + preco.toFixed(2) : 'Não definido'}
                      </td>
                      <td className={'px-4 py-4 text-right text-sm font-semibold ' + corMargem}>
                        {preco > 0 ? margemPct.toFixed(0) + '% (R$ ' + margemReais.toFixed(2) + ')' : '-'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Link
                          href={'/cadastros/fichas-tecnicas/' + p.id}
                          className="text-sm px-3 py-1.5 rounded-lg bg-[#DCEEF2] text-[#0B4F5E] font-medium hover:bg-[#C9E3EA] transition"
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