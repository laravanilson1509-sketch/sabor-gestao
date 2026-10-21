// lib/impressao/terminal.ts — identifica este computador (terminal) no navegador
//
// Cada computador/tablet ganha um nome ("Caixa 1", "Bar") em Impressão >
// Configurar. O id fica guardado no navegador e vai junto em cada ação, para
// saber de onde saiu o pedido e para qual impressora mandar.

const CHAVE_TERMINAL = 'sabor:terminal';
const CHAVE_ESTACAO = 'sabor:estacao-impressoras';

export type TerminalLocal = { id: string; nome: string };

function ler<T>(chave: string): T | null {
  try {
    const v = window.localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // navegador sem armazenamento (aba anônima): segue sem lembrar
  }
}

export const terminalAtual = () => (typeof window === 'undefined' ? null : ler<TerminalLocal>(CHAVE_TERMINAL));
export const terminalId = () => terminalAtual()?.id ?? null;
export const salvarTerminalLocal = (t: TerminalLocal | null) => gravar(CHAVE_TERMINAL, t);

// impressoras que a estação deste computador atende
export const impressorasDaEstacao = () => ler<string[]>(CHAVE_ESTACAO) || [];
export const salvarImpressorasDaEstacao = (ids: string[]) => gravar(CHAVE_ESTACAO, ids);

// chave única para cada tentativa de pagamento (evita cobrar duas vezes)
export function novaChave() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
