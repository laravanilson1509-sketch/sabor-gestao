'use client';

import { useState } from 'react';
import ConfigPrecificacao from '@/components/financeiro/ConfigPrecificacao';
import CustosFixos from '@/components/financeiro/CustosFixos';
import Contas from '@/components/financeiro/Contas';
import FluxoCaixa from '@/components/financeiro/FluxoCaixa';
import Dre from '@/components/financeiro/Dre';

const ABAS = [
  { id: 'pagar', rotulo: 'Contas a pagar' },
  { id: 'receber', rotulo: 'Contas a receber' },
  { id: 'fluxo', rotulo: 'Fluxo de caixa' },
  { id: 'dre', rotulo: 'DRE (lucro)' },
  { id: 'precos', rotulo: 'Preços e custos fixos' },
] as const;

type Aba = (typeof ABAS)[number]['id'];

export default function FinanceiroPage() {
  const [aba, setAba] = useState<Aba>('pagar');
  const [versao, setVersao] = useState(0);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#16252B]">Financeiro</h1>
          <p className="text-sm text-[#5B6B73]">Contas, fluxo de caixa, resultado do mês e parâmetros de preço</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={
                'whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium border transition ' +
                (aba === a.id
                  ? 'bg-[#0E6B7E] border-[#0E6B7E] text-white'
                  : 'bg-white border-[#DCE3E7] text-[#2B3C44] hover:bg-[#F1F5F7]')
              }
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {aba === 'pagar' && <Contas key="pagar" tipo="pagar" />}
        {aba === 'receber' && <Contas key="receber" tipo="receber" />}
        {aba === 'fluxo' && <FluxoCaixa />}
        {aba === 'dre' && <Dre />}
        {aba === 'precos' && (
          <>
            <ConfigPrecificacao onSalvo={() => setVersao((v) => v + 1)} />
            <CustosFixos versao={versao} />
          </>
        )}
      </div>
    </div>
  );
}
