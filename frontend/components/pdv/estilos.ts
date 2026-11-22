// classes usadas nas telas do PDV, da conta e da impressão
import { lerNumeroBR, moeda } from '@/lib/numeros';

export const INPUT =
  'border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent';
export const LABEL = 'block text-sm font-medium text-ink-soft mb-1';
export const BTN_PRIMARY =
  'btn btn-primario';
export const BTN_SECONDARY =
  'btn btn-secundario';
export const BTN_PERIGO =
  'btn btn-perigo';
export const BTN_LINK = 'text-xs font-medium text-accent hover:underline disabled:opacity-50';
export const CARTAO = 'bg-surface border border-line rounded-xl';
export const TITULO_SECAO = 'text-sm font-semibold uppercase tracking-wide text-ink-muted mb-3';

export { moeda };

export const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// "12,50", "12.50" ou "1.250" (mil duzentos e cinquenta) -> número
export const lerValor = (texto: string) => lerNumeroBR(texto);
