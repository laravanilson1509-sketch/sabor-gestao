'use client';

// Campo para valores em reais, no padrão brasileiro.
// Aceita "4.000", "4000", "4.000,50" ou "4,5" e mostra "4.000,00" ao sair do
// campo. Quem usa recebe sempre o número com ponto ("4000" ou "4000.5"), então
// parseFloat(valor) funciona direto.

import { useEffect, useState } from 'react';
import { formatarBR, lerNumeroBR, numeroCanonico } from '@/lib/numeros';

type Props = {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  id?: string;
  'aria-label'?: string;
};

export default function CampoMoeda({ value, onChange, placeholder = '0,00', className, ...resto }: Props) {
  const [texto, setTexto] = useState(() => (value !== '' && !Number.isNaN(Number(value)) ? formatarBR(Number(value)) : ''));

  // o valor mudou por fora (limpar o formulário, carregar um cadastro...)
  useEffect(() => {
    if (numeroCanonico(texto) !== value) {
      setTexto(value !== '' && !Number.isNaN(Number(value)) ? formatarBR(Number(value)) : '');
    }
  }, [value]);

  return (
    <input
      {...resto}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={texto}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        // só números, ponto e vírgula
        const digitado = e.target.value.replace(/[^\d.,]/g, '');
        setTexto(digitado);
        onChange(numeroCanonico(digitado));
      }}
      onBlur={() => {
        const n = lerNumeroBR(texto);
        if (!Number.isNaN(n)) setTexto(formatarBR(n));
      }}
    />
  );
}
