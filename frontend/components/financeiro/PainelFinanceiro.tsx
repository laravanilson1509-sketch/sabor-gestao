'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Percent,
  PiggyBank,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  carregarPendencias,
  carregarResumo,
  montarPeriodo,
  periodoAnterior,
  type Fatia,
  type Periodo,
  type Resumo,
  type TipoPeriodo,
} from '@/lib/queries/dashboardFinanceiro';
import { CATEGORIAS, dataLocal, formatarReais, hojeISO } from '@/lib/queries/financeiroContas';
import { rotuloForma } from '@/lib/queries/caixa';
import { temaDoDia } from '@/lib/temasDatas';

type Pendencias = Awaited<ReturnType<typeof carregarPendencias>>;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const vidro = 'bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]';
const campo =
  'bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-white/30';

const pct = (v: number | null) => (v === null ? '—' : v.toFixed(1).replace('.', ',') + '%');
const reaisCurto = (v: number) =>
  v >= 1000 ? 'R$ ' + (v / 1000).toFixed(1).replace('.', ',') + ' mil' : formatarReais(v);

function rotuloPeriodo(tipo: TipoPeriodo, p: Periodo) {
  const i = p.inicio;
  if (tipo === 'dia') return i.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  if (tipo === 'mes') return MESES[i.getMonth()] + ' de ' + i.getFullYear();
  if (tipo === 'ano') return String(i.getFullYear());
  const ultimo = new Date(p.fim.getFullYear(), p.fim.getMonth(), p.fim.getDate() - 1);
  return i.toLocaleDateString('pt-BR') + ' a ' + ultimo.toLocaleDateString('pt-BR');
}

// arredonda o topo do eixo para um número "bonito" (100, 250, 500, 1000...)
function topoBonito(max: number) {
  if (max <= 0) return 100;
  const base = Math.pow(10, Math.floor(Math.log10(max)));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * base >= max) return f * base;
  return 10 * base;
}

// ---------- peças visuais ----------

function Variacao({ atual, anterior, inverter }: { atual: number; anterior: number; inverter?: boolean }) {
  if (anterior === 0) return <span className="text-xs text-white/50">sem base de comparação</span>;
  const delta = ((atual - anterior) / Math.abs(anterior)) * 100;
  const subiu = delta >= 0;
  const bom = inverter ? !subiu : subiu;
  const Icone = subiu ? TrendingUp : TrendingDown;
  return (
    <span className={'inline-flex items-center gap-1 text-xs font-medium ' + (bom ? 'text-emerald-300' : 'text-rose-300')}>
      <Icone size={14} aria-hidden />
      {(subiu ? '+' : '') + delta.toFixed(1).replace('.', ',')}%
      <span className="text-white/50 font-normal">vs. anterior</span>
    </span>
  );
}

function CartaoIndicador({
  icone: Icone,
  titulo,
  valor,
  rodape,
  cor,
}: {
  icone: typeof Wallet;
  titulo: string;
  valor: string;
  rodape: React.ReactNode;
  cor: string;
}) {
  return (
    <div className={vidro + ' p-4 space-y-2'}>
      <div className="flex items-center gap-2 text-white/70 text-xs">
        <span className="p-1.5 rounded-lg bg-white/10" style={{ color: cor }}>
          <Icone size={16} aria-hidden />
        </span>
        {titulo}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{valor}</p>
      <div className="min-h-[1rem]">{rodape}</div>
    </div>
  );
}

