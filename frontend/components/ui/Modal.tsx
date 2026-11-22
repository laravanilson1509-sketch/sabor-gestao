'use client';

// Janela de diálogo acessível: Esc fecha, foco fica preso dentro dela, o foco volta
// para o botão que abriu e a tela de trás não rola.

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Props = {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  tamanho?: 'sm' | 'md' | 'lg';
  rodape?: React.ReactNode;
  children: React.ReactNode;
};

const LARGURA = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };
const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ aberto, onFechar, titulo, tamanho = 'md', rodape, children }: Props) {
  const idTitulo = useId();
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    if (!aberto) return;
    const quemAbriu = document.activeElement as HTMLElement | null;
    const rolagemAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // foco inicial: primeiro campo ou botão do corpo; senão o próprio painel
    const dentro = painel.current?.querySelector<HTMLElement>('[data-foco-inicial], input, select, textarea');
    (dentro || painel.current)?.focus();

    const aoApertar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fechar.current();
        return;
      }
      if (e.key !== 'Tab' || !painel.current) return;
      const lista = Array.from(painel.current.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (lista.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoApertar);
    return () => {
      document.removeEventListener('keydown', aoApertar);
      document.body.style.overflow = rolagemAntes;
      quemAbriu?.focus?.();
    };
  }, [aberto]);

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ui-modal-overlay fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-modal)' as unknown as number }}
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={'ui-modal-panel w-full max-h-[90vh] flex flex-col outline-none ' + LARGURA[tamanho]}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
          <h2 id={idTitulo} className="text-lg font-semibold text-ink">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="ui-icon-btn h-8 w-8 -mr-2 flex items-center justify-center rounded-token text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="px-6 pb-5 overflow-y-auto text-sm text-ink-muted">{children}</div>
        {rodape && <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-line">{rodape}</div>}
      </div>
    </div>,
    document.body
  );
}
