'use client';

// Menu lateral: recolhível (240px ↔ 64px, lembrado no navegador) e, no celular, uma gaveta.
// No computador, passar o mouse (ou focar com o teclado) num item abre um painel flutuante:
// com atalhos para as telas internas e, no menu recolhido, também o nome do item.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Logo from '@/components/Logo';
import { MENU, type ItemMenu } from '@/lib/navegacao';

type Props = {
  atual: string; // caminho da página aberta
  recolhida: boolean;
  onAlternar: () => void;
  gavetaAberta: boolean; // celular
  onFecharGaveta: () => void;
  pendencias: number; // conferências de estoque pendentes
};

const ATRASO_ABRIR_MS = 120;
const ATRASO_FECHAR_MS = 180; // dá tempo de levar o mouse do item até o painel

function ItemDoMenu({
  item,
  atual,
  recolhida,
  pendencias,
  onNavegar,
}: {
  item: ItemMenu;
  atual: string;
  recolhida: boolean;
  pendencias: number;
  onNavegar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const raiz = useRef<HTMLLIElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();

  const ativo = atual.startsWith(item.href);
  const Icone = item.icone;
  const quantidadeFilhos = item.filhos?.length || 0;
  const temFilhos = quantidadeFilhos > 0;
  // expandido: só abre o painel se houver atalhos; recolhido: abre sempre (mostra o nome)
  const temPainel = temFilhos || recolhida;

  const abrir = useCallback(() => {
    if (!temPainel || !raiz.current) return;
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      const el = raiz.current;
      if (!el) return;
      const caixa = el.getBoundingClientRect();
      const lateral = el.closest('aside')?.getBoundingClientRect().right ?? caixa.right;
      // não deixa o painel passar da borda de baixo da tela
      const altura = 52 + Math.max(1, quantidadeFilhos) * 38;
      setPos({ top: Math.max(8, Math.min(caixa.top, window.innerHeight - altura - 8)), left: lateral });
      setAberto(true);
    }, ATRASO_ABRIR_MS);
  }, [temPainel, quantidadeFilhos]);

  const fechar = useCallback((rapido = false) => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAberto(false), rapido ? 0 : ATRASO_FECHAR_MS);
  }, []);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function aoNavegar() {
    clearTimeout(temporizador.current);
    setAberto(false);
    onNavegar();
  }

  // Esc fecha e devolve o foco ao item
  useEffect(() => {
    if (!aberto) return;
    const aoApertar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        raiz.current?.querySelector<HTMLElement>('a[data-item]')?.focus();
      }
    };
    document.addEventListener('keydown', aoApertar);
    return () => document.removeEventListener('keydown', aoApertar);
  }, [aberto]);

  // mudou de tela: fecha
  useEffect(() => setAberto(false), [atual]);

  return (
    <li
      ref={raiz}
      onMouseEnter={abrir}
      onMouseLeave={() => fechar()}
      // abre também ao focar com o teclado; fecha quando o foco sai de todo o item
      onFocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && abrir()}
      onBlur={(e) => {
        if (!raiz.current?.contains(e.relatedTarget as Node)) fechar(true);
      }}
    >
      <Link
        href={item.href}
        data-item
        onClick={aoNavegar}
        aria-label={recolhida ? item.rotulo : undefined}
        aria-current={ativo ? 'page' : undefined}
        aria-haspopup={temPainel ? 'true' : undefined}
        aria-expanded={temPainel ? aberto : undefined}
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
        {temFilhos && !recolhida && <span aria-hidden className="ml-auto hidden md:block h-1 w-1 rounded-full bg-ink-subtle opacity-60" />}
      </Link>

      {/* painel flutuante (só no computador; position:fixed para não ser cortado pela rolagem do menu) */}
      {aberto && (
        <div
          className="hidden md:block fixed pl-2"
          style={{ top: pos.top, left: pos.left, zIndex: 'var(--z-dropdown)' as unknown as number }}
          onMouseEnter={() => clearTimeout(temporizador.current)}
        >
          <div
            role="group"
            aria-label={'Atalhos de ' + item.rotulo}
            className="ui-modal-panel min-w-[13rem] p-1.5"
            style={{ animationDuration: 'var(--duration-fast)' }}
          >
            <p className="px-3 pt-1.5 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{item.rotulo}</p>
            {temFilhos ? (
              <ul>
                {item.filhos!.map((f) => {
                  const filhoAtivo = atual === f.href || atual.startsWith(f.href + '/');
                  return (
                    <li key={f.href}>
                      <Link
                        href={f.href}
                        onClick={aoNavegar}
                        aria-current={filhoAtivo ? 'page' : undefined}
                        className={
                          'ui-focus flex items-center rounded-token px-3 py-2 text-sm transition-colors ' +
                          (filhoAtivo ? 'bg-accent-soft text-accent-ink font-medium' : 'text-ink-soft hover:bg-surface-hover hover:text-ink')
                        }
                      >
                        {f.rotulo}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-3 pb-1.5 text-sm text-ink-muted">Abrir {item.rotulo}</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

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
            {MENU.map((item) => (
              <ItemDoMenu key={item.href} item={item} atual={atual} recolhida={recolhida} pendencias={pendencias} onNavegar={onFecharGaveta} />
            ))}
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
