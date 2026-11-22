'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  carregarFluxoCaixa,
  hojeISO,
  formatarData,
  formatarReais,
  type DiaFluxo,
} from '@/lib/queries/financeiroContas';

type Totais = { vendas: number; recebidas: number; pagas: number; saldo: number };

const corSaldo = (v: number) => (v < 0 ? 'text-danger' : v > 0 ? 'text-success' : 'text-ink-subtle');

export default function FluxoCaixa() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [dias, setDias] = useState<DiaFluxo[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [soComMovimento, setSoComMovimento] = useState(true);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!mes) return;
    setLoading(true);
    carregarFluxoCaixa(supabase, unidadeId, mes)
      .then((r) => {
        setDias(r.dias);
        setTotais(r.totais);
        setErro(null);
      })
      .catch(() => setErro('Erro ao carregar o fluxo de caixa. Confira se o arquivo 0016 foi rodado no Supabase.'))
      .finally(() => setLoading(false));
  }, [mes]);

  // saldo acumulado: quanto o mês já rendeu até aquele dia
  let acumulado = 0;
  const linhas = dias.map((d) => {
    acumulado += d.saldo;
    return { ...d, acumulado };
  });
  const visiveis = soComMovimento
    ? linhas.filter((d) => d.vendas || d.recebidas || d.pagas)
    : linhas;

  return (
    <div className="bg-surface border border-line rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-ink">Fluxo de caixa</h2>
          <p className="text-sm text-ink-muted">O que entrou e saiu em cada dia do mês</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="border border-line-strong rounded-lg px-3 py-2 text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {erro && <p className="text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">{erro}</p>}

      {loading || !totais ? (
        !erro && <p className="text-sm text-ink-muted">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-surface-hover border border-line rounded-lg p-3">
              <p className="text-xs text-ink-muted">Vendas</p>
              <p className="font-bold text-ink">{formatarReais(totais.vendas)}</p>
            </div>
            <div className="bg-surface-hover border border-line rounded-lg p-3">
              <p className="text-xs text-ink-muted">Contas recebidas</p>
              <p className="font-bold text-ink">{formatarReais(totais.recebidas)}</p>
            </div>
            <div className="bg-surface-hover border border-line rounded-lg p-3">
              <p className="text-xs text-ink-muted">Contas pagas</p>
              <p className="font-bold text-danger">− {formatarReais(totais.pagas)}</p>
            </div>
            <div className="bg-accent-soft border border-line rounded-lg p-3">
              <p className="text-xs text-ink-muted">Saldo do mês</p>
              <p className={'font-bold ' + corSaldo(totais.saldo)}>{formatarReais(totais.saldo)}</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={soComMovimento}
              onChange={(e) => setSoComMovimento(e.target.checked)}
              className="accent-accent"
            />
            Mostrar só os dias com movimento
          </label>

          {visiveis.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhum movimento neste mês</p>
          ) : (
            <div className="border border-line rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-hover text-xs text-ink-muted">
                  <tr>
                    <th className="text-left font-medium p-2">Dia</th>
                    <th className="text-right font-medium p-2">Entradas</th>
                    <th className="text-right font-medium p-2">Saídas</th>
                    <th className="text-right font-medium p-2">Saldo do dia</th>
                    <th className="text-right font-medium p-2">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {visiveis.map((d) => (
                    <tr key={d.data}>
                      <td className="p-2 text-ink whitespace-nowrap">{formatarData(d.data).slice(0, 5)}</td>
                      <td className="p-2 text-right text-ink whitespace-nowrap">
                        {formatarReais(d.vendas + d.recebidas)}
                      </td>
                      <td className="p-2 text-right text-danger whitespace-nowrap">
                        {d.pagas ? '− ' + formatarReais(d.pagas) : formatarReais(0)}
                      </td>
                      <td className={'p-2 text-right font-medium whitespace-nowrap ' + corSaldo(d.saldo)}>
                        {formatarReais(d.saldo)}
                      </td>
                      <td className={'p-2 text-right whitespace-nowrap ' + corSaldo(d.acumulado)}>
                        {formatarReais(d.acumulado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-ink-muted">
            Entradas = vendas do PDV e delivery entregue + contas recebidas. Saídas = contas pagas. Sangria e
            suprimento não entram aqui, porque só mudam o dinheiro de lugar (gaveta ↔ cofre).
          </p>
        </>
      )}
    </div>
  );
}
