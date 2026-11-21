'use client';

// Consulta da ficha técnica de um prato, só para ler (sem editar nada).
// Usada na lista de fichas e nos cards da cozinha.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getFichaParaConsulta, calcularMargem, type FichaConsulta } from '@/lib/queries/fichasTecnicas';
import { rotuloCategoria } from '@/lib/queries/bebidas';
import { moeda, qtd } from '@/components/pdv/estilos';

type Props = {
  supabase: SupabaseClient;
  unidadeId: string;
  produtoId: string;
  nomeInicial?: string;
  mostrarEditar?: boolean;
  onFechar: () => void;
};

export default function ModalFichaPrato({ supabase, unidadeId, produtoId, nomeInicial, mostrarEditar = true, onFechar }: Props) {
  const [ficha, setFicha] = useState<FichaConsulta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setFicha(null);
    setErro(null);
    getFichaParaConsulta(supabase, produtoId, unidadeId)
      .then(setFicha)
      .catch((e) => setErro(e?.message || 'Não foi possível carregar a ficha.'));
  }, [produtoId]);

  // Esc fecha
  useEffect(() => {
    const aoApertar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoApertar);
    return () => window.removeEventListener('keydown', aoApertar);
  }, []);

  const preco = Number(ficha?.produto.preco_venda) || 0;
  const { margemReais, margemPct } = calcularMargem(ficha?.custoTotal || 0, preco);
  const ehPrato = ficha?.produto.tipo_produto === 'prato';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-label={'Ficha técnica de ' + (ficha?.produto.nome || nomeInicial || 'prato')}
        className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#E6ECEF]">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ficha técnica</p>
            <h2 className="text-xl font-bold text-[#16252B] truncate">{ficha?.produto.nome || nomeInicial || '...'}</h2>
          </div>
          <button onClick={onFechar} className="text-xl text-[#8FA0A8] hover:text-[#16252B] h-9 w-9 shrink-0" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {erro ? (
            <p role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</p>
          ) : !ficha ? (
            <p className="text-sm text-[#5B6B73] py-8 text-center">Carregando...</p>
          ) : !ehPrato ? (
            <div className="bg-[#F4F7F8] rounded-lg p-4 text-sm text-[#2B3C44]">
              <p className="font-medium text-[#16252B]">
                {ficha.produto.tipo_produto === 'bebida'
                  ? 'Bebida' + (rotuloCategoria(ficha.produto.categoria_bebida) ? ' · ' + rotuloCategoria(ficha.produto.categoria_bebida) : '')
                  : ficha.produto.tipo_produto === 'acabado'
                  ? 'Produto acabado'
                  : 'Ingrediente'}
              </p>
              <p className="mt-1 text-[#5B6B73]">Este item é vendido pronto, por isso não tem ficha técnica (receita). A baixa de estoque é de 1 unidade por venda.</p>
              {preco > 0 && <p className="mt-2">Preço de venda: <b>{moeda(preco)}</b></p>}
            </div>
          ) : ficha.itens.length === 0 ? (
            <div className="bg-[#FFF0C7] rounded-lg p-4 text-sm text-[#7A5A0A]">
              Este prato ainda não tem ingredientes cadastrados na ficha.
            </div>
          ) : (
            <>
              <div className="border border-[#E6ECEF] rounded-lg overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-[#F4F7F8]">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ingrediente</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Quantidade</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Em estoque</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Custo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6ECEF]">
                    {ficha.itens.map((i) => {
                      const falta = i.disponivel !== null && i.disponivel < i.quantidade;
                      return (
                        <tr key={i.id}>
                          <td className="px-3 py-2.5 text-[#16252B]">{i.nome}</td>
                          <td className="px-3 py-2.5 text-right text-[#2B3C44]">
                            {qtd(i.quantidade)} {i.unidade}
                          </td>
                          <td className={'px-3 py-2.5 text-right ' + (falta ? 'text-[#B3261E] font-semibold' : 'text-[#5B6B73]')}>
                            {i.disponivel === null ? '—' : qtd(i.disponivel) + ' ' + (i.unidadeEstoque || i.unidade)}
                            {falta && <span className="block text-xs font-normal">não dá para 1 prato</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[#2B3C44]">{moeda(i.quantidade * i.custo_unitario)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-[#F8FAFB]">
                    <tr>
                      <td colSpan={3} className="px-3 py-2.5 text-right font-semibold text-[#16252B]">Custo da receita</td>
                      <td className="px-3 py-2.5 text-right font-bold text-[#16252B]">{moeda(ficha.custoTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#F4F7F8] rounded-lg py-3">
                  <p className="text-xs text-[#5B6B73]">Preço de venda</p>
                  <p className="text-base font-bold text-[#16252B]">{preco > 0 ? moeda(preco) : 'Não definido'}</p>
                </div>
                <div className="bg-[#F4F7F8] rounded-lg py-3">
                  <p className="text-xs text-[#5B6B73]">Margem</p>
                  <p className={'text-base font-bold ' + (preco <= 0 ? 'text-[#8FA0A8]' : margemPct >= 50 ? 'text-[#1E6B3F]' : margemPct >= 20 ? 'text-[#8A5F00]' : 'text-[#B3261E]')}>
                    {preco > 0 ? margemPct.toFixed(0) + '%' : '—'}
                  </p>
                </div>
                <div className="bg-[#F4F7F8] rounded-lg py-3">
                  <p className="text-xs text-[#5B6B73]">Lucro por prato</p>
                  <p className="text-base font-bold text-[#16252B]">{preco > 0 ? moeda(margemReais) : '—'}</p>
                </div>
              </div>
              <p className="text-xs text-[#8FA0A8]">Margem sobre o custo dos ingredientes. A ficha completa, com custos fixos e impostos, fica em Editar receita.</p>
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-[#E6ECEF]">
          {mostrarEditar && ehPrato && (
            <Link href={'/cadastros/fichas-tecnicas/' + produtoId} className="btn btn-secundario">
              Editar receita
            </Link>
          )}
          <button onClick={onFechar} className="btn btn-primario flex-1">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
