// lib/temasDatas.ts — calendário inteligente de temas
//
// Descobre sozinho qual data importa hoje: campanhas de saúde do mês, datas comerciais
// (Dia das Mães, Natal...), feriados e dias da gastronomia. Cada data pode aparecer alguns
// dias ANTES (antecedência) e, se várias valem ao mesmo tempo, vence a de maior prioridade.
// As datas móveis (Páscoa, Carnaval, Dia das Mães, Dia dos Pais, Black Friday) são calculadas
// para qualquer ano.

export type TipoEvento = 'saude' | 'comercial' | 'feriado' | 'gastronomia';
export type IconeTema =
  | 'laco' | 'presente' | 'coracao' | 'arvore' | 'ovo' | 'festa' | 'chama'
  | 'pizza' | 'sanduiche' | 'bandeira' | 'estrela' | 'etiqueta' | 'maos' | 'sol';
export type Preferencia = 'auto' | 'saude' | 'off'; // todas as datas | só campanhas de saúde | desligado

type Evento = {
  id: string;
  nome: string;
  frase: string;
  tipo: TipoEvento;
  icone: IconeTema;
  cor: string; // destaque (barras, ícones)
  cor2: string; // segunda cor (faixa, luz do fundo)
  base: string; // fundo escuro do painel financeiro
  prioridade: number; // maior vence quando as datas se sobrepõem
  antecedencia: number; // quantos dias antes o tema já aparece
  periodo: (ano: number) => { inicio: Date; fim: Date }; // dias do evento (fim incluso)
};

export type TemaData = {
  id: string;
  nome: string;
  frase: string;
  cor: string;
  cor2: string;
  base: string;
  tipo: TipoEvento | 'neutro';
  icone: IconeTema;
  inicio: Date;
  fim: Date;
  faltam: number; // dias até começar (0 = já começou ou é hoje)
  emAndamento: boolean;
  neutro: boolean; // sem tema (preferência desligada)
};

// ---------- datas ----------

const dia = (ano: number, mes1a12: number, d: number) => new Date(ano, mes1a12 - 1, d);
const somar = (d: Date, dias: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
// número de dias (sem horário de verão atrapalhar)
const numeroDoDia = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

// n-ésimo dia da semana do mês (diaSemana: 0 = domingo)
function nesimo(ano: number, mes1a12: number, diaSemana: number, n: number) {
  const primeiro = dia(ano, mes1a12, 1);
  const deslocamento = (diaSemana - primeiro.getDay() + 7) % 7;
  return dia(ano, mes1a12, 1 + deslocamento + (n - 1) * 7);
}

// domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
export function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), d2 = ((h + l - 7 * m + 114) % 31) + 1;
  return dia(ano, mes, d2);
}

const umDia = (data: (ano: number) => Date) => (ano: number) => {
  const d = data(ano);
  return { inicio: d, fim: d };
};

const sextaBlackFriday = (ano: number) => somar(nesimo(ano, 11, 4, 4), 1); // dia seguinte à 4ª quinta de novembro

// ---------- campanhas de saúde (o mês inteiro; aparecem 4 dias antes da virada) ----------

const CAMPANHAS_MES: { mes: number; nome: string; frase: string; cor: string; cor2: string; base: string }[] = [
  { mes: 1, nome: 'Janeiro Branco', frase: 'Cuide da saúde mental da sua equipe', cor: '#C9D8EA', cor2: '#7C93B5', base: '#0B1018' },
  { mes: 2, nome: 'Fevereiro Roxo', frase: 'Conscientização sobre lúpus, Alzheimer e fibromialgia', cor: '#B98AF5', cor2: '#F2A93B', base: '#0F0A18' },
  { mes: 3, nome: 'Março Lilás', frase: 'Prevenção do câncer de colo do útero · Dia da Mulher', cor: '#CDA0F5', cor2: '#EE8AC0', base: '#120B17' },
  { mes: 4, nome: 'Abril Azul', frase: 'Conscientização sobre o autismo', cor: '#6FB1F7', cor2: '#3FC4E8', base: '#08111C' },
  { mes: 5, nome: 'Maio Amarelo', frase: 'Atenção no trânsito', cor: '#F5CC3D', cor2: '#F08A4B', base: '#15110A' },
  { mes: 6, nome: 'Junho Vermelho', frase: 'Doe sangue', cor: '#F27A7A', cor2: '#F5B83D', base: '#170A0B' },
  { mes: 7, nome: 'Julho Amarelo', frase: 'Prevenção das hepatites virais', cor: '#EDD54A', cor2: '#9BCB4A', base: '#12120A' },
  { mes: 8, nome: 'Agosto Dourado', frase: 'Incentivo à amamentação', cor: '#E8BE5A', cor2: '#C9822E', base: '#14100A' },
  { mes: 9, nome: 'Setembro Amarelo', frase: 'Prevenção ao suicídio — falar é a melhor solução', cor: '#F5CC3D', cor2: '#E8A93B', base: '#14110A' },
  { mes: 10, nome: 'Outubro Rosa', frase: 'Prevenção do câncer de mama — toque, olhe, cuide', cor: '#F27BB5', cor2: '#C04A8C', base: '#170A12' },
  { mes: 11, nome: 'Novembro Azul', frase: 'Prevenção do câncer de próstata', cor: '#6FA8F7', cor2: '#2F6BDB', base: '#080E1C' },
  { mes: 12, nome: 'Dezembro Vermelho', frase: 'Prevenção ao HIV', cor: '#F07070', cor2: '#3FB57A', base: '#150A0A' },
];

