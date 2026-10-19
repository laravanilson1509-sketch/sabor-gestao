'use client';

import { useState } from 'react';
import ConfigPrecificacao from '@/components/financeiro/ConfigPrecificacao';
import CustosFixos from '@/components/financeiro/CustosFixos';

export default function FinanceiroPage() {
  const [versao, setVersao] = useState(0);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#16252B]">Financeiro</h1>
          <p className="text-sm text-[#5B6B73]">Parâmetros de preço e custos fixos</p>
        </div>
        <ConfigPrecificacao onSalvo={() => setVersao((v) => v + 1)} />
        <CustosFixos versao={versao} />
      </div>
    </div>
  );
}