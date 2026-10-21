'use client';

// Observação, restrição (alergia) e adicionais de um item da comanda.
// Antes do envio muda tudo; depois do envio só observação e restrição, e a
// produção recebe um ticket de ALTERAÇÃO.

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { alterarItem, type Adicional } from '@/lib/queries/conta';
import type { ItemPdv } from '@/lib/queries/salao';
import { terminalId } from '@/lib/impressao/terminal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, lerValor, moeda } from './estilos';

const SUGESTOES_OBS = ['Sem cebola', 'Sem sal', 'Bem passado', 'Ao ponto', 'Mal passado', 'Molho à parte', 'Sem gelo'];
const SUGESTOES_RESTRICAO = ['Alergia a camarão', 'Alergia a amendoim', 'Sem glúten', 'Sem lactose', 'Vegetariano'];

type Props = {
  supabase: SupabaseClient;
  item: ItemPdv;
  onSalvo: () => void;
  onFechar: () => void;
};

export default function EditarItem({ supabase, item, onSalvo, onFechar }: Props) {
  const enviado = item.status_cozinha !== null;
  const [observacao, setObservacao] = useState(item.observacao || '');
  const [restricao, setRestricao] = useState(item.restricao || '');
  const [adicionais, setAdicionais] = useState<Adicional[]>(item.adicionais || []);
  const [novoNome, setNovoNome] = useState('');
  const [novoValor, setNovoValor] = useState('');
  const [separarUm, setSepararUm] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const juntar = (atual: string, s: string) => (atual.trim() ? atual.trim() + ', ' + s.toLowerCase() : s);

  function incluirAdicional() {
    const nome = novoNome.trim();
    const valor = novoValor.trim() ? lerValor(novoValor) : 0;
    if (!nome) return;
    if (Number.isNaN(valor) || valor < 0) {
      setErro('Valor do adicional inválido.');
      return;
    }
    setAdicionais((a) => [...a, { nome, valor }]);
    setNovoNome('');
    setNovoValor('');
    setErro(null);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await alterarItem(supabase, {
        itemId: item.id,
        observacao,
        restricao,
        adicionais,
        separarUm,
        terminalId: terminalId(),
      });
      onSalvo();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar o item');
    }
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={salvar}
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h2 className="text-lg font-bold text-[#16252B]">
            {item.quantidade}× {item.nome}
          </h2>
          {enviado && (
            <p className="text-sm text-[#7A5A0A] bg-[#FFF0C7] rounded-lg px-3 py-2 mt-2">
              Este item já foi para a produção. A mudança sai como ALTERAÇÃO na impressora do setor.
            </p>
          )}
        </div>

        <div>
          <label className={LABEL}>Restrição / alergia</label>
          <input
            type="text"
            value={restricao}
            onChange={(e) => setRestricao(e.target.value)}
            placeholder="Sai em destaque no ticket"
            className={INPUT + ' w-full border-[#F2C2BB]'}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGESTOES_RESTRICAO.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRestricao((r) => juntar(r, s))}
                className="text-xs px-2.5 py-1 rounded-full border border-[#F2C2BB] text-[#B3261E] hover:bg-[#FADBD6]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL}>Observação</label>
          <input
            type="text"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex: sem cebola, bem passado"
            className={INPUT + ' w-full'}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SUGESTOES_OBS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setObservacao((o) => juntar(o, s))}
                className="text-xs px-2.5 py-1 rounded-full border border-[#DCE3E7] text-[#2B3C44] hover:bg-[#F1F5F7]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL}>Adicionais</label>
          {adicionais.length > 0 && (
            <ul className="mb-2 divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg">
              {adicionais.map((a, idx) => (
                <li key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-[#16252B]">+ {a.nome}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-[#5B6B73]">{a.valor > 0 ? moeda(a.valor) : 'grátis'}</span>
                    {!enviado && (
                      <button
                        type="button"
                        onClick={() => setAdicionais((l) => l.filter((_, i) => i !== idx))}
                        className="text-[#8FA0A8] hover:text-[#B3261E]"
                        aria-label={'Tirar ' + a.nome}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {enviado ? (
            <p className="text-xs text-[#8FA0A8]">
              Adicionais com preço não mudam depois do envio: cancele o item e lance de novo.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Bacon"
                className={INPUT + ' flex-1 min-w-0'}
              />
              <input
                type="text"
                inputMode="decimal"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                placeholder="R$ 0,00"
                className={INPUT + ' w-24'}
              />
              <button type="button" onClick={incluirAdicional} className={BTN_SECONDARY}>
                +
              </button>
            </div>
          )}
        </div>

        {!enviado && item.quantidade > 1 && (
          <label className="flex items-start gap-2 text-sm text-[#2B3C44]">
            <input
              type="checkbox"
              checked={separarUm}
              onChange={(e) => setSepararUm(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Só para 1 unidade (as outras {item.quantidade - 1} continuam como estão)
            </span>
          </label>
        )}

        {erro && (
          <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={salvando} className={BTN_PRIMARY + ' flex-1'}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" onClick={onFechar} className={BTN_SECONDARY + ' flex-1'}>
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
}
