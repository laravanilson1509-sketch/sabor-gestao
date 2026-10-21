// lib/impressao/navegador.ts — imprime um ticket pelo navegador
//
// Usa um iframe escondido. Com o Chrome aberto em modo quiosque
// (--kiosk-printing) a impressão sai direto na impressora padrão, sem
// janela de confirmação.

import { montarTicket, type Documento } from './layout';
import { ticketParaHtml } from './html';

export type OpcoesImpressora = { largura_mm: 58 | 80; copias: number; fonte: 'normal' | 'grande' };

export function htmlDoTicket(documento: Documento, conteudo: any, impressora: OpcoesImpressora) {
  return ticketParaHtml(montarTicket(documento, conteudo), {
    largura: impressora.largura_mm,
    copias: impressora.copias,
    fonte: impressora.fonte,
  });
}

export function imprimirHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    let terminou = false;
    const limpar = () => setTimeout(() => frame.remove(), 2000);

    frame.onload = () => {
      if (terminou) return;
      terminou = true;
      try {
        const janela = frame.contentWindow;
        if (!janela) throw new Error('O navegador bloqueou a impressão');
        janela.focus();
        janela.print(); // no Chrome, só volta depois que a impressão foi enviada (ou cancelada)
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        limpar();
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
    setTimeout(() => {
      if (!terminou) {
        terminou = true;
        limpar();
        reject(new Error('O navegador não carregou o ticket a tempo'));
      }
    }, 15000);
  });
}