const ANTECEDENCIA_CAMPANHA = 4;

const DA_SAUDE: Evento[] = CAMPANHAS_MES.map((c) => ({
  id: 'saude-' + c.mes,
  nome: c.nome,
  frase: c.frase,
  tipo: 'saude',
  icone: 'laco',
  cor: c.cor,
  cor2: c.cor2,
  base: c.base,
  prioridade: 0,
  antecedencia: ANTECEDENCIA_CAMPANHA,
  // o mês acaba 4 dias antes da virada, para a campanha seguinte já aparecer nesses dias
  periodo: (ano) => ({ inicio: dia(ano, c.mes, 1), fim: dia(ano, c.mes + 1, 0 - ANTECEDENCIA_CAMPANHA) }),
}));

// ---------- datas comerciais, feriados e gastronomia ----------

const feriado = (id: string, nome: string, mes: number, d: number, cor: string, cor2: string, base: string): Evento => ({
  id, nome, tipo: 'feriado', icone: 'bandeira', cor, cor2, base,
  frase: 'Feriado nacional — confira o horário de funcionamento e a escala da equipe.',
  prioridade: 4, antecedencia: 0, periodo: umDia((ano) => dia(ano, mes, d)),
});

const OUTROS: Evento[] = [
  {
    id: 'ano-novo', nome: 'Ano Novo', tipo: 'comercial', icone: 'estrela',
    frase: 'Feliz Ano Novo! Que venham grandes resultados.',
    cor: '#F5D76E', cor2: '#C99A1E', base: '#100E08', prioridade: 3, antecedencia: 4,
    periodo: (ano) => ({ inicio: dia(ano, 12, 31), fim: dia(ano + 1, 1, 1) }),
  },
  {
    id: 'carnaval', nome: 'Carnaval', tipo: 'comercial', icone: 'festa',
    frase: 'Carnaval: o movimento muda — confira o estoque e a escala.',
    cor: '#FFD23F', cor2: '#7B2CBF', base: '#120A1C', prioridade: 3, antecedencia: 3,
    // de sexta até terça (47 dias antes da Páscoa)
    periodo: (ano) => ({ inicio: somar(pascoa(ano), -51), fim: somar(pascoa(ano), -47) }),
  },
  { ...feriado('sexta-santa', 'Sexta-feira Santa', 1, 1, '#B0BEC5', '#546E7A', '#0B1013'), periodo: umDia((ano) => somar(pascoa(ano), -2)) },
  {
    id: 'pascoa', nome: 'Páscoa', tipo: 'comercial', icone: 'ovo',
    frase: 'Feliz Páscoa! Que tal um cardápio especial?',
    cor: '#E8B27D', cor2: '#8B5E3C', base: '#140D08', prioridade: 3, antecedencia: 14,
    periodo: umDia((ano) => pascoa(ano)),
  },
  feriado('tiradentes', 'Tiradentes', 4, 21, '#4CD07D', '#1E8E3E', '#06130C'),
  feriado('trabalho', 'Dia do Trabalho', 5, 1, '#4CD07D', '#1E8E3E', '#06130C'),
  {
    id: 'maes', nome: 'Dia das Mães', tipo: 'comercial', icone: 'coracao',
    frase: 'Dia das Mães: um dos dias mais movimentados — prepare estoque e equipe.',
    cor: '#F48FB1', cor2: '#C2185B', base: '#16080E', prioridade: 3, antecedencia: 10,
    periodo: umDia((ano) => nesimo(ano, 5, 0, 2)), // 2º domingo de maio
  },
  {
    id: 'hamburguer', nome: 'Dia do Hambúrguer', tipo: 'gastronomia', icone: 'sanduiche',
    frase: 'Dia do Hambúrguer: hora de destacar o lanche da casa.',
    cor: '#FFB74D', cor2: '#D35400', base: '#150D06', prioridade: 2, antecedencia: 3,
    periodo: umDia((ano) => dia(ano, 5, 28)),
  },
  {
    id: 'namorados', nome: 'Dia dos Namorados', tipo: 'comercial', icone: 'coracao',
    frase: 'Dia dos Namorados: mesas para dois e cardápio especial.',
    cor: '#FF6B81', cor2: '#C0392B', base: '#170A0C', prioridade: 3, antecedencia: 7,
    periodo: umDia((ano) => dia(ano, 6, 12)),
  },
  {
    id: 'junina', nome: 'Festa Junina', tipo: 'comercial', icone: 'chama',
    frase: 'Arraiá chegando! Pratos juninos fazem sucesso.',
    cor: '#F5B83D', cor2: '#D35400', base: '#150E06', prioridade: 2, antecedencia: 0,
    periodo: (ano) => ({ inicio: dia(ano, 6, 13), fim: dia(ano, 6, 29) }),
  },
  {
    id: 'pizza', nome: 'Dia da Pizza', tipo: 'gastronomia', icone: 'pizza',
    frase: 'Dia da Pizza: bom dia para uma promoção.',
    cor: '#FF7043', cor2: '#C0392B', base: '#160B07', prioridade: 2, antecedencia: 3,
    periodo: umDia((ano) => dia(ano, 7, 10)),
  },
  {
    id: 'pais', nome: 'Dia dos Pais', tipo: 'comercial', icone: 'maos',
    frase: 'Dia dos Pais: reservas e casa cheia.',
    cor: '#6FA8F7', cor2: '#1F5FBF', base: '#080E1C', prioridade: 3, antecedencia: 10,
    periodo: umDia((ano) => nesimo(ano, 8, 0, 2)), // 2º domingo de agosto
  },
  feriado('independencia', 'Independência do Brasil', 9, 7, '#4CD07D', '#1E8E3E', '#06130C'),
  {
    id: 'cliente', nome: 'Dia do Cliente', tipo: 'comercial', icone: 'presente',
    frase: 'Dia do Cliente: agradeça a quem faz o negócio acontecer.',
    cor: '#4FD1C5', cor2: '#0E8C80', base: '#06130F', prioridade: 3, antecedencia: 3,
    periodo: umDia((ano) => dia(ano, 9, 15)),
  },
  {
    id: 'criancas', nome: 'Dia das Crianças', tipo: 'comercial', icone: 'presente',
    frase: 'Dia das Crianças: combo kids e sobremesas.',
    cor: '#FFD166', cor2: '#EF476F', base: '#150A12', prioridade: 3, antecedencia: 7,
    periodo: umDia((ano) => dia(ano, 10, 12)),
  },
  // no mesmo dia do Dia das Crianças, que pesa mais para um restaurante
  { ...feriado('aparecida', 'Nossa Senhora Aparecida', 10, 12, '#4CD07D', '#1E8E3E', '#06130C'), prioridade: 2 },
  feriado('finados', 'Finados', 11, 2, '#B0BEC5', '#546E7A', '#0B1013'),
  feriado('republica', 'Proclamação da República', 11, 15, '#4CD07D', '#1E8E3E', '#06130C'),
  feriado('consciencia', 'Dia da Consciência Negra', 11, 20, '#F5B83D', '#B8860B', '#150F05'),
  {
    id: 'black-friday', nome: 'Black Friday', tipo: 'comercial', icone: 'etiqueta',
    frase: 'Black Friday: promoções e movimento — prepare-se.',
    cor: '#FFC107', cor2: '#1B1B1B', base: '#0A0A0A', prioridade: 3, antecedencia: 0,
    // da segunda-feira da semana até a Cyber Monday
    periodo: (ano) => ({ inicio: somar(sextaBlackFriday(ano), -4), fim: somar(sextaBlackFriday(ano), 3) }),
  },
  {
    id: 'natal', nome: 'Natal', tipo: 'comercial', icone: 'arvore',
    frase: 'Feliz Natal! Ceia e encomendas: confira estoque e prazos.',
    cor: '#EF5350', cor2: '#1B7F4A', base: '#0B140E', prioridade: 3, antecedencia: 0,
    periodo: (ano) => ({ inicio: dia(ano, 12, 10), fim: dia(ano, 12, 26) }),
  },
];

