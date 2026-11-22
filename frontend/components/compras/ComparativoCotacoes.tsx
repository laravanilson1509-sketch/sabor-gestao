'use client';

// Cotações lado a lado: um fornecedor por coluna, um item por linha.
// Destaca o menor preço de cada item e o fornecedor com o menor total.

import { moeda, qtd } from '@/components/pdv/estilos';

type Item = { id: string; quantidade: number; unidade: string; ingredientes?: { nome: string } | null };
type Cotacao = {
  id: string;
  fornecedor_id: string;
  prazo_entrega_dias: number | null;
  condicoes_pagamento: string | null;
  fornecedores?: { nome: string } | null;
  cotacoes_itens: { solicitacao_item_id: string; preco_unitario: number }[];
};

type Props = {
  itens: Item[];
  cotacoes: Cotacao[];
  processando: boolean;
  onAprovar: (fornecedorId: string) => void;
  onExcluir: (cotacaoId: string) => void;
  onRefazer: (cotacao: Cotacao) => void;
};

export default function ComparativoCotacoes({ itens, cotacoes, processando, onAprovar, onExcluir, onRefazer }: Props) {
  const preco = (c: Cotacao, itemId: string) => {
    const ci = c.cotacoes_itens.find((x) => x.solicitacao_item_id === itemId);
    return ci ? Number(ci.preco_unitario) : null;
  };

  // menor preço de cada item entre as cotações
  const menorPorItem = new Map<string, number>();
  for (const it of itens) {
    const precos = cotacoes.map((c) => preco(c, it.id)).filter((p): p is number => p !== null);
    if (precos.length > 0) menorPorItem.set(it.id, Math.min(...precos));
  }

  const totais = cotacoes.map((c) =>
    itens.reduce((soma, it) => soma + (preco(c, it.id) ?? 0) * Number(it.quantidade), 0)
  );
  const menorTotal = Math.min(...totais);
  const maiorTotal = Math.max(...totais);

  // comprar cada item de quem vende mais barato (pode ser em vários fornecedores)
  const melhorCombinacao = itens.reduce((soma, it) => soma + (menorPorItem.get(it.id) ?? 0) * Number(it.quantidade), 0);
  const economiaCombinacao = menorTotal - melhorCombinacao;

  if (cotacoes.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-line rounded-lg">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-surface-hover border-b border-line">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">Item</th>
              {cotacoes.map((c, k) => (
                <th key={c.id} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {c.fornecedores?.nome || 'Fornecedor'}
                  {totais[k] === menorTotal && cotacoes.length > 1 && (
                    <span className="block mt-0.5 normal-case tracking-normal font-semibold text-success">menor total</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {itens.map((it) => (
              <tr key={it.id}>
                <td className="px-3 py-2.5 text-ink">
                  {it.ingredientes?.nome}
                  <span className="block text-xs text-ink-subtle">
                    {qtd(it.quantidade)} {it.unidade}
                  </span>
                </td>
                {cotacoes.map((c) => {
                  const p = preco(c, it.id);
                  const melhor = p !== null && cotacoes.length > 1 && p === menorPorItem.get(it.id);
                  return (
                    <td key={c.id} className={'px-3 py-2.5 text-right ' + (melhor ? 'bg-success-soft' : '')}>
                      {p === null ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        <>
                          <span className={'font-semibold ' + (melhor ? 'text-success' : 'text-ink')}>
                            {moeda(p)}
                          </span>
                          <span className="block text-xs text-ink-muted">
                            total {moeda(p * Number(it.quantidade))}
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-surface-hover">
              <td className="px-3 py-2.5 font-semibold text-ink">Total</td>
              {cotacoes.map((c, k) => (
                <td key={c.id} className="px-3 py-2.5 text-right font-bold text-ink">
                  {moeda(totais[k])}
                  {cotacoes.length > 1 && totais[k] > menorTotal && (
                    <span className="block text-xs font-normal text-danger">+ {moeda(totais[k] - menorTotal)}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2.5 text-ink-muted">Prazo de entrega</td>
              {cotacoes.map((c) => (
                <td key={c.id} className="px-3 py-2.5 text-right text-ink-soft">
                  {c.prazo_entrega_dias === null ? '—' : c.prazo_entrega_dias === 0 ? 'No dia' : c.prazo_entrega_dias + ' dia(s)'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2.5 text-ink-muted">Pagamento</td>
              {cotacoes.map((c) => (
                <td key={c.id} className="px-3 py-2.5 text-right text-ink-soft">
                  {c.condicoes_pagamento || '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-3" />
              {cotacoes.map((c) => (
                <td key={c.id} className="px-3 py-3 text-right align-top">
                  <button
                    onClick={() => onAprovar(c.fornecedor_id)}
                    disabled={processando}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-accent bg-surface text-accent font-medium hover:bg-accent-faint disabled:opacity-50 transition"
                  >
                    Aprovar
                  </button>
                  <span className="mt-2 flex justify-end gap-3 text-xs">
                    <button onClick={() => onRefazer(c)} className="text-accent hover:underline">
                      Refazer
                    </button>
                    <button onClick={() => onExcluir(c.id)} className="text-ink-subtle hover:text-danger">
                      Excluir
                    </button>
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {cotacoes.length > 1 && maiorTotal > menorTotal && (
        <p className="text-sm text-ink-soft bg-accent-faint rounded-lg px-3 py-2">
          Escolhendo o fornecedor de menor total você economiza <b>{moeda(maiorTotal - menorTotal)}</b> em relação ao mais caro.
          {economiaCombinacao > 0.005 && (
            <>
              {' '}
              Comprando cada item de quem vende mais barato seriam mais <b>{moeda(economiaCombinacao)}</b> de economia, mas em
              mais de um fornecedor.
            </>
          )}
        </p>
      )}
    </div>
  );
}
