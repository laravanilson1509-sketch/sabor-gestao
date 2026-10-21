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
type Ponto = { chave: string; rotulo: string; valor: number; quantidade: number };

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// cada forma de pagamento tem sempre a mesma cor (paleta testada para fundo escuro e daltonismo)
const COR_FORMA: Record<string, string> = {
  pix: '#3987e5',
  dinheiro: '#d95926',
  cartao_credito: '#199e70',
  cartao_debito: '#c98500',
  cartao: '#c98500',
  vale_refeicao: '#d55181',
  outro: '#9085e9',
  nao_informado: '#9085e9',
  fiado: '#a0a7b4',
};

const vidro =
  'bg-gradient-to-br from-white/[0.10] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]';
const campo =
  'bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-white/30';
const tituloCartao = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70';

const pct = (v: number | null) => (v === null ? '—' : v.toFixed(1).replace('.', ',') + '%');
const reaisCurto = (v: number) =>
  v >= 1000 ? 'R$ ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',') + ' mil' : 'R$ ' + Math.round(v);

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

// curva suave que não "passa do ponto" (não inventa picos entre os valores)
function caminhoSuave(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const inc = pts.slice(1).map((p, i) => (p.y - pts[i].y) / dx[i]);
  const m = pts.map((_, i) => {
    if (i === 0) return inc[0];
    if (i === n - 1) return inc[n - 2];
    return inc[i - 1] * inc[i] <= 0 ? 0 : (inc[i - 1] + inc[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (inc[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / inc[i];
    const b = m[i + 1] / inc[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * inc[i];
      m[i + 1] = t * b * inc[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + m[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - m[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

// ---------- peças visuais ----------

function Variacao({ atual, anterior, inverter }: { atual: number; anterior: number; inverter?: boolean }) {
  if (anterior === 0) return <span className="text-[11px] text-white/50">sem base de comparação</span>;
  const delta = ((atual - anterior) / Math.abs(anterior)) * 100;
  const subiu = delta >= 0;
  const bom = inverter ? !subiu : subiu;
  const Icone = subiu ? TrendingUp : TrendingDown;
  return (
    <span
      className={
        'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ' +
        (bom ? 'text-emerald-200 bg-emerald-400/10 border-emerald-300/20' : 'text-rose-200 bg-rose-400/10 border-rose-300/20')
      }
    >
      <Icone size={12} aria-hidden />
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
    <div className={vidro + ' relative overflow-hidden p-5 space-y-3'}>
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-40" style={{ background: cor }} />
      <div className="relative flex items-center justify-between">
        <span className={tituloCartao}>{titulo}</span>
        <Icone size={18} style={{ color: cor }} aria-hidden />
      </div>
      <p className="relative text-3xl font-bold text-white tracking-tight">{valor}</p>
      <div className="relative min-h-[1.25rem] flex flex-wrap items-center gap-2">{rodape}</div>
    </div>
  );
}

function GraficoLinha({
  atual,
  anterior,
  cor,
  cor2,
  nomeAtual,
  nomeAnterior,
}: {
  atual: Ponto[];
  anterior: Ponto[];
  cor: string;
  cor2: string;
  nomeAtual: string;
  nomeAnterior: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [ativo, setAtivo] = useState<number | null>(null);

  useEffect(() => {
    if (!caixa.current) return;
    const obs = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    obs.observe(caixa.current);
    return () => obs.disconnect();
  }, []);

  const altura = 280;
  const m = { esq: 58, dir: 18, topo: 30, base: 28 };
  const n = atual.length;
  const passoX = n > 1 ? (largura - m.esq - m.dir) / (n - 1) : 0;
  const valorAnterior = (i: number) => anterior[i]?.valor || 0;
  const topo = topoBonito(Math.max(...atual.map((p) => p.valor), ...atual.map((_, i) => valorAnterior(i)), 0));
  const x = (i: number) => m.esq + i * passoX;
  const y = (v: number) => m.topo + (1 - v / topo) * (altura - m.topo - m.base);

  const ptsAtual = atual.map((p, i) => ({ x: x(i), y: y(p.valor) }));
  const ptsAnterior = atual.map((_, i) => ({ x: x(i), y: y(valorAnterior(i)) }));
  const linhaAtual = caminhoSuave(ptsAtual);
  const area = n > 1 ? `${linhaAtual} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';

  const iMaior = atual.reduce((melhor, p, i) => (p.valor > atual[melhor].valor ? i : melhor), 0);
  const temVenda = atual.some((p) => p.valor > 0);
  const passoRotulo = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(largura / 64))));
  const idGrad = 'area-' + cor.slice(1);

  function mover(e: React.MouseEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left - m.esq) / (passoX || 1));
    setAtivo(Math.max(0, Math.min(n - 1, i)));
  }

  return (
    <div ref={caixa} className="relative w-full">
      <svg width={largura} height={altura} role="img" aria-label={`Faturamento de ${nomeAtual} comparado com ${nomeAnterior}`}>
        <defs>
          <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.45" />
            <stop offset="100%" stopColor={cor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={idGrad + '-linha'} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={cor2} />
            <stop offset="100%" stopColor={cor} />
          </linearGradient>
          <filter id="brilho" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={m.esq} x2={largura - m.dir} y1={y(topo * f)} y2={y(topo * f)} stroke="rgba(255,255,255,0.08)" />
            <text x={m.esq - 10} y={y(topo * f) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">
              {reaisCurto(topo * f)}
            </text>
          </g>
        ))}

        {atual.map((p, i) =>
          i % passoRotulo === 0 || i === n - 1 ? (
            <text key={p.chave} x={x(i)} y={altura - 8} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">
              {p.rotulo}
            </text>
          ) : null
        )}

        {n > 1 && (
          <>
            <path d={area} fill={`url(#${idGrad})`} />
            <path d={caminhoSuave(ptsAnterior)} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d={linhaAtual} fill="none" stroke={`url(#${idGrad}-linha)`} strokeWidth="2.5" filter="url(#brilho)" strokeLinecap="round" />
          </>
        )}

        {n <= 31 &&
          ptsAtual.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" opacity={atual[i].valor > 0 ? 0.85 : 0.25} />)}

        {/* etiqueta no maior valor */}
        {temVenda && ativo === null && (
          <g transform={`translate(${Math.min(Math.max(ptsAtual[iMaior].x, m.esq + 40), largura - m.dir - 40)}, ${ptsAtual[iMaior].y - 14})`}>
            <rect x="-40" y="-18" width="80" height="20" rx="10" fill="rgba(11,15,20,0.85)" stroke={cor} strokeOpacity="0.6" />
            <text y="-4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
              {reaisCurto(atual[iMaior].valor)}
            </text>
          </g>
        )}

        {ativo !== null && (
          <g>
            <line x1={x(ativo)} x2={x(ativo)} y1={m.topo} y2={y(0)} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3" />
            <circle cx={x(ativo)} cy={ptsAnterior[ativo].y} r="4" fill="#0B0F14" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
            <circle cx={x(ativo)} cy={ptsAtual[ativo].y} r="6" fill={cor} stroke="#0B0F14" strokeWidth="2" />
          </g>
        )}

        <rect
          x={0}
          y={0}
          width={largura}
          height={altura}
          fill="transparent"
          onMouseMove={mover}
          onMouseLeave={() => setAtivo(null)}
        />
      </svg>

      {!temVenda && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-white/50 pointer-events-none">
          Nenhuma venda neste período
        </p>
      )}

      {ativo !== null && (
        <div
          className="absolute top-2 pointer-events-none bg-[#0B0F14]/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-white whitespace-nowrap shadow-xl backdrop-blur"
          style={
            x(ativo) > largura / 2
              ? { right: largura - x(ativo) + 12 }
              : { left: x(ativo) + 12 }
          }
        >
          <p className="text-white/60 mb-1">{atual[ativo].rotulo}</p>
          <p className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded" style={{ background: cor }} />
            {nomeAtual}: <strong>{formatarReais(atual[ativo].valor)}</strong>
            <span className="text-white/50">({atual[ativo].quantidade} ped.)</span>
          </p>
          <p className="flex items-center gap-2 text-white/70">
            <span className="w-3 border-t border-dashed border-white/60" />
            {nomeAnterior}: {formatarReais(valorAnterior(ativo))}
          </p>
        </div>
      )}
    </div>
  );
}

function AnelMeta({ realizado, meta, cor, cor2 }: { realizado: number; meta: number; cor: string; cor2: string }) {
  const percentual = meta > 0 ? (realizado / meta) * 100 : 0;
  const raio = 70;
  const volta = 2 * Math.PI * raio;
  const preenchido = Math.min(percentual, 100) / 100;
  return (
    <div className="relative w-[180px] h-[180px] shrink-0">
      <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90" role="meter" aria-valuenow={Math.round(percentual)} aria-label="Porcentagem da meta">
        <defs>
          <linearGradient id="grad-anel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={cor2} />
            <stop offset="100%" stopColor={cor} />
          </linearGradient>
          <filter id="brilho-anel" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="90" cy="90" r={raio} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r={raio}
          fill="none"
          stroke="url(#grad-anel)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${volta * preenchido} ${volta}`}
          filter="url(#brilho-anel)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{pct(percentual)}</span>
        <span className="text-[11px] uppercase tracking-[0.15em] text-white/60">da meta</span>
      </div>
    </div>
  );
}

function Rosca({ fatias }: { fatias: Fatia[] }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  const raio = 62;
  const volta = 2 * Math.PI * raio;
  const folga = fatias.length > 1 ? 3 : 0; // espaço entre as fatias
  let acumulado = 0;
  const destaque = fatias.find((f) => f.chave === ativo);
  const rotulo = (chave: string) => rotuloForma(chave === 'nao_informado' ? null : chave);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative w-[160px] h-[160px] shrink-0">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={raio} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="20" />
          {fatias.map((f) => {
            const tamanho = total > 0 ? (f.valor / total) * volta : 0;
            const inicio = acumulado;
            acumulado += tamanho;
            return (
              <circle
                key={f.chave}
                cx="80"
                cy="80"
                r={raio}
                fill="none"
                stroke={COR_FORMA[f.chave] || '#9085e9'}
                strokeWidth={ativo === f.chave ? 24 : 20}
                strokeDasharray={`${Math.max(0, tamanho - folga)} ${volta}`}
                strokeDashoffset={-inicio}
                opacity={ativo === null || ativo === f.chave ? 1 : 0.35}
                onMouseEnter={() => setAtivo(f.chave)}
                onMouseLeave={() => setAtivo(null)}
                className="transition-all cursor-pointer"
              >
                <title>{`${rotulo(f.chave)}: ${formatarReais(f.valor)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          <span className="text-lg font-bold text-white leading-tight">{reaisCurto(destaque ? destaque.valor : total)}</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/60">
            {destaque ? rotulo(destaque.chave) : 'total'}
          </span>
        </div>
      </div>
      <ul className="flex-1 w-full space-y-2">
        {fatias.map((f) => (
          <li
            key={f.chave}
            onMouseEnter={() => setAtivo(f.chave)}
            onMouseLeave={() => setAtivo(null)}
            className={'flex items-center gap-2 text-sm rounded-lg px-2 py-1 transition ' + (ativo === f.chave ? 'bg-white/10' : '')}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COR_FORMA[f.chave] || '#9085e9' }} />
            <span className="text-white/80 flex-1 truncate">{rotulo(f.chave)}</span>
            <span className="text-white font-medium whitespace-nowrap">{formatarReais(f.valor)}</span>
            <span className="text-white/50 text-xs w-10 text-right">{total > 0 ? Math.round((f.valor / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ranking({
  fatias,
  rotulo,
  cor,
  cor2,
  unidade,
}: {
  fatias: Fatia[];
  rotulo: (chave: string) => string;
  cor: string;
  cor2: string;
  unidade?: string;
}) {
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  const maior = Math.max(...fatias.map((f) => f.valor), 0);
  return (
    <ul className="space-y-2.5">
      {fatias.map((f, i) => (
        <li key={f.chave} className="grid grid-cols-[1.25rem_minmax(0,9rem)_1fr_auto] sm:grid-cols-[1.25rem_minmax(0,11rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="text-white/50 text-xs font-semibold">{i + 1}</span>
          <span className="text-white truncate" title={rotulo(f.chave)}>
            {rotulo(f.chave)}
            {unidade && <span className="text-white/45 text-xs"> · {f.quantidade} {unidade}</span>}
          </span>
          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: (maior > 0 ? (f.valor / maior) * 100 : 0) + '%',
                background: `linear-gradient(to right, ${cor2}, ${cor})`,
                boxShadow: `0 0 12px ${cor}88`,
              }}
            />
          </div>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-white font-semibold">{formatarReais(f.valor)}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/80 w-11 text-center">
              {total > 0 ? Math.round((f.valor / total) * 100) : 0}%
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Cartao({ titulo, subtitulo, children, className = '' }: { titulo: string; subtitulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={vidro + ' p-5 space-y-4 ' + className}>
      <div>
        <h3 className={tituloCartao}>{titulo}</h3>
        {subtitulo && <p className="text-xs text-white/50 mt-0.5">{subtitulo}</p>}
      </div>
      {children}
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

  // meta = ponto de equilíbrio: quanto precisa vender para pagar os custos fixos do período
  const diasPeriodo = Math.round((periodo.fim.getTime() - periodo.inicio.getTime()) / 86400000);
  const fatorFixo = tipo === 'mes' ? 1 : tipo === 'ano' ? 12 : diasPeriodo / 30.44;
  const custoFixoPeriodo = (pendencias?.custosFixosMes || 0) * fatorFixo;
  const cmvFracao = atual?.cmvPct != null ? Math.min(atual.cmvPct, 99) / 100 : 0;
  const meta = custoFixoPeriodo > 0 ? custoFixoPeriodo / (1 - cmvFracao) : 0;

  const nomeAtual = tipo === 'ano' ? rotuloPeriodo('ano', periodo) : 'Atual';
  const nomeAnterior = tipo === 'ano' ? rotuloPeriodo('ano', anteriorPeriodo) : 'Anterior';
  const agrupamento = periodo.agrupamento === 'hora' ? 'por hora' : periodo.agrupamento === 'dia' ? 'diário' : 'mensal';

  return (
    <div
      className="tema-escuro relative overflow-hidden rounded-3xl p-4 md:p-6 space-y-5 text-white"
      style={{
        backgroundColor: tema.base,
        backgroundImage: `radial-gradient(ellipse at 10% 0%, ${tema.cor}50, transparent 45%), radial-gradient(ellipse at 95% 20%, ${tema.cor2}45, transparent 45%), radial-gradient(ellipse at 50% 110%, ${tema.cor}35, transparent 55%), linear-gradient(160deg, ${tema.base}, #0A0D1A 60%, ${tema.base})`,
      }}
    >
      {/* cabeçalho com a data importante do mês */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            PAINEL{' '}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${tema.cor}, ${tema.cor2})` }}>
              FINANCEIRO
            </span>
          </h2>
          <p className="text-xs uppercase tracking-[0.15em] text-white/60 mt-1">{rotuloPeriodo(tipo, periodo)}</p>
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
        <div className="flex bg-black/20 rounded-xl p-1">
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
                'px-4 py-1.5 rounded-lg text-sm font-medium transition ' +
                (tipo === valor ? 'text-white shadow' : 'text-white/60 hover:text-white')
              }
              style={tipo === valor ? { background: `linear-gradient(90deg, ${tema.cor2}cc, ${tema.cor}cc)` } : undefined}
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
              <option key={a} value={a} className="bg-[#1A1424] text-white">
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
        <span className="text-xs text-white/50 ml-auto">Comparando com: {rotuloPeriodo(tipo, anteriorPeriodo)}</span>
      </div>

      {erro && <p className="text-sm text-rose-200 bg-rose-500/20 border border-rose-300/30 rounded-lg px-3 py-2">{erro}</p>}

      {!atual || !anterior ? (
        !erro && <p className="text-sm text-white/60">Carregando...</p>
      ) : (
        <div className={'space-y-5 transition-opacity ' + (loading ? 'opacity-60' : '')}>
          {/* indicadores principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <CartaoIndicador
              icone={Wallet}
              titulo="Faturamento"
              valor={formatarReais(atual.faturamento)}
              cor={tema.cor}
              rodape={<Variacao atual={atual.faturamento} anterior={anterior.faturamento} />}
            />
            <CartaoIndicador
              icone={PiggyBank}
              titulo={atual.lucro < 0 ? 'Prejuízo' : 'Lucro'}
              valor={formatarReais(atual.lucro)}
              cor={tema.cor2}
              rodape={
                <>
                  <Variacao atual={atual.lucro} anterior={anterior.lucro} />
                  <span className="text-[11px] text-white/60">Margem {pct(atual.margemPct)}</span>
                </>
              }
            />
            <CartaoIndicador
              icone={ShoppingBag}
              titulo="Pedidos"
              valor={atual.pedidos.toLocaleString('pt-BR')}
              cor={tema.cor}
              rodape={<Variacao atual={atual.pedidos} anterior={anterior.pedidos} />}
            />
            <CartaoIndicador
              icone={Receipt}
              titulo="Ticket médio"
              valor={formatarReais(atual.ticketMedio)}
              cor={tema.cor2}
              rodape={<Variacao atual={atual.ticketMedio} anterior={anterior.ticketMedio} />}
            />
          </div>

          {/* faturamento no tempo + meta */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Cartao titulo={`Faturamento ${agrupamento}`} subtitulo="Passe o mouse no gráfico para ver cada ponto" className="lg:col-span-2">
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/70 -mt-2">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-0.5 rounded" style={{ background: `linear-gradient(90deg, ${tema.cor2}, ${tema.cor})` }} />
                  {tipo === 'ano' ? nomeAtual : 'Período atual'}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 border-t border-dashed border-white/60" />
                  {tipo === 'ano' ? nomeAnterior : 'Período anterior'}
                </span>
                <Variacao atual={atual.faturamento} anterior={anterior.faturamento} />
              </div>
              <GraficoLinha
                atual={atual.buckets}
                anterior={anterior.buckets}
                cor={tema.cor}
                cor2={tema.cor2}
                nomeAtual={nomeAtual}
                nomeAnterior={nomeAnterior}
              />
            </Cartao>

            <Cartao titulo="Meta de faturamento" subtitulo="Ponto de equilíbrio: pagar os custos fixos">
              {meta > 0 ? (
                <div className="flex flex-col items-center gap-5">
                  <AnelMeta realizado={atual.faturamento} meta={meta} cor={tema.cor} cor2={tema.cor2} />
                  <ul className="w-full space-y-2 text-sm">
                    <li className="flex justify-between gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-2 text-white/70">
                        <span className="w-2 h-2 rounded-full" style={{ background: tema.cor }} /> Realizado
                      </span>
                      <span className="font-semibold">{formatarReais(atual.faturamento)}</span>
                    </li>
                    <li className="flex justify-between gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-2 text-white/70">
                        <span className="w-2 h-2 rounded-full bg-white/60" /> Meta
                      </span>
                      <span className="font-semibold">{formatarReais(meta)}</span>
                    </li>
                    <li className="flex justify-between gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-2 text-white/70">
                        <span className={'w-2 h-2 rounded-full ' + (atual.faturamento >= meta ? 'bg-emerald-300' : 'bg-rose-300')} />
                        {atual.faturamento >= meta ? 'Acima da meta' : 'Falta'}
                      </span>
                      <span className={'font-semibold ' + (atual.faturamento >= meta ? 'text-emerald-200' : 'text-rose-200')}>
                        {formatarReais(Math.abs(meta - atual.faturamento))}
                      </span>
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-white/60">Cadastre os custos fixos na aba “Preços e custos fixos” para calcular a meta.</p>
              )}
            </Cartao>
          </div>

          {/* ranking + formas de pagamento */}
          {atual.detalhe && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Cartao titulo="Top produtos" subtitulo="Faturamento e % do total vendido" className="lg:col-span-2">
                {atual.detalhe.topProdutos.length === 0 ? (
                  <p className="text-sm text-white/50">Nenhum item vendido no período</p>
                ) : (
                  <Ranking fatias={atual.detalhe.topProdutos} rotulo={(c) => c} cor={tema.cor} cor2={tema.cor2} unidade="un" />
                )}
              </Cartao>
              <Cartao titulo="Formas de pagamento">
                {atual.detalhe.porForma.length === 0 ? (
                  <p className="text-sm text-white/50">Nenhuma venda no período</p>
                ) : (
                  <Rosca fatias={atual.detalhe.porForma} />
                )}
              </Cartao>
            </div>
          )}

          {/* canais, despesas e saúde do negócio */}
          {atual.detalhe && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Cartao titulo="Vendas por canal">
                {atual.detalhe.porCanal.length === 0 ? (
                  <p className="text-sm text-white/50">Nenhuma venda no período</p>
                ) : (
                  <Ranking fatias={atual.detalhe.porCanal} rotulo={(c) => c} cor={tema.cor} cor2={tema.cor2} />
                )}
              </Cartao>
              <Cartao titulo="Para onde foi o dinheiro" subtitulo="Despesas pagas no período">
                {atual.detalhe.porDespesa.length === 0 ? (
                  <p className="text-sm text-white/50">Nenhuma despesa paga no período</p>
                ) : (
                  <Ranking
                    fatias={atual.detalhe.porDespesa}
                    rotulo={(c) => CATEGORIAS.pagar[c] || c}
                    cor={tema.cor2}
                    cor2={tema.cor2 + '88'}
                  />
                )}
              </Cartao>
              <Cartao titulo="Saúde do negócio">
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-white/80">
                      <Percent size={16} style={{ color: tema.cor }} aria-hidden />
                      CMV (ideal 25% a 35%)
                    </span>
                    <span className="font-semibold">{pct(atual.cmvPct)}</span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-white/80">
                      <Ban size={16} style={{ color: tema.cor }} aria-hidden />
                      Pedidos cancelados
                    </span>
                    <span className="font-semibold">{atual.cancelados}</span>
                  </li>
                  {pendencias && (
                    <>
                      <li className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-white/80">
                          <AlertTriangle size={16} className={pendencias.vencidas.quantidade ? 'text-rose-300' : 'text-white/40'} aria-hidden />
                          Contas vencidas ({pendencias.vencidas.quantidade})
                        </span>
                        <span className={'font-semibold ' + (pendencias.vencidas.quantidade ? 'text-rose-200' : '')}>
                          {formatarReais(pendencias.vencidas.valor)}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-white/80">
                          <CalendarClock size={16} className="text-amber-200" aria-hidden />
                          A pagar em 7 dias ({pendencias.proximas.quantidade})
                        </span>
                        <span className="font-semibold">{formatarReais(pendencias.proximas.valor)}</span>
                      </li>
                      <li className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-white/80">
                          <HandCoins size={16} className="text-emerald-300" aria-hidden />
                          A receber ({pendencias.aReceber.quantidade})
                        </span>
                        <span className="font-semibold">{formatarReais(pendencias.aReceber.valor)}</span>
                      </li>
                    </>
                  )}
                </ul>
              </Cartao>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