function GraficoBarras({
  dados,
  cor,
}: {
  dados: { chave: string; rotulo: string; valor: number; quantidade: number }[];
  cor: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const topo = topoBonito(Math.max(...dados.map((d) => d.valor), 0));
  // mostra no máximo ~12 rótulos no eixo para não encavalar
  const passo = Math.max(1, Math.ceil(dados.length / 12));
  const temVenda = dados.some((d) => d.valor > 0);

  return (
    <div className="relative">
      <div className="flex">
        <div className="flex flex-col justify-between h-56 pr-2 text-[10px] text-white/45 text-right w-14 shrink-0">
          <span>{reaisCurto(topo)}</span>
          <span>{reaisCurto(topo / 2)}</span>
          <span>R$ 0</span>
        </div>
        <div className="relative flex-1 h-56" onMouseLeave={() => setAtivo(null)}>
          {[0, 50, 100].map((y) => (
            <div key={y} className="absolute left-0 right-0 border-t border-white/10" style={{ top: y + '%' }} />
          ))}
          {!temVenda && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
              Nenhuma venda neste período
            </p>
          )}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {dados.map((d, i) => (
              <button
                key={d.chave}
                type="button"
                aria-label={`${d.rotulo}: ${formatarReais(d.valor)}`}
                onMouseEnter={() => setAtivo(i)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                className="relative flex-1 h-full flex items-end justify-center focus:outline-none"
              >
                <span
                  className="block w-full max-w-[28px] rounded-t-[4px] transition-opacity"
                  style={{
                    height: d.valor > 0 ? Math.max(2, (d.valor / topo) * 100) + '%' : 0,
                    background: `linear-gradient(to top, ${cor}99, ${cor})`,
                    opacity: ativo === null || ativo === i ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
          </div>
          {ativo !== null && (
            <div
              className="absolute -top-2 z-10 -translate-x-1/2 -translate-y-full pointer-events-none bg-[#0B0F14]/90 border border-white/15 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap shadow-lg"
              style={{ left: ((ativo + 0.5) / dados.length) * 100 + '%' }}
            >
              <p className="text-white/60">{dados[ativo].rotulo}</p>
              <p className="font-bold">{formatarReais(dados[ativo].valor)}</p>
              <p className="text-white/60">{dados[ativo].quantidade} pedido(s)</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex ml-14 mt-1 text-[10px] text-white/45">
        {dados.map((d, i) => (
          <span key={d.chave} className="flex-1 text-center overflow-visible whitespace-nowrap">
            {i % passo === 0 ? d.rotulo : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function ListaBarras({
  titulo,
  fatias,
  rotulo,
  cor,
  mostrarQuantidade,
  vazio,
}: {
  titulo: string;
  fatias: Fatia[];
  rotulo: (chave: string) => string;
  cor: string;
  mostrarQuantidade?: string;
  vazio: string;
}) {
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  const maior = Math.max(...fatias.map((f) => f.valor), 0);
  return (
    <div className={vidro + ' p-5 space-y-3'}>
      <h3 className="text-sm font-semibold text-white">{titulo}</h3>
      {fatias.length === 0 ? (
        <p className="text-sm text-white/50">{vazio}</p>
      ) : (
        <ul className="space-y-3">
          {fatias.map((f) => (
            <li key={f.chave} title={`${rotulo(f.chave)}: ${formatarReais(f.valor)}`}>
              <div className="flex justify-between gap-2 text-xs mb-1">
                <span className="text-white/80 truncate">
                  {rotulo(f.chave)}
                  {mostrarQuantidade && <span className="text-white/45"> · {f.quantidade} {mostrarQuantidade}</span>}
                </span>
                <span className="text-white whitespace-nowrap">
                  {formatarReais(f.valor)}
                  <span className="text-white/45"> · {total > 0 ? Math.round((f.valor / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: (maior > 0 ? (f.valor / maior) * 100 : 0) + '%', background: cor }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- painel ----------

export default function PainelFinanceiro() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;
  const tema = temaDoDia();
  const hoje = hojeISO();

  const [tipo, setTipo] = useState<TipoPeriodo>('mes');
  const [refDia, setRefDia] = useState(hoje);
  const [refMes, setRefMes] = useState(hoje.slice(0, 7));
  const [refAno, setRefAno] = useState(hoje.slice(0, 4));
  const [de, setDe] = useState(hoje.slice(0, 8) + '01');
  const [ate, setAte] = useState(hoje);

  const [atual, setAtual] = useState<Resumo | null>(null);
  const [anterior, setAnterior] = useState<Resumo | null>(null);
  const [pendencias, setPendencias] = useState<Pendencias | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const pedidoAtual = useRef(0);

  const periodo = useMemo(() => {
    if (tipo === 'dia') return montarPeriodo('dia', refDia);
    if (tipo === 'mes') return montarPeriodo('mes', refMes);
    if (tipo === 'ano') return montarPeriodo('ano', refAno);
    return montarPeriodo('periodo', de, ate < de ? de : ate);
  }, [tipo, refDia, refMes, refAno, de, ate]);
  const anteriorPeriodo = useMemo(() => periodoAnterior(tipo, periodo), [tipo, periodo]);

  useEffect(() => {
    carregarPendencias(supabase, unidadeId).then(setPendencias).catch(() => setPendencias(null));
  }, []);

  useEffect(() => {
    // se o usuário trocar de período rápido, só a última busca vale
    const id = ++pedidoAtual.current;
    setLoading(true);
    Promise.all([
      carregarResumo(supabase, unidadeId, periodo, true),
      carregarResumo(supabase, unidadeId, anteriorPeriodo, false),
    ])
      .then(([a, b]) => {
        if (id !== pedidoAtual.current) return;
        setAtual(a);
        setAnterior(b);
        setErro(null);
      })
      .catch(() => id === pedidoAtual.current && setErro('Erro ao carregar o painel'))
      .finally(() => id === pedidoAtual.current && setLoading(false));
  }, [periodo, anteriorPeriodo]);

  function andar(passo: number) {
    if (tipo === 'dia') {
      const [a, m, d] = refDia.split('-').map(Number);
      setRefDia(dataLocal(new Date(a, m - 1, d + passo)));
    } else if (tipo === 'mes') {
      const [a, m] = refMes.split('-').map(Number);
      setRefMes(dataLocal(new Date(a, m - 1 + passo, 1)).slice(0, 7));
    } else if (tipo === 'ano') {
      setRefAno(String(Number(refAno) + passo));
    }
  }

  // ponto de equilíbrio: quanto precisa vender para pagar os custos fixos do período
  const diasPeriodo = Math.round((periodo.fim.getTime() - periodo.inicio.getTime()) / 86400000);
  const fatorFixo = tipo === 'mes' ? 1 : tipo === 'ano' ? 12 : diasPeriodo / 30.44;
  const custoFixoPeriodo = (pendencias?.custosFixosMes || 0) * fatorFixo;
  const cmvFracao = atual?.cmvPct != null ? Math.min(atual.cmvPct, 99) / 100 : 0;
  const equilibrio = custoFixoPeriodo > 0 ? custoFixoPeriodo / (1 - cmvFracao) : 0;
  const coberto = equilibrio > 0 && atual ? Math.min(100, (atual.faturamento / equilibrio) * 100) : 0;

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-4 md:p-6 space-y-5 text-white"
      style={{
        backgroundColor: tema.base,
        backgroundImage: `radial-gradient(circle at 12% 8%, ${tema.cor}55, transparent 40%), radial-gradient(circle at 88% 30%, ${tema.cor2}40, transparent 45%), radial-gradient(circle at 40% 100%, ${tema.cor}30, transparent 50%)`,
      }}
    >
      {/* cabeçalho com a data importante do mês */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Painel financeiro</h2>
          <p className="text-sm text-white/60 capitalize">{rotuloPeriodo(tipo, periodo)}</p>
        </div>
        <div className={vidro + ' px-4 py-2.5 flex items-center gap-3 max-w-sm'}>
          <CalendarHeart size={22} style={{ color: tema.cor }} aria-hidden />
          <div>
            <p className="text-sm font-semibold" style={{ color: tema.cor }}>
              {tema.nome}
            </p>
            <p className="text-xs text-white/70">{tema.frase}</p>
          </div>
        </div>
      </div>

      {/* filtros de período */}
      <div className={vidro + ' p-3 flex flex-wrap items-center gap-2'}>
        <div className="flex bg-white/5 rounded-lg p-1">
          {(
            [
              ['dia', 'Dia'],
              ['mes', 'Mês'],
              ['ano', 'Ano'],
              ['periodo', 'Período'],
            ] as [TipoPeriodo, string][]
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              onClick={() => setTipo(valor)}
              className={
                'px-3 py-1.5 rounded-md text-sm font-medium transition ' +
                (tipo === valor ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white')
              }
            >
              {rotulo}
            </button>
          ))}
        </div>

        {tipo !== 'periodo' && (
          <button onClick={() => andar(-1)} aria-label="Anterior" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
            <ChevronLeft size={16} />
          </button>
        )}
        {tipo === 'dia' && <input type="date" value={refDia} onChange={(e) => e.target.value && setRefDia(e.target.value)} className={campo} />}
        {tipo === 'mes' && <input type="month" value={refMes} onChange={(e) => e.target.value && setRefMes(e.target.value)} className={campo} />}
        {tipo === 'ano' && (
          <select value={refAno} onChange={(e) => setRefAno(e.target.value)} className={campo}>
            {Array.from({ length: 6 }, (_, i) => String(Number(hoje.slice(0, 4)) - i)).map((a) => (
              <option key={a} value={a} className="text-black">
                {a}
              </option>
            ))}
          </select>
        )}
        {tipo === 'periodo' && (
          <>
            <input type="date" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} className={campo} />
            <span className="text-white/60 text-sm">até</span>
            <input type="date" value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} className={campo} />
          </>
        )}
        {tipo !== 'periodo' && (
          <button onClick={() => andar(1)} aria-label="Próximo" className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
            <ChevronRight size={16} />
          </button>
        )}
        <span className="text-xs text-white/50 ml-auto">
          Comparando com: {rotuloPeriodo(tipo === 'periodo' ? 'periodo' : tipo, anteriorPeriodo)}
        </span>
      </div>

      {erro && <p className="text-sm text-rose-200 bg-rose-500/20 border border-rose-300/30 rounded-lg px-3 py-2">{erro}</p>}

      {!atual || !anterior ? (
        !erro && <p className="text-sm text-white/60">Carregando...</p>
      ) : (
        <div className={'space-y-5 transition-opacity ' + (loading ? 'opacity-60' : '')}>
          {/* indicadores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <CartaoIndicador
              icone={Wallet}
              titulo="Faturamento"
              valor={formatarReais(atual.faturamento)}
              cor={tema.cor}
              rodape={<Variacao atual={atual.faturamento} anterior={anterior.faturamento} />}
            />
            <CartaoIndicador
              icone={PiggyBank}
              titulo={atual.lucro < 0 ? 'Prejuízo' : 'Lucro líquido'}
              valor={formatarReais(atual.lucro)}
              cor={tema.cor}
              rodape={
                <div className="flex flex-wrap gap-x-3">
                  <span className="text-xs text-white/60">Margem {pct(atual.margemPct)}</span>
                  <Variacao atual={atual.lucro} anterior={anterior.lucro} />
                </div>
              }
            />
            <CartaoIndicador
              icone={ShoppingBag}
              titulo="Pedidos"
              valor={String(atual.pedidos)}
              cor={tema.cor}
              rodape={<Variacao atual={atual.pedidos} anterior={anterior.pedidos} />}
            />
            <CartaoIndicador
              icone={Receipt}
              titulo="Ticket médio"
              valor={formatarReais(atual.ticketMedio)}
              cor={tema.cor}
              rodape={<Variacao atual={atual.ticketMedio} anterior={anterior.ticketMedio} />}
            />
            <CartaoIndicador
              icone={Percent}
              titulo="CMV (custo dos ingredientes)"
              valor={pct(atual.cmvPct)}
              cor={tema.cor}
              rodape={
                <span className="text-xs text-white/60">
                  {formatarReais(atual.cmv)} · o ideal para restaurante fica entre 25% e 35%
                </span>
              }
            />
            <CartaoIndicador
              icone={Ban}
              titulo="Pedidos cancelados"
              valor={String(atual.cancelados)}
              cor={tema.cor}
              rodape={<Variacao atual={atual.cancelados} anterior={anterior.cancelados} inverter />}
            />
          </div>

          {/* gráfico principal + lateral */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={vidro + ' p-5 space-y-4 lg:col-span-2'}>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Faturamento por {periodo.agrupamento === 'hora' ? 'hora' : periodo.agrupamento === 'dia' ? 'dia' : 'mês'}
                </h3>
                <p className="text-xs text-white/50">Vendas do PDV e delivery entregue · passe o mouse nas barras</p>
              </div>
              {atual.detalhe && <GraficoBarras dados={atual.detalhe.buckets} cor={tema.cor} />}
            </div>

            <div className="space-y-4">
              <div className={vidro + ' p-5 space-y-3'}>
                <h3 className="text-sm font-semibold text-white">Ponto de equilíbrio</h3>
                {equilibrio > 0 ? (
                  <>
                    <p className="text-xs text-white/60">
                      Para pagar os custos fixos do período ({formatarReais(custoFixoPeriodo)}), é preciso faturar{' '}
                      <strong className="text-white">{formatarReais(equilibrio)}</strong>
                    </p>
                    <div
                      className="h-3 rounded-full bg-white/10 overflow-hidden"
                      role="meter"
                      aria-valuenow={Math.round(coberto)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Custos fixos cobertos"
                    >
                      <div className="h-full rounded-full" style={{ width: coberto + '%', background: tema.cor }} />
                    </div>
                    <p className="text-sm text-white">
                      {Math.round(coberto)}% coberto
                      {coberto >= 100 && <span className="text-emerald-300"> · custos pagos, agora é lucro!</span>}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-white/60">Cadastre os custos fixos na aba “Preços e custos fixos”.</p>
                )}
              </div>

              <div className={vidro + ' p-5 space-y-3'}>
                <h3 className="text-sm font-semibold text-white">Contas hoje</h3>
                {pendencias ? (
                  <ul className="space-y-2.5 text-sm">
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-white/80">
                        <AlertTriangle size={16} className={pendencias.vencidas.quantidade ? 'text-rose-300' : 'text-white/40'} aria-hidden />
                        Vencidas ({pendencias.vencidas.quantidade})
                      </span>
                      <span className={pendencias.vencidas.quantidade ? 'text-rose-200 font-semibold' : 'text-white'}>
                        {formatarReais(pendencias.vencidas.valor)}
                      </span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-white/80">
                        <CalendarClock size={16} className="text-amber-200" aria-hidden />
                        A pagar em 7 dias ({pendencias.proximas.quantidade})
                      </span>
                      <span className="text-white">{formatarReais(pendencias.proximas.valor)}</span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-white/80">
                        <HandCoins size={16} className="text-emerald-300" aria-hidden />
                        A receber ({pendencias.aReceber.quantidade})
                      </span>
                      <span className="text-white">{formatarReais(pendencias.aReceber.valor)}</span>
                    </li>
                  </ul>
                ) : (
                  <p className="text-xs text-white/60">Carregando...</p>
                )}
              </div>
            </div>
          </div>

          {/* distribuições */}
          {atual.detalhe && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ListaBarras
                titulo="Produtos mais vendidos"
                fatias={atual.detalhe.topProdutos}
                rotulo={(c) => c}
                cor={tema.cor}
                mostrarQuantidade="un"
                vazio="Nenhum item vendido no período"
              />
              <ListaBarras
                titulo="Formas de pagamento"
                fatias={atual.detalhe.porForma}
                rotulo={(c) => rotuloForma(c === 'nao_informado' ? null : c)}
                cor={tema.cor}
                mostrarQuantidade="pedidos"
                vazio="Nenhuma venda no período"
              />
              <ListaBarras
                titulo="Vendas por canal"
                fatias={atual.detalhe.porCanal}
                rotulo={(c) => c}
                cor={tema.cor}
                mostrarQuantidade="pedidos"
                vazio="Nenhuma venda no período"
              />
              <ListaBarras
                titulo="Para onde foi o dinheiro (despesas pagas)"
                fatias={atual.detalhe.porDespesa}
                rotulo={(c) => CATEGORIAS.pagar[c] || c}
                cor={tema.cor2}
                vazio="Nenhuma despesa paga no período"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
