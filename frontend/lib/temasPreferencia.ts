// lib/temasPreferencia.ts — escolha de quais temas de data mostrar (guardada neste navegador)
//   auto  = campanhas de saúde, datas comerciais, feriados e gastronomia
//   saude = só as campanhas de saúde do mês
//   off   = sem tema por data

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { temaDoDia, type Preferencia, type TemaData } from './temasDatas';

const CHAVE = 'temas-por-data';
const EVENTO_MUDOU = 'temas-por-data:mudou';
// quem quiser abrir a janela do calendário (ex.: botão da faixa) dispara este evento
export const EVENTO_ABRIR_TEMAS = 'abrir-temas-por-data';

export function lerPreferencia(): Preferencia {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'saude' || v === 'off' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function salvarPreferencia(p: Preferencia) {
  try {
    localStorage.setItem(CHAVE, p);
  } catch {
    // sem armazenamento (aba anônima): vale só até recarregar
  }
  window.dispatchEvent(new Event(EVENTO_MUDOU));
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO_MUDOU, avisar);
  window.addEventListener('storage', avisar); // outra aba mudou
  return () => {
    window.removeEventListener(EVENTO_MUDOU, avisar);
    window.removeEventListener('storage', avisar);
  };
}

// no servidor e na primeira pintura vale "auto" (igual nos dois lados, sem erro de hidratação)
export const usePreferenciaTemas = (): Preferencia => useSyncExternalStore(assinar, lerPreferencia, () => 'auto');

// o tema de hoje; null até o navegador carregar (a data local só existe no navegador).
// Atualiza sozinho quando a aba volta a ficar visível ou a cada hora (virou o dia).
export function useTemaDoDia(): TemaData | null {
  const pref = usePreferenciaTemas();
  const [hoje, setHoje] = useState<Date | null>(null);

  useEffect(() => {
    const atualizar = () => setHoje(new Date());
    atualizar();
    const aoVoltar = () => document.visibilityState === 'visible' && atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    const relogio = setInterval(atualizar, 3600000);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      clearInterval(relogio);
    };
  }, []);

  const diaTexto = hoje?.toDateString();
  return useMemo(() => (hoje ? temaDoDia(hoje, pref) : null), [diaTexto, pref]); // eslint-disable-line react-hooks/exhaustive-deps
}

// "hoje", "amanhã", "em 5 dias" — ou nada, quando o tema já está valendo há dias
export function quandoTexto(t: Pick<TemaData, 'faltam' | 'emAndamento' | 'inicio' | 'fim' | 'tipo'>) {
  if (t.tipo === 'saude' || t.tipo === 'neutro') return null;
  if (t.faltam === 1) return 'amanhã';
  if (t.faltam > 1) return 'em ' + t.faltam + ' dias';
  const umDiaSo = t.inicio.toDateString() === t.fim.toDateString();
  return umDiaSo ? 'hoje' : 'acontecendo agora';
}
