// lib/impressao/html.ts — transforma as linhas do ticket em uma página para
// imprimir no navegador (papel térmico de 58 ou 80 mm)

import { COLUNAS, type Linha } from './layout';

const escapar = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function linhaHtml(l: Linha) {
  switch (l.t) {
    case 'separador':
      return `<div class="sep${l.duplo ? ' duplo' : ''}"></div>`;
    case 'espaco':
      return '<div class="espaco"></div>';
    case 'colunas': {
      const cls = ['col', l.negrito && 'b', l.grande && 'g'].filter(Boolean).join(' ');
      return `<div class="${cls}"><span>${escapar(l.esq)}</span><span>${escapar(l.dir)}</span></div>`;
    }
    case 'texto': {
      const cls = [l.alinhar || 'esq', l.negrito && 'b', l.grande && 'g', l.inverso && 'inv']
        .filter(Boolean)
        .join(' ');
      return `<div class="${cls}">${escapar(l.texto) || '&nbsp;'}</div>`;
    }
  }
}

export function ticketParaHtml(
  linhas: Linha[],
  opcoes: { largura: 58 | 80; copias: number; fonte: 'normal' | 'grande' }
) {
  const { largura, copias, fonte } = opcoes;
  // 1 caractere da fonte padrão ≈ largura útil / colunas
  const util = largura === 58 ? 48 : 72; // mm úteis de impressão
  const fontePx = (util / COLUNAS[largura]) * 3.78 * 1.65 * (fonte === 'grande' ? 1.15 : 1);
  const corpo = linhas.map(linhaHtml).join('');
  const vias = Array.from({ length: Math.max(1, copias) }, () => `<section>${corpo}</section>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
@page { size: ${largura}mm auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: ${util}mm; margin: 0 auto; font-family: 'Courier New', ui-monospace, monospace; font-size: ${fontePx.toFixed(1)}px; line-height: 1.25; }
section { padding: 2mm 0 6mm; page-break-after: always; break-after: page; }
section:last-child { page-break-after: auto; break-after: auto; }
.esq { text-align: left; } .centro { text-align: center; } .dir { text-align: right; }
.b { font-weight: 700; }
.g { font-size: 1.45em; line-height: 1.2; }
.inv { background: #000; color: #fff; padding: 0.5mm 1mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.col { display: flex; justify-content: space-between; gap: 2mm; }
.col span:first-child { overflow-wrap: anywhere; }
.col span:last-child { white-space: nowrap; }
.sep { border-top: 1px dashed #000; margin: 1.5mm 0; }
.sep.duplo { border-top: 3px double #000; }
.espaco { height: 1.5mm; }
div { overflow-wrap: anywhere; }
</style></head><body>${vias}</body></html>`;
}
