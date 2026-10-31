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
      <div className="overflow-x-auto border border-[#DCE3E7] rounded-lg">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Item</th>
              {cotacoes.map((c, k) => (
                <th key={c.id} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#2B3C44]">
                  {c.fornecedores?.nome || 'Fornecedor'}
                  {totais[k] === menorTotal && cotacoes.length > 1 && (
                    <span className="block mt-0.5 normal-case tracking-normal font-semibold text-[#1E6B3F]">menor total</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6ECEF]">
            {itens.map((it) => (
              <tr key={it.id}>
                <td className="px-3 py-2.5 text-[#16252B]">
                  {it.ingredientes?.nome}
                  <span className="block text-xs text-[#8FA0A8]">
                    {qtd(it.quantidade)} {it.unidade}
                  </span>
                </td>
                {cotacoes.map((c) => {
                  const p = preco(c, it.id);
                  const melhor = p !== null && cotacoes.length > 1 && p === menorPorItem.get(it.id);
                  return (
                    <td key={c.id} className={'px-3 py-2.5 text-right ' + (melhor ? 'bg-[#D9F0E3]' : '')}>
                      {p === null ? (
                        <span className="text-[#8FA0A8]">—</span>
                      ) : (
                        <>
                          <span className={'font-semibold ' + (melhor ? 'text-[#1E6B3F]' : 'text-[#16252B]')}>
                            {moeda(p)}
                          </span>
                          <span className="block text-xs text-[#5B6B73]">
                            total {moeda(p * Number(it.quantidade))}
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-[#F8FAFB]">
              <td className="px-3 py-2.5 font-semibold text-[#16252B]">Total</td>
              {cotacoes.map((c, k) => (
                <td key={c.id} className="px-3 py-2.5 text-right font-bold text-[#16252B]">
                  {moeda(totais[k])}
                  {cotacoes.length > 1 && totais[k] > menorTotal && (
                    <span className="block text-xs font-normal text-[#B3261E]">+ {moeda(totais[k] - menorTotal)}</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2.5 text-[#5B6B73]">Prazo de entrega</td>
              {cotacoes.map((c) => (
                <td key={c.id} className="px-3 py-2.5 text-right text-[#2B3C44]">
                  {c.prazo_entrega_dias === null ? '—' : c.prazo_entrega_dias === 0 ? 'No dia' : c.prazo_entrega_dias + ' dia(s)'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2.5 text-[#5B6B73]">Pagamento</td>
              {cotacoes.map((c) => (
                <td key={c.id} className="px-3 py-2.5 text-right text-[#2B3C44]">
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
                    className="w-full text-sm px-3 py-2 rounded-lg border border-[#0E6B7E] bg-white text-[#0E6B7E] font-medium hover:bg-[#F1F8FA] disabled:opacity-50 transition"
                  >
                    Aprovar
                  </button>
                  <span className="mt-2 flex justify-end gap-3 text-xs">
                    <button onClick={() => onRefazer(c)} className="text-[#0E6B7E] hover:underline">
                      Refazer
                    </button>
                    <button onClick={() => onExcluir(c.id)} className="text-[#8FA0A8] hover:text-[#B3261E]">
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
        <p className="text-sm text-[#2B3C44] bg-[#F1F8FA] rounded-lg px-3 py-2">
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
