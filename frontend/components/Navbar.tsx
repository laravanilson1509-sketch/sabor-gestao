'use client';

// Barra do topo: vidro fixo com o título da tela, botão de tema e menu do usuário.

import Link from 'next/link';
import { LogOut, Menu, X } from 'lucide-react';
import BotaoTema from '@/components/ui/BotaoTema';
import Dropdown from '@/components/ui/Dropdown';

type Props = {
  titulo: string;
  painelAberto: boolean; // uma tela está aberta por cima do início
  onAbrirMenu: () => void;
  email: string | null;
  onSair: () => void;
};

export default function Navbar({ titulo, painelAberto, onAbrirMenu, email, onSair }: Props) {
  const inicial = (email || 'U').charAt(0).toUpperCase();
  const nome = email ? email.split('@')[0] : 'Usuário';

  return (
    <header className="ui-glass sticky top-0 flex h-14 shrink-0 items-center gap-3 px-4" style={{ zIndex: 'var(--z-navbar, 40)' as unknown as number }}>
      <button
        type="button"
        onClick={onAbrirMenu}
        className="md:hidden ui-icon-btn h-9 w-9 flex items-center justify-center rounded-token text-ink-muted hover:bg-surface-hover"
        aria-label="Abrir menu"
      >
        <Menu size={20} aria-hidden />
      </button>

      <p className="flex-1 truncate text-sm font-semibold text-ink">{titulo || 'Início'}</p>

      {painelAberto && (
        <Link
          href="/"
          className="ui-focus inline-flex items-center gap-1.5 rounded-token px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          aria-label="Fechar e voltar ao início"
        >
          <X size={16} aria-hidden /> Fechar
        </Link>
      )}

      <BotaoTema />

      <Dropdown
        rotuloGatilho="Menu do usuário"
        cabecalho={
          <>
            <p className="text-sm font-medium text-ink">{nome}</p>
            {email && <p className="text-xs text-ink-muted truncate">{email}</p>}
          </>
        }
        gatilho={
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-contrast">{inicial}</span>
        }
        itens={[{ rotulo: 'Sair', icone: <LogOut size={16} aria-hidden />, onClick: onSair, perigo: true }]}
      />
    </header>
  );
}
