'use client';

// Tema escuro/claro. O atributo data-theme é colocado no <html> por um script no <head>
// (veja SCRIPT_TEMA), antes da página aparecer: por isso não "pisca" ao abrir.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Tema = 'dark' | 'light';

// roda antes de tudo: escolha salva; se não houver, escuro
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

const Contexto = createContext<{ tema: Tema; alternar: () => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>('dark');

  // pega o tema que o script já aplicou
  useEffect(() => {
    const atual = document.documentElement.getAttribute('data-theme');
    if (atual === 'light' || atual === 'dark') setTema(atual);
  }, []);

  const alternar = useCallback(() => {
    setTema((anterior) => {
      const novo: Tema = anterior === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', novo);
      try {
        localStorage.setItem('theme', novo);
      } catch {
        // sem armazenamento (aba anônima): vale só nesta visita
      }
      return novo;
    });
  }, []);

  const valor = useMemo(() => ({ tema, alternar }), [tema, alternar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTema deve ser usado dentro de ThemeProvider');
  return ctx;
}
