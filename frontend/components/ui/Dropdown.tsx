'use client';

// Menu suspenso: clique fora e Esc fecham; setas navegam; Enter escolhe.

import { useEffect, useId, useRef, useState } from 'react';

export type ItemDropdown = { rotulo: string; icone?: React.ReactNode; onClick: () => void; perigo?: boolean };

type Props = {
  gatilho: React.ReactNode;
  rotuloGatilho: string;
  itens: ItemDropdown[];
  alinhar?: 'esq' | 'dir';
  cabecalho?: React.ReactNode;
};

export default function Dropdown({ gatilho, rotuloGatilho, itens, alinhar = 'dir', cabecalho }: Props) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        raiz.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const lista = Array.from(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []);
      if (lista.length === 0) return;
      e.preventDefault();
      const i = lista.indexOf(document.activeElement as HTMLElement);
      lista[(i + (e.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length].focus();
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', teclas);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', teclas);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        aria-label={rotuloGatilho}
        className="ui-icon-btn flex items-center gap-2 rounded-token p-1 hover:bg-surface-hover transition-colors"
      >
        {gatilho}
      </button>
      {aberto && (
        <div
          id={idMenu}
          role="menu"
          className={
            'absolute top-full mt-2 min-w-[14rem] rounded-card border border-line bg-surface-elevated shadow-token-lg p-1.5 ' +
            (alinhar === 'dir' ? 'right-0' : 'left-0')
          }
          style={{ zIndex: 'var(--z-dropdown)' as unknown as number }}
        >
          {cabecalho && <div className="px-3 py-2 border-b border-line-soft mb-1.5">{cabecalho}</div>}
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setAberto(false);
                item.onClick();
              }}
              className={
                'ui-focus flex w-full items-center gap-2 rounded-token px-3 py-2 text-left text-sm transition-colors ' +
                (item.perigo ? 'text-danger hover:bg-danger-soft' : 'text-ink-soft hover:bg-surface-hover')
              }
            >
              {item.icone}
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
