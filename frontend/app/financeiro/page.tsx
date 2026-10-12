'use client';

import { useState } from 'react';
import ConfigPrecificacao from '@/components/financeiro/ConfigPrecificacao';
import CustosFixos from '@/components/financeiro/CustosFixos';

export default function FinanceiroPage() {
  const [versao, setVersao] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">💰 Financeiro</h1>
        <ConfigPrecificacao onSalvo={() => setVersao((v) => v + 1)} />
        <CustosFixos versao={versao} />
      </div>
    </div>
  );
}