'use client';

// Menu de três pontos de cada card da cozinha.

import { useEffect, useRef, useState } from 'react';

type Props = {
  itens: { nome: string; produtoId: string | null }[];
  temPedido: boolean; // PDV: dá para ver as impressões do pedido
  onFicha: (produtoId: string, nome: string) => void;
  onDetalhes: () => void;
  onImpressoes: () => void;
};

const ITEM =
  'w-full text-left px-3 py-2 text-sm text-ink-soft hover:bg-surface-hover rounded-lg flex items-center gap-2 transition disabled:opacity-50';

export default function MenuCartao({ itens, temPedido, onFicha, onDetalhes, onImpressoes }: Props) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const escolher = (acao: () => void) => {
    setAberto(false);
    acao();
  };

  // um prato por linha, sem repetir
  const pratos = itens.filter((i, k) => i.produtoId && itens.findIndex((x) => x.produtoId === i.produtoId) === k);

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink transition"
        aria-label="Mais opções do pedido"
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="12" cy="19" r="1.9" />
        </svg>
      </button>

      {aberto && (
        <div role="menu" className="absolute right-0 top-9 z-30 w-64 bg-surface border border-line rounded-xl shadow-lg p-1.5">
          <p className="px-3 pt-1.5 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Ficha do prato</p>
          {pratos.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-subtle">Sem ficha para consultar neste pedido</p>
          ) : (
            pratos.map((p) => (
              <button key={p.produtoId} role="menuitem" onClick={() => escolher(() => onFicha(p.produtoId!, p.nome))} className={ITEM}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-accent">
                  <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z" />
                  <path d="M8 7h6M8 11h6" />
                </svg>
                <span className="truncate">{pratos.length > 1 ? p.nome : 'Consultar ficha do prato'}</span>
              </button>
            ))
          )}

          <div className="my-1 border-t border-line-soft" />
          <button role="menuitem" onClick={() => escolher(onDetalhes)} className={ITEM}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-accent">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5l3 2" />
            </svg>
            Detalhes e tempos do pedido
          </button>
          {temPedido && (
            <button role="menuitem" onClick={() => escolher(onImpressoes)} className={ITEM}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-accent">
                <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
                <path d="M7 14h10v7H7z" />
              </svg>
              Impressões e reimpressão
            </button>
          )}
        </div>
      )}
    </div>
  );
}
