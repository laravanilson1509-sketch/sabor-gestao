// lib/queries/bebidas.ts — categorias de bebida (alcoólicas, não alcoólicas...)

export type GrupoBebida = 'nao_alcoolica' | 'alcoolica';

export const GRUPOS_BEBIDA: Record<GrupoBebida, string> = {
  nao_alcoolica: 'Não alcoólica',
  alcoolica: 'Alcoólica',
};

export const CATEGORIAS_BEBIDA: { valor: string; rotulo: string; grupo: GrupoBebida }[] = [
  { valor: 'agua', rotulo: 'Água', grupo: 'nao_alcoolica' },
  { valor: 'refrigerante', rotulo: 'Refrigerante', grupo: 'nao_alcoolica' },
  { valor: 'suco', rotulo: 'Suco', grupo: 'nao_alcoolica' },
  { valor: 'energetico', rotulo: 'Energético e isotônico', grupo: 'nao_alcoolica' },
  { valor: 'cha_cafe', rotulo: 'Chá e café', grupo: 'nao_alcoolica' },
  { valor: 'outra_nao_alcoolica', rotulo: 'Outra não alcoólica', grupo: 'nao_alcoolica' },
  { valor: 'cerveja', rotulo: 'Cerveja e chopp', grupo: 'alcoolica' },
  { valor: 'vinho', rotulo: 'Vinho e espumante', grupo: 'alcoolica' },
  { valor: 'destilado', rotulo: 'Destilado (cachaça, whisky, vodka...)', grupo: 'alcoolica' },
  { valor: 'drink', rotulo: 'Drink e coquetel', grupo: 'alcoolica' },
  { valor: 'outra_alcoolica', rotulo: 'Outra alcoólica', grupo: 'alcoolica' },
];

export const categoriasDoGrupo = (grupo: GrupoBebida) => CATEGORIAS_BEBIDA.filter((c) => c.grupo === grupo);

export const grupoDaCategoria = (categoria: string | null | undefined): GrupoBebida | null =>
  CATEGORIAS_BEBIDA.find((c) => c.valor === categoria)?.grupo ?? null;

export const rotuloCategoria = (categoria: string | null | undefined) =>
  CATEGORIAS_BEBIDA.find((c) => c.valor === categoria)?.rotulo ?? null;

// setor de produção sugerido ao cadastrar (o gerente muda em Impressão > Setores)
export const setorSugerido = (grupo: GrupoBebida) => (grupo === 'alcoolica' ? 'Bar' : 'Bebidas');
