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

const corSaldo = (v: number) => (v < 0 ? 'text-[#B3261E]' : v > 0 ? 'text-[#1E6B3A]' : 'text-[#8FA0A8]');

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
    <div className="bg-white border border-[#DCE3E7] rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#16252B]">Fluxo de caixa</h2>
          <p className="text-sm text-[#5B6B73]">O que entrou e saiu em cada dia do mês</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="border border-[#C9D3D8] rounded-lg px-3 py-2 text-sm text-[#16252B] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
        />
      </div>

      {erro && <p className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</p>}

      {loading || !totais ? (
        !erro && <p className="text-sm text-[#5B6B73]">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
              <p className="text-xs text-[#5B6B73]">Vendas</p>
              <p className="font-bold text-[#16252B]">{formatarReais(totais.vendas)}</p>
            </div>
            <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
              <p className="text-xs text-[#5B6B73]">Contas recebidas</p>
              <p className="font-bold text-[#16252B]">{formatarReais(totais.recebidas)}</p>
            </div>
            <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
              <p className="text-xs text-[#5B6B73]">Contas pagas</p>
              <p className="font-bold text-[#B3261E]">− {formatarReais(totais.pagas)}</p>
            </div>
            <div className="bg-[#E3F1F4] border border-[#B9DCE3] rounded-lg p-3">
              <p className="text-xs text-[#5B6B73]">Saldo do mês</p>
              <p className={'font-bold ' + corSaldo(totais.saldo)}>{formatarReais(totais.saldo)}</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#2B3C44]">
            <input
              type="checkbox"
              checked={soComMovimento}
              onChange={(e) => setSoComMovimento(e.target.checked)}
              className="accent-[#0E6B7E]"
            />
            Mostrar só os dias com movimento
          </label>

          {visiveis.length === 0 ? (
            <p className="text-sm text-[#5B6B73]">Nenhum movimento neste mês</p>
          ) : (
            <div className="border border-[#DCE3E7] rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F4F7F8] text-xs text-[#5B6B73]">
                  <tr>
                    <th className="text-left font-medium p-2">Dia</th>
                    <th className="text-right font-medium p-2">Entradas</th>
                    <th className="text-right font-medium p-2">Saídas</th>
                    <th className="text-right font-medium p-2">Saldo do dia</th>
                    <th className="text-right font-medium p-2">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6ECEF]">
                  {visiveis.map((d) => (
                    <tr key={d.data}>
                      <td className="p-2 text-[#16252B] whitespace-nowrap">{formatarData(d.data).slice(0, 5)}</td>
                      <td className="p-2 text-right text-[#16252B] whitespace-nowrap">
                        {formatarReais(d.vendas + d.recebidas)}
                      </td>
                      <td className="p-2 text-right text-[#B3261E] whitespace-nowrap">
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

          <p className="text-xs text-[#5B6B73]">
            Entradas = vendas do PDV e delivery entregue + contas recebidas. Saídas = contas pagas. Sangria e
            suprimento não entram aqui, porque só mudam o dinheiro de lugar (gaveta ↔ cofre).
          </p>
        </>
      )}
    </div>
  );
}
