'use client';

// Histórico de preços: como o preço de cada ingrediente variou por fornecedor,
// juntando o que foi cotado e o que veio na nota.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarHistoricoPrecos, type PontoPreco } from '@/lib/queries/compras';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import { combina } from '@/lib/busca';
import { CARTAO, moeda } from '@/components/pdv/estilos';

const CORES = ['#0E6B7E', '#E3B341', '#B3261E', '#6F5BD6', '#1E6B3F', '#D55181'];

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const pct = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + '%';

function Grafico({ pontos, fornecedores }: { pontos: PontoPreco[]; fornecedores: string[] }) {
  const L = 640, A = 220, M = { e: 52, d: 12, t: 12, b: 26 };
  const tempos = pontos.map((p) => new Date(p.data).getTime());
  const precos = pontos.map((p) => p.preco_unitario);
  const t0 = Math.min(...tempos), t1 = Math.max(...tempos);
  const p0 = Math.min(...precos), p1 = Math.max(...precos);
  const folga = (p1 - p0) * 0.15 || p1 * 0.1 || 1;
  const minY = Math.max(0, p0 - folga), maxY = p1 + folga;
  const x = (t: number) => (t1 === t0 ? (L + M.e - M.d) / 2 : M.e + ((t - t0) / (t1 - t0)) * (L - M.e - M.d));
  const y = (p: number) => A - M.b - ((p - minY) / (maxY - minY)) * (A - M.b - M.t);
  const marcas = [minY, (minY + maxY) / 2, maxY];

  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="w-full h-auto" role="img" aria-label="Gráfico do histórico de preços">
      {marcas.map((m) => (
        <g key={m}>
          <line x1={M.e} x2={L - M.d} y1={y(m)} y2={y(m)} stroke="#E6ECEF" />
          <text x={M.e - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill="#8FA0A8">
            {m.toFixed(2).replace('.', ',')}
          </text>
        </g>
      ))}
      <text x={M.e} y={A - 6} fontSize="11" fill="#8FA0A8">{dataCurta(new Date(t0).toISOString())}</text>
      {t1 !== t0 && (
        <text x={L - M.d} y={A - 6} textAnchor="end" fontSize="11" fill="#8FA0A8">{dataCurta(new Date(t1).toISOString())}</text>
      )}
      {fornecedores.map((f, k) => {
        const serie = pontos.filter((p) => (p.fornecedor || 'Sem fornecedor') === f);
        const cor = CORES[k % CORES.length];
        return (
          <g key={f}>
            {serie.length > 1 && (
              <polyline
                fill="none"
                stroke={cor}
                strokeWidth="2"
                points={serie.map((p) => `${x(new Date(p.data).getTime())},${y(p.preco_unitario)}`).join(' ')}
              />
            )}
            {serie.map((p, i) => (
              <circle
                key={i}
                cx={x(new Date(p.data).getTime())}
                cy={y(p.preco_unitario)}
                r="4"
                fill={p.origem === 'nota' ? cor : '#fff'}
                stroke={cor}
                strokeWidth="2"
              >
                <title>{`${f} · ${dataCurta(p.data)} · ${moeda(p.preco_unitario)} (${p.origem === 'nota' ? 'nota' : 'cotação'})`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default function HistoricoPrecosPage() {
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [pontos, setPontos] = useState<PontoPreco[]>([]);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<string | null>(null);

  useEffect(() => {
    listarHistoricoPrecos(supabase, unidadeId)
      .then(({ pontos, nomes }) => {
        setPontos(pontos);
        setNomes(nomes);
      })
      .catch((e) =>
        setErro(
          (e?.message || '').includes('compras_historico_precos') || e?.code === 'PGRST205'
            ? 'Falta rodar o SQL 0021_compras.sql no Supabase.'
            : e?.message || 'Erro ao carregar'
        )
      )
      .finally(() => setLoading(false));
  }, []);

  // resumo de cada ingrediente: último preço e variação desde o primeiro
  const resumo = useMemo(() => {
    const porIng = new Map<string, PontoPreco[]>();
    for (const p of pontos) porIng.set(p.ingrediente_id, [...(porIng.get(p.ingrediente_id) || []), p]);
    return [...porIng.entries()]
      .map(([id, lista]) => {
        const ord = [...lista].sort((a, b) => a.data.localeCompare(b.data));
        const ultimo = ord[ord.length - 1];
        const primeiro = ord[0];
        return {
          id,
          nome: nomes.get(id) || 'Ingrediente',
          ultimo: ultimo.preco_unitario,
          unidade: ultimo.unidade,
          variacao: primeiro.preco_unitario > 0 && ord.length > 1 ? ((ultimo.preco_unitario - primeiro.preco_unitario) / primeiro.preco_unitario) * 100 : null,
          quantos: ord.length,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pontos, nomes]);

  const filtrados = resumo.filter((r) => combina(busca, r.nome));
  const atual = resumo.find((r) => r.id === escolhido) || null;
  const serie = pontos.filter((p) => p.ingrediente_id === escolhido).sort((a, b) => a.data.localeCompare(b.data));
  const fornecedores = [...new Set(serie.map((p) => p.fornecedor || 'Sem fornecedor'))];

  // variação de cada ponto contra o anterior do mesmo fornecedor
  const linhas = serie
    .map((p, i) => {
      const anterior = [...serie.slice(0, i)].reverse().find((q) => (q.fornecedor || '') === (p.fornecedor || ''));
      return { ...p, variacao: anterior && anterior.preco_unitario > 0 ? ((p.preco_unitario - anterior.preco_unitario) / anterior.preco_unitario) * 100 : null };
    })
    .reverse();

  const precosSerie = serie.map((p) => p.preco_unitario);
  const menor = serie.length ? serie.reduce((m, p) => (p.preco_unitario < m.preco_unitario ? p : m)) : null;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/compras" className="h-10 w-10 flex items-center justify-center rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition" aria-label="Voltar para Compras">
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#16252B]">Histórico de preços</h1>
            <p className="text-sm text-[#5B6B73]">Como o preço de cada item variou por fornecedor</p>
          </div>
        </div>

        {erro && (
          <div role="alert" className="mb-4 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</div>
        )}

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : resumo.length === 0 && !erro ? (
          <div className={CARTAO + ' p-8 text-center'}>
            <p className="text-[#16252B]">Ainda não há preços registrados</p>
            <p className="text-sm text-[#5B6B73] mt-2">Eles aparecem conforme você cota e recebe compras.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <div className="space-y-3">
              <BarraBusca valor={busca} onChange={setBusca} placeholder="Buscar item..." />
              {filtrados.length === 0 ? (
                <NadaEncontrado busca={busca} />
              ) : (
                <ul className={CARTAO + ' divide-y divide-[#E6ECEF] overflow-hidden'}>
                  {filtrados.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => setEscolhido(r.id)}
                        className={'w-full text-left px-4 py-3 transition ' + (escolhido === r.id ? 'bg-[#DCEEF2]' : 'hover:bg-[#F8FAFB]')}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[#16252B]">{r.nome}</span>
                          <span className="text-sm font-semibold text-[#16252B]">
                            {moeda(r.ultimo)}
                            <span className="text-xs font-normal text-[#8FA0A8]">/{r.unidade}</span>
                          </span>
                        </span>
                        <span className="flex items-center justify-between text-xs text-[#8FA0A8] mt-0.5">
                          <span>{r.quantos} {r.quantos === 1 ? 'registro' : 'registros'}</span>
                          {r.variacao !== null && (
                            <span className={r.variacao > 0 ? 'text-[#B3261E]' : r.variacao < 0 ? 'text-[#1E6B3F]' : ''}>
                              {pct(r.variacao)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              {!atual ? (
                <div className={CARTAO + ' p-10 text-center text-sm text-[#5B6B73]'}>Escolha um item na lista para ver o histórico.</div>
              ) : (
                <div className="space-y-4">
                  <div className={CARTAO + ' p-4'}>
                    <h2 className="text-base font-semibold text-[#16252B]">{atual.nome}</h2>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-[#5B6B73]">Último preço</p>
                        <p className="text-base font-bold text-[#16252B]">{moeda(atual.ultimo)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#5B6B73]">Menor já visto</p>
                        <p className="text-base font-bold text-[#1E6B3F]">{moeda(Math.min(...precosSerie))}</p>
                        {menor && <p className="text-xs text-[#8FA0A8]">{menor.fornecedor || 'Sem fornecedor'}</p>}
                      </div>
                      <div>
                        <p className="text-xs text-[#5B6B73]">Maior já visto</p>
                        <p className="text-base font-bold text-[#B3261E]">{moeda(Math.max(...precosSerie))}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Grafico pontos={serie} fornecedores={fornecedores} />
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[#5B6B73]">
                        {fornecedores.map((f, k) => (
                          <span key={f} className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[k % CORES.length] }} />
                            {f}
                          </span>
                        ))}
                        <span>● preenchido = nota · ○ vazado = cotação</span>
                      </div>
                    </div>
                  </div>

                  <div className={CARTAO + ' overflow-x-auto'}>
                    <table className="w-full min-w-[420px]">
                      <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Data</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Fornecedor</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Origem</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Preço</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6ECEF]">
                        {linhas.map((p, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5 text-sm text-[#2B3C44]">{dataCurta(p.data)}</td>
                            <td className="px-4 py-2.5 text-sm text-[#16252B]">{p.fornecedor || '—'}</td>
                            <td className="px-4 py-2.5 text-sm text-[#5B6B73]">{p.origem === 'nota' ? 'Nota' : 'Cotação'}</td>
                            <td className="px-4 py-2.5 text-sm text-right font-semibold text-[#16252B]">
                              {moeda(p.preco_unitario)}
                              {p.variacao !== null && (
                                <span className={'ml-2 text-xs font-medium ' + (p.variacao > 0 ? 'text-[#B3261E]' : p.variacao < 0 ? 'text-[#1E6B3F]' : 'text-[#8FA0A8]')}>
                                  {pct(p.variacao)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
