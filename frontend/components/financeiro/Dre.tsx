'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { carregarDre, hojeISO, formatarReais, CATEGORIAS } from '@/lib/queries/financeiroContas';

type Resultado = Awaited<ReturnType<typeof carregarDre>>;

function Linha({
  rotulo,
  valor,
  negativo,
  destaque,
  recuo,
}: {
  rotulo: string;
  valor: number;
  negativo?: boolean;
  destaque?: boolean;
  recuo?: boolean;
}) {
  return (
    <div
      className={
        'flex justify-between gap-3 px-3 py-2 ' +
        (destaque ? 'bg-[#F4F7F8] font-bold text-[#16252B]' : 'text-[#2B3C44]') +
        (recuo ? ' pl-7 text-sm' : '')
      }
    >
      <span>{rotulo}</span>
      <span
        className={
          'whitespace-nowrap ' + (negativo ? 'text-[#B3261E]' : destaque && valor < 0 ? 'text-[#B3261E]' : '')
        }
      >
        {negativo ? '− ' : ''}
        {formatarReais(valor)}
      </span>
    </div>
  );
}

export default function Dre() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [dre, setDre] = useState<Resultado | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!mes) return;
    setLoading(true);
    carregarDre(supabase, unidadeId, mes)
      .then((r) => {
        setDre(r);
        setErro(null);
      })
      .catch(() => setErro('Erro ao carregar o DRE. Confira se o arquivo 0016 foi rodado no Supabase.'))
      .finally(() => setLoading(false));
  }, [mes]);

  const categorias = CATEGORIAS.pagar;

  return (
    <div className="bg-white border border-[#DCE3E7] rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#16252B]">DRE — resultado do mês</h2>
          <p className="text-sm text-[#5B6B73]">Quanto o restaurante lucrou (ou perdeu) no mês</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="border border-[#C9D3D8] rounded-lg px-3 py-2 text-sm text-[#16252B] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
        />
      </div>

      {erro && <p className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</p>}

      {loading || !dre ? (
        !erro && <p className="text-sm text-[#5B6B73]">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
              <p className="text-xs text-[#5B6B73]">Faturamento</p>
              <p className="font-bold text-[#16252B]">{formatarReais(dre.faturamento)}</p>
            </div>
            <div
              className={
                'border rounded-lg p-3 ' +
                (dre.lucroLiquido < 0 ? 'bg-[#FADBD6] border-[#F2C2BB]' : 'bg-[#DDF1E4] border-[#B7DFC4]')
              }
            >
              <p className="text-xs text-[#5B6B73]">{dre.lucroLiquido < 0 ? 'Prejuízo' : 'Lucro líquido'}</p>
              <p className={'font-bold ' + (dre.lucroLiquido < 0 ? 'text-[#B3261E]' : 'text-[#1E6B3A]')}>
                {formatarReais(dre.lucroLiquido)}
              </p>
            </div>
            <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
              <p className="text-xs text-[#5B6B73]">Margem líquida</p>
              <p className="font-bold text-[#0E6B7E]">
                {dre.margemPct === null ? '—' : dre.margemPct.toFixed(1).replace('.', ',') + '%'}
              </p>
            </div>
          </div>

          <div className="border border-[#DCE3E7] rounded-lg divide-y divide-[#E6ECEF]">
            <Linha rotulo={`Vendas (${dre.quantidadeVendas} pedidos)`} valor={dre.faturamentoVendas} recuo />
            <Linha rotulo="Outras receitas (contas recebidas)" valor={dre.outrasReceitas} recuo />
            <Linha rotulo="= Faturamento" valor={dre.faturamento} destaque />
            <Linha rotulo="Custo dos produtos vendidos (CMV)" valor={dre.cmv} negativo recuo />
            <Linha rotulo="= Lucro bruto" valor={dre.lucroBruto} destaque />
            {dre.despesas.length === 0 ? (
              <p className="px-7 py-2 text-sm text-[#8FA0A8]">Nenhuma despesa paga neste mês</p>
            ) : (
              dre.despesas.map((d) => (
                <Linha
                  key={d.categoria}
                  rotulo={categorias[d.categoria] || d.categoria}
                  valor={d.valor}
                  negativo
                  recuo
                />
              ))
            )}
            <Linha rotulo="= Lucro líquido" valor={dre.lucroLiquido} destaque />
          </div>

          <div className="text-xs text-[#5B6B73] space-y-1">
            <p>
              <strong>CMV</strong> é o custo dos ingredientes e produtos que saíram do estoque nas vendas, usando o
              custo unitário atual cadastrado no Estoque.
            </p>
            <p>
              <strong>Despesas</strong> são as contas a pagar marcadas como pagas neste mês.
              {dre.comprasMercadoria > 0 &&
                ` Os ${formatarReais(dre.comprasMercadoria)} pagos a fornecedores de mercadoria não entram como despesa, porque essa mercadoria vai para o estoque e já é contada no CMV quando é vendida.`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