const EVENTOS: Evento[] = [...DA_SAUDE, ...OUTROS];

export const TEMA_NEUTRO: Omit<TemaData, 'inicio' | 'fim'> = {
  id: 'neutro', nome: 'FoodFlow', frase: 'Do pedido ao lucro', cor: '#5CB8C8', cor2: '#2F7F94', base: '#081014',
  tipo: 'neutro', icone: 'sol', faltam: 0, emAndamento: true, neutro: true,
};

function usaEvento(e: Evento, pref: Preferencia) {
  return pref === 'auto' || (pref === 'saude' && e.tipo === 'saude');
}

// o tema que vale numa data (e, se várias valem, o de maior prioridade)
export function temaDoDia(d: Date = new Date(), pref: Preferencia = 'auto'): TemaData {
  const hoje = numeroDoDia(d);
  let melhor: { e: Evento; ini: number; inicio: Date; fim: Date } | null = null;

  if (pref !== 'off') {
    for (const e of EVENTOS) {
      if (!usaEvento(e, pref)) continue;
      // olha o ano anterior e o seguinte também: Ano Novo e as campanhas de janeiro cruzam a virada
      for (const ano of [d.getFullYear() - 1, d.getFullYear(), d.getFullYear() + 1]) {
        const p = e.periodo(ano);
        const ini = numeroDoDia(p.inicio);
        const fim = numeroDoDia(p.fim);
        if (hoje < ini - e.antecedencia || hoje > fim) continue;

        let venceu = !melhor || e.prioridade > melhor.e.prioridade;
        if (melhor && e.prioridade === melhor.e.prioridade) {
          // empate: vale o que já começou (o mais recente); se nenhum começou, o que começa primeiro
          const jaComecou = hoje >= ini;
          const outroJaComecou = hoje >= melhor.ini;
          venceu = jaComecou === outroJaComecou ? (jaComecou ? ini > melhor.ini : ini < melhor.ini) : jaComecou;
        }
        if (venceu) melhor = { e, ini, inicio: p.inicio, fim: p.fim };
      }
    }
  }

  if (!melhor) return { ...TEMA_NEUTRO, inicio: d, fim: d };

  const { e, ini, inicio, fim } = melhor;
  return {
    id: e.id, nome: e.nome, frase: e.frase, cor: e.cor, cor2: e.cor2, base: e.base, tipo: e.tipo, icone: e.icone,
    inicio, fim,
    faltam: Math.max(0, ini - hoje),
    emAndamento: hoje >= ini,
    neutro: false,
  };
}

