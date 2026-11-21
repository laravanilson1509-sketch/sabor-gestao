// lib/numeros.ts — números digitados no padrão brasileiro
//
//   "4.000"     -> 4000      (ponto = separador de milhar)
//   "4.000,50"  -> 4000.5
//   "4000,5"    -> 4000.5
//   "4.5"       -> 4.5       (ponto com 1 ou 2 casas = decimal)
//   "0.250"     -> 0.25      (começa com zero: é decimal)

export function lerNumeroBR(texto: string): number {
  const limpo = String(texto ?? '').replace(/\s|R\$/g, '');
  if (!limpo) return NaN;
  let normal: string;
  if (limpo.includes(',')) {
    normal = limpo.replace(/\./g, '').replace(',', '.');
  } else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(limpo)) {
    normal = limpo.replace(/\./g, ''); // 4.000 / 1.234.567: milhar
  } else {
    normal = limpo;
  }
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : NaN;
}

// texto digitado -> "4000.5" (com ponto, pronto para parseFloat) ou "" se não for número
export function numeroCanonico(texto: string): string {
  const n = lerNumeroBR(texto);
  return Number.isNaN(n) ? '' : String(n);
}

export const formatarBR = (n: number) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
