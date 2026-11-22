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
    <div className="fixed inset-0 ui-modal-overlay flex items-center justify-center z-[60] p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-label={'Ficha técnica de ' + (ficha?.produto.nome || nomeInicial || 'prato')}
        className="ui-modal-panel w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-line-soft">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Ficha técnica</p>
            <h2 className="text-xl font-bold text-ink truncate">{ficha?.produto.nome || nomeInicial || '...'}</h2>
          </div>
          <button onClick={onFechar} className="text-xl text-ink-subtle hover:text-ink h-9 w-9 shrink-0" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {erro ? (
            <p role="alert" className="text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">{erro}</p>
          ) : !ficha ? (
            <p className="text-sm text-ink-muted py-8 text-center">Carregando...</p>
          ) : !ehPrato ? (
            <div className="bg-surface-hover rounded-lg p-4 text-sm text-ink-soft">
              <p className="font-medium text-ink">
                {ficha.produto.tipo_produto === 'bebida'
                  ? 'Bebida' + (rotuloCategoria(ficha.produto.categoria_bebida) ? ' · ' + rotuloCategoria(ficha.produto.categoria_bebida) : '')
                  : ficha.produto.tipo_produto === 'acabado'
                  ? 'Produto acabado'
                  : 'Ingrediente'}
              </p>
              <p className="mt-1 text-ink-muted">Este item é vendido pronto, por isso não tem ficha técnica (receita). A baixa de estoque é de 1 unidade por venda.</p>
              {preco > 0 && <p className="mt-2">Preço de venda: <b>{moeda(preco)}</b></p>}
            </div>
          ) : ficha.itens.length === 0 ? (
            <div className="bg-warning-soft rounded-lg p-4 text-sm text-warning">
              Este prato ainda não tem ingredientes cadastrados na ficha.
            </div>
          ) : (
            <>
              <div className="border border-line-soft rounded-lg overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-surface-hover">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Ingrediente</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Quantidade</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Em estoque</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">Custo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {ficha.itens.map((i) => {
                      const falta = i.disponivel !== null && i.disponivel < i.quantidade;
                      return (
                        <tr key={i.id}>
                          <td className="px-3 py-2.5 text-ink">{i.nome}</td>
                          <td className="px-3 py-2.5 text-right text-ink-soft">
                            {qtd(i.quantidade)} {i.unidade}
                          </td>
                          <td className={'px-3 py-2.5 text-right ' + (falta ? 'text-danger font-semibold' : 'text-ink-muted')}>
                            {i.disponivel === null ? '—' : qtd(i.disponivel) + ' ' + (i.unidadeEstoque || i.unidade)}
                            {falta && <span className="block text-xs font-normal">não dá para 1 prato</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-ink-soft">{moeda(i.quantidade * i.custo_unitario)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-surface-hover">
                    <tr>
                      <td colSpan={3} className="px-3 py-2.5 text-right font-semibold text-ink">Custo da receita</td>
                      <td className="px-3 py-2.5 text-right font-bold text-ink">{moeda(ficha.custoTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-surface-hover rounded-lg py-3">
                  <p className="text-xs text-ink-muted">Preço de venda</p>
                  <p className="text-base font-bold text-ink">{preco > 0 ? moeda(preco) : 'Não definido'}</p>
                </div>
                <div className="bg-surface-hover rounded-lg py-3">
                  <p className="text-xs text-ink-muted">Margem</p>
                  <p className={'text-base font-bold ' + (preco <= 0 ? 'text-ink-subtle' : margemPct >= 50 ? 'text-success' : margemPct >= 20 ? 'text-warning' : 'text-danger')}>
                    {preco > 0 ? margemPct.toFixed(0) + '%' : '—'}
                  </p>
                </div>
                <div className="bg-surface-hover rounded-lg py-3">
                  <p className="text-xs text-ink-muted">Lucro por prato</p>
                  <p className="text-base font-bold text-ink">{preco > 0 ? moeda(margemReais) : '—'}</p>
                </div>
              </div>
              <p className="text-xs text-ink-subtle">Margem sobre o custo dos ingredientes. A ficha completa, com custos fixos e impostos, fica em Editar receita.</p>
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-line-soft">
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