// próximas datas (para mostrar o que vem por aí); as campanhas de saúde ficam de fora, pois são mensais
export type ProximaData = { id: string; nome: string; tipo: TipoEvento; cor: string; cor2: string; inicio: Date; faltam: number };

export function proximasDatas(d: Date = new Date(), quantidade = 8, diasAFrente = 150): ProximaData[] {
  const hoje = numeroDoDia(d);
  const lista: ProximaData[] = [];
  for (const e of EVENTOS) {
    if (e.tipo === 'saude') continue;
    for (const ano of [d.getFullYear(), d.getFullYear() + 1]) {
      const p = e.periodo(ano);
      const ini = numeroDoDia(p.inicio);
      const fim = numeroDoDia(p.fim);
      if (fim < hoje || ini - hoje > diasAFrente) continue;
      lista.push({ id: e.id + '-' + ano, nome: e.nome, tipo: e.tipo, cor: e.cor, cor2: e.cor2, inicio: p.inicio, faltam: Math.max(0, ini - hoje) });
    }
  }
  return lista.sort((a, b) => a.faltam - b.faltam || a.nome.localeCompare(b.nome)).slice(0, quantidade);
}

// texto branco ou escuro (#16252B), o que tiver mais contraste sobre a cor de fundo
export function corTextoSobre(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const comBranco = 1.05 / (luz + 0.05);
  const comEscuro = (luz + 0.05) / 0.0655; // #16252B tem luminância ~0,0155
  return comBranco >= comEscuro ? '#ffffff' : '#16252B';
}
