// lib/busca.ts — busca que ignora acento e maiúscula ("acai" encontra "Açaí")

export const normalizar = (texto: unknown) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// true se TODAS as palavras da busca aparecem em algum dos textos
export function combina(busca: string, ...textos: unknown[]) {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = normalizar(textos.filter((t) => t !== null && t !== undefined).join(' '));
  return palavras.every((p) => alvo.includes(p));
}
