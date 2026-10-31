'use client';

// Recebimento com conferência: o que chegou (quantidade) e o que veio na nota
// (preço) de cada item. Ao confirmar, o banco dá entrada no estoque só do que
// chegou, atualiza o custo médio e cria a conta a pagar no Financeiro.

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { receberCompra } from '@/lib/queries/compras';
import { BTN_PRIMARY, INPUT, LABEL, lerValor, moeda, qtd } from '@/components/pdv/estilos';

type Item = { id: string; quantidade: number; unidade: string; ingredientes?: { nome: string } | null };
type Cotacao = { fornecedor_id: string; cotacoes_itens: { solicitacao_item_id: string; preco_unitario: number }[] };

type Props = {
  supabase: SupabaseClient;
  solicitacaoId: string;
  fornecedorId: string | null;
  itens: Item[];
  cotacoes: Cotacao[];
  onConcluido: () => Promise<void>;
};

const hojeISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const txt = (n: number) => String(Math.round(n * 10000) / 10000).replace('.', ',');

export default function ConferenciaRecebimento({ supabase, solicitacaoId, fornecedorId, itens, cotacoes, onConcluido }: Props) {
  const cotado = (itemId: string) =>
    cotacoes
      .find((c) => c.fornecedor_id === fornecedorId)
      ?.cotacoes_itens.find((x) => x.solicitacao_item_id === itemId)?.preco_unitario;

  const [linhas, setLinhas] = useState<Record<string, { qtd: string; preco: string; obs: string }>>(() =>
    Object.fromEntries(
      itens.map((i) => [i.id, { qtd: txt(Number(i.quantidade)), preco: cotado(i.id) !== undefined ? txt(Number(cotado(i.id))) : '', obs: '' }])
    )
  );
  const [nota, setNota] = useState('');
  const [data, setData] = useState(hojeISO());
  const [vencimento, setVencimento] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const mudar = (id: string, campo: 'qtd' | 'preco' | 'obs', valor: string) =>
    setLinhas((l) => ({ ...l, [id]: { ...l[id], [campo]: valor } }));

  const lido = (id: string) => ({ qtd: lerValor(linhas[id].qtd || '0'), preco: lerValor(linhas[id].preco || '0') });
  const total = itens.reduce((s, i) => {
    const { qtd: q, preco: p } = lido(i.id);
    return s + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    for (const i of itens) {
      const { qtd: q, preco: p } = lido(i.id);
      if (!Number.isFinite(q) || q < 0) return setErro('Quantidade inválida em ' + i.ingredientes?.nome + '.');
      if (!Number.isFinite(p) || p < 0) return setErro('Preço inválido em ' + i.ingredientes?.nome + '.');
      if (q > 0 && p === 0 && !window.confirm(i.ingredientes?.nome + ' está com preço zero. Confirmar assim mesmo?')) return;
    }
    if (itens.every((i) => lido(i.id).qtd === 0)) return setErro('Nada foi recebido. Para desistir da compra, cancele a solicitação.');
    if (vencimento && vencimento < data) return setErro('O vencimento não pode ser antes do recebimento.');

    setEnviando(true);
    try {
      await receberCompra(supabase, {
        solicitacaoId,
        numeroNota: nota,
        dataRecebimento: data,
        vencimento: vencimento || null,
        observacao,
        itens: itens.map((i) => ({
          item_id: i.id,
          qtd_recebida: lido(i.id).qtd,
          preco_unitario: lido(i.id).preco,
          observacao: linhas[i.id].obs,
        })),
      });
      await onConcluido();
    } catch (err: any) {
      setErro(err.message || 'Erro ao registrar o recebimento');
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={confirmar} className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#16252B]">Conferir o recebimento</h2>
        <p className="text-sm text-[#5B6B73]">
          Confira com a nota fiscal: o que chegou de verdade e o preço cobrado. O estoque recebe só o que chegou.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={LABEL}>Nº da nota</label>
          <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} className={INPUT + ' w-full'} placeholder="Opcional" />
        </div>
        <div>
          <label className={LABEL}>Recebido em</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={INPUT + ' w-full'} />
        </div>
        <div>
          <label className={LABEL}>Vencimento do pagamento</label>
          <input type="date" value={vencimento} min={data} onChange={(e) => setVencimento(e.target.value)} className={INPUT + ' w-full'} />
        </div>
      </div>

      <div className="space-y-3">
        {itens.map((i) => {
          const l = linhas[i.id];
          const { qtd: q, preco: p } = lido(i.id);
          const c = cotado(i.id);
          const faltou = Number.isFinite(q) && q < Number(i.quantidade);
          const sobrou = Number.isFinite(q) && q > Number(i.quantidade);
          const mudouPreco = c !== undefined && Number.isFinite(p) && Math.abs(p - Number(c)) > 0.00005;
          return (
            <div key={i.id} className="border border-[#E6ECEF] rounded-lg p-3 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-[#16252B]">{i.ingredientes?.nome}</p>
                <p className="text-xs text-[#5B6B73]">
                  pedido: {qtd(i.quantidade)} {i.unidade}
                  {c !== undefined && ' · cotado: ' + moeda(Number(c))}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-[#5B6B73] mb-1">Chegou ({i.unidade})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={l.qtd}
                    onChange={(e) => mudar(i.id, 'qtd', e.target.value)}
                    className={INPUT + ' w-full py-2'}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5B6B73] mb-1">Preço na nota (R$/{i.unidade})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={l.preco}
                    onChange={(e) => mudar(i.id, 'preco', e.target.value)}
                    className={INPUT + ' w-full py-2'}
                  />
                </div>
              </div>
              {(faltou || sobrou || mudouPreco) && (
                <div className="flex flex-wrap gap-2 text-xs font-medium">
                  {faltou && (
                    <span className="rounded-full px-2.5 py-0.5 bg-[#FFF0C7] text-[#7A5A0A]">
                      faltaram {qtd(Number(i.quantidade) - q)} {i.unidade}
                    </span>
                  )}
                  {sobrou && (
                    <span className="rounded-full px-2.5 py-0.5 bg-[#DCEEF2] text-[#0B4F5E]">
                      vieram {qtd(q - Number(i.quantidade))} {i.unidade} a mais
                    </span>
                  )}
                  {mudouPreco && (
                    <span
                      className={
                        'rounded-full px-2.5 py-0.5 ' + (p > Number(c) ? 'bg-[#FADBD6] text-[#B3261E]' : 'bg-[#D9F0E3] text-[#1E6B3F]')
                      }
                    >
                      preço {p > Number(c) ? 'acima' : 'abaixo'} do cotado ({p > Number(c) ? '+' : ''}
                      {(((p - Number(c)) / Number(c)) * 100).toFixed(1).replace('.', ',')}%)
                    </span>
                  )}
                </div>
              )}
              {(faltou || sobrou || mudouPreco) && (
                <input
                  type="text"
                  value={l.obs}
                  onChange={(e) => mudar(i.id, 'obs', e.target.value)}
                  placeholder="Observação (ex: 2 sacos avariados)"
                  className={INPUT + ' w-full py-2'}
                />
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className={LABEL}>Observação geral</label>
        <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={INPUT + ' w-full'} />
      </div>

      <div className="flex items-center justify-between border-t border-[#DCE3E7] pt-3">
        <span className="text-sm font-medium text-[#5B6B73]">Total da nota</span>
        <span className="text-xl font-bold text-[#16252B]">{moeda(total)}</span>
      </div>

      {erro && (
        <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
          {erro}
        </div>
      )}

      <button type="submit" disabled={enviando} className={BTN_PRIMARY + ' w-full'}>
        {enviando ? 'Registrando...' : 'Confirmar recebimento · entrada no estoque e conta a pagar'}
      </button>
    </form>
  );
}
