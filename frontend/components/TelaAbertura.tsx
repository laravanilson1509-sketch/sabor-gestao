'use client';

// Tela de abertura com a logo: aparece uma vez a cada vez que o sistema é
// aberto (por aba do navegador) e some sozinha. Toque/clique fecha na hora.

import { useEffect, useState } from 'react';
import Logo from './Logo';

const CHAVE = 'imperio:abertura-vista';
const DURACAO_MS = 2200;

export default function TelaAbertura({ ativa }: { ativa: boolean }) {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (!ativa) return;
    try {
      if (window.sessionStorage.getItem(CHAVE)) return;
      window.sessionStorage.setItem(CHAVE, '1');
    } catch {
      // sem armazenamento (aba anônima): mostra e segue
    }
    setVisivel(true);
    const t1 = setTimeout(() => setSaindo(true), DURACAO_MS);
    const t2 = setTimeout(() => setVisivel(false), DURACAO_MS + 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ativa]);

  if (!visivel) return null;

  return (
    <div
      onClick={() => {
        setSaindo(true);
        setTimeout(() => setVisivel(false), 300);
      }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-[#0A4E5C] via-[#0E6B7E] to-[#0A4E5C]"
      style={{ opacity: saindo ? 0 : 1, transition: 'opacity 0.5s ease' }}
      role="presentation"
    >
      <style>{`
        @keyframes imperio-entra { from { opacity: 0; transform: scale(0.85) translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes imperio-linha { from { width: 0; } to { width: 7rem; } }
        @media (prefers-reduced-motion: reduce) { .imperio-anim { animation: none !important; } }
      `}</style>
      <div className="imperio-anim" style={{ animation: 'imperio-entra 0.8s ease both' }}>
        <Logo tamanho={84} claro empilhado />
      </div>
      <div
        className="imperio-anim h-0.5 bg-[#E3B341] mt-6 rounded"
        style={{ animation: 'imperio-linha 1s 0.5s ease both' }}
      />
      <p
        className="imperio-anim mt-4 text-sm tracking-[0.3em] uppercase text-white/80"
        style={{ animation: 'imperio-entra 0.8s 0.6s ease both' }}
      >
        Do pedido ao lucro
      </p>
    </div>
  );
}
