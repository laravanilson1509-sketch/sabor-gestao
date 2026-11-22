'use client';

// Menu lateral: recolhível (240px ↔ 64px, lembrado no navegador) e, no celular, uma gaveta.

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Logo from '@/components/Logo';
import { MENU } from '@/lib/navegacao';

type Props = {
  atual: string; // caminho da página aberta
  recolhida: boolean;
  onAlternar: () => void;
  gavetaAberta: boolean; // celular
  onFecharGaveta: () => void;
  pendencias: number; // conferências de estoque pendentes
};

export default function Sidebar({ atual, recolhida, onAlternar, gavetaAberta, onFecharGaveta, pendencias }: Props) {
  return (
    <>
      {/* celular: fundo escurecido atrás da gaveta */}
      {gavetaAberta && <div className="md:hidden fixed inset-0 z-30" style={{ background: 'var(--overlay)' }} onClick={onFecharGaveta} aria-hidden />}

      <aside
        aria-label="Menu principal"
        className={
          'z-40 flex flex-col border-r border-line bg-surface ' +
          // celular: gaveta por cima; computador: fixa na lateral
          (gavetaAberta ? 'fixed inset-y-0 left-0 w-64 ' : 'hidden ') +
          'md:flex md:sticky md:top-0 md:h-screen md:shrink-0 ' +
          (recolhida ? 'md:w-16' : 'md:w-60')
        }
      >
        <div className={'flex h-14 shrink-0 items-center border-b border-line-soft ' + (recolhida ? 'md:justify-center' : 'px-4 justify-between')}>
          <Link href="/" aria-label="Início" onClick={onFecharGaveta} className="ui-focus rounded-token">
            <Logo tamanho={recolhida ? 30 : 32} mostrarNome={!recolhida} />
          </Link>
          <button type="button" onClick={onFecharGaveta} className="md:hidden ui-icon-btn h-9 w-9 flex items-center justify-center rounded-token text-ink-muted hover:bg-surface-hover" aria-label="Fechar menu">
            <X size={18} aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5">
          <ul className="flex flex-col gap-0.5">
            {MENU.map((item) => {
              const ativo = atual.startsWith(item.href);
              const Icone = item.icone;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onFecharGaveta}
                    title={recolhida ? item.rotulo : undefined}
                    aria-label={recolhida ? item.rotulo : undefined}
                    aria-current={ativo ? 'page' : undefined}
                    className={
                      'ui-focus relative flex items-center gap-3 rounded-token py-2.5 text-sm transition-colors ' +
                      (recolhida ? 'md:justify-center md:px-0 px-3 ' : 'px-3 ') +
                      (ativo ? 'bg-surface-hover text-ink font-medium' : 'text-ink-muted hover:bg-surface-hover hover:text-ink')
                    }
                  >
                    {ativo && <span aria-hidden className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" />}
                    <Icone size={18} strokeWidth={1.75} aria-hidden className={'shrink-0 ' + (ativo ? 'text-accent' : '')} />
                    <span className={recolhida ? 'md:sr-only' : ''}>{item.rotulo}</span>
                    {item.href === '/estoque' && pendencias > 0 && (
                      <span
                        className={
                          'rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning ' +
                          (recolhida ? 'md:absolute md:right-0.5 md:top-0.5 md:px-1 md:py-0 md:text-[10px] md:leading-4 ' : 'ml-auto ')
                        }
                        title="Conferências de estoque pendentes"
                      >
                        {pendencias}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden md:block shrink-0 border-t border-line-soft p-2.5">
          <button
            type="button"
            onClick={onAlternar}
            aria-label={recolhida ? 'Expandir o menu' : 'Recolher o menu'}
            title={recolhida ? 'Expandir o menu' : 'Recolher o menu'}
            className={
              'ui-focus flex w-full items-center gap-3 rounded-token py-2.5 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink ' +
              (recolhida ? 'justify-center' : 'px-3')
            }
          >
            {recolhida ? <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden /> : <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden />}
            {!recolhida && <span>Recolher menu</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
