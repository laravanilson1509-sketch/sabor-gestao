// classes usadas nas telas do PDV, da conta e da impressão

export const INPUT =
  'border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]';
export const LABEL = 'block text-sm font-medium text-[#2B3C44] mb-1';
export const BTN_PRIMARY =
  'bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition';
export const BTN_SECONDARY =
  'px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] disabled:opacity-50 transition';
export const BTN_PERIGO =
  'px-4 py-2.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] text-sm font-medium hover:bg-[#FADBD6] disabled:opacity-50 transition';
export const BTN_LINK = 'text-xs font-medium text-[#0E6B7E] hover:underline disabled:opacity-50';
export const CARTAO = 'bg-white border border-[#DCE3E7] rounded-xl';
export const TITULO_SECAO = 'text-sm font-semibold uppercase tracking-wide text-[#5B6B73] mb-3';

export const moeda = (v: number) =>
  'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// "12,50" ou "12.50" -> 12.5
export const lerValor = (texto: string) => {
  const limpo = texto.replace(/\s|R\$/g, '');
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
