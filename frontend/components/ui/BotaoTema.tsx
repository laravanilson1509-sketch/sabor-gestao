'use client';

import { Moon, Sun } from 'lucide-react';
import { useTema } from '@/components/ThemeProvider';

export default function BotaoTema() {
  const { tema, alternar } = useTema();
  const paraClaro = tema === 'dark';
  return (
    <button
      type="button"
      onClick={alternar}
      className="ui-icon-btn h-9 w-9 flex items-center justify-center rounded-token text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors"
      aria-label={paraClaro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      title={paraClaro ? 'Tema claro' : 'Tema escuro'}
    >
      {paraClaro ? <Sun size={18} strokeWidth={1.75} aria-hidden /> : <Moon size={18} strokeWidth={1.75} aria-hidden />}
    </button>
  );
}
