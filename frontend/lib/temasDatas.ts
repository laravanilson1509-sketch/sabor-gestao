// lib/temasDatas.ts — fundo do painel ligado a uma data/campanha importante do mês

export type TemaData = {
  nome: string;
  frase: string;
  cor: string; // destaque (barras, ícones)
  cor2: string; // segunda luz do fundo
  base: string; // fundo escuro
};

// campanhas de saúde e datas comemorativas de cada mês (janeiro = 0)
const TEMAS: TemaData[] = [
  { nome: 'Janeiro Branco', frase: 'Cuide da saúde mental da sua equipe', cor: '#C9D8EA', cor2: '#7C93B5', base: '#0B1018' },
  { nome: 'Fevereiro Roxo', frase: 'Conscientização sobre lúpus, Alzheimer e fibromialgia', cor: '#B98AF5', cor2: '#F2A93B', base: '#0F0A18' },
  { nome: 'Março Lilás', frase: 'Prevenção do câncer de colo do útero · Dia da Mulher', cor: '#CDA0F5', cor2: '#EE8AC0', base: '#120B17' },
  { nome: 'Abril Azul', frase: 'Conscientização sobre o autismo', cor: '#6FB1F7', cor2: '#3FC4E8', base: '#08111C' },
  { nome: 'Maio Amarelo', frase: 'Atenção no trânsito · Dia das Mães', cor: '#F5CC3D', cor2: '#F08A4B', base: '#15110A' },
  { nome: 'Junho Vermelho', frase: 'Doe sangue · Arraiá chegando!', cor: '#F27A7A', cor2: '#F5B83D', base: '#170A0B' },
  { nome: 'Julho Amarelo', frase: 'Prevenção das hepatites virais', cor: '#EDD54A', cor2: '#9BCB4A', base: '#12120A' },
  { nome: 'Agosto Dourado', frase: 'Incentivo à amamentação · Dia dos Pais', cor: '#E8BE5A', cor2: '#C9822E', base: '#14100A' },
  { nome: 'Setembro Amarelo', frase: 'Prevenção ao suicídio — falar é a melhor solução', cor: '#F5CC3D', cor2: '#E8A93B', base: '#14110A' },
  { nome: 'Outubro Rosa', frase: 'Prevenção do câncer de mama — toque, olhe, cuide', cor: '#F27BB5', cor2: '#C04A8C', base: '#170A12' },
  { nome: 'Novembro Azul', frase: 'Prevenção do câncer de próstata', cor: '#6FA8F7', cor2: '#2F6BDB', base: '#080E1C' },
  { nome: 'Dezembro Vermelho', frase: 'Prevenção ao HIV · Boas festas!', cor: '#F07070', cor2: '#3FB57A', base: '#150A0A' },
];

export function temaDoDia(d: Date = new Date()): TemaData {
  return TEMAS[d.getMonth()];
}
