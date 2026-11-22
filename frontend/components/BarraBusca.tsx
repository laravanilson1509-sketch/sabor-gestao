'use client';

// Campo de busca padrão das listas do sistema.
// debounce: espera a pessoa parar de digitar (ms) antes de avisar a tela.
// atalho: tecla "/" leva o cursor até o campo.

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

type Props = {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  debounce?: number;
  atalho?: boolean;
};

export default function BarraBusca({ valor, onChange, placeholder = 'Buscar...', className = '', debounce = 0, atalho = false }: Props) {
  const [texto, setTexto] = useState(valor);
  const ultimoEnviado = useRef(valor);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  const campo = useRef<HTMLInputElement>(null);

  // o valor mudou por fora (limpar filtros, por exemplo)
  useEffect(() => {
    if (valor !== ultimoEnviado.current) {
      ultimoEnviado.current = valor;
      setTexto(valor);
    }
  }, [valor]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  useEffect(() => {
    if (!atalho) return;
    const aoApertar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable);
      if (e.key === '/' && !digitando && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    window.addEventListener('keydown', aoApertar);
    return () => window.removeEventListener('keydown', aoApertar);
  }, [atalho]);

  function enviar(v: string) {
    ultimoEnviado.current = v;
    onChange(v);
  }

  function mudar(v: string) {
    setTexto(v);
    clearTimeout(temporizador.current);
    if (!debounce) return enviar(v);
    temporizador.current = setTimeout(() => enviar(v), debounce);
  }

  function limpar() {
    clearTimeout(temporizador.current);
    setTexto('');
    enviar('');
    campo.current?.focus();
  }

  return (
    <div className={'relative ' + className}>
      <Search size={16} strokeWidth={1.75} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
      <input
        ref={campo}
        type="search"
        value={texto}
        onChange={(e) => mudar(e.target.value)}
        placeholder={atalho ? placeholder + '  ( / )' : placeholder}
        aria-label={placeholder}
        className="w-full border border-line-strong rounded-token pl-10 pr-9 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {texto && (
        <button
          type="button"
          onClick={limpar}
          className="ui-icon-btn absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-ink-subtle hover:text-ink hover:bg-surface-hover"
          aria-label="Limpar busca"
        >
          <X size={14} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}

export function NadaEncontrado({ busca }: { busca: string }) {
  return (
    <div className="bg-surface border border-line rounded-card p-8 text-center">
      <p className="text-ink">Nada encontrado para “{busca}”</p>
      <p className="text-sm text-ink-muted mt-1">Confira a escrita ou tente outra palavra.</p>
    </div>
  );
}
