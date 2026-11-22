'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ConfigPrecificacao from '@/components/financeiro/ConfigPrecificacao';
import CustosFixos from '@/components/financeiro/CustosFixos';
import Contas from '@/components/financeiro/Contas';
import FluxoCaixa from '@/components/financeiro/FluxoCaixa';
import Dre from '@/components/financeiro/Dre';
import PainelFinanceiro from '@/components/financeiro/PainelFinanceiro';

import { ABAS_FINANCEIRO as ABAS, type AbaFinanceiro } from '@/lib/navegacao';

// A aba é a última parte do endereço (/financeiro/pagar), então o menu lateral abre cada uma direto.
export default function TelaFinanceiro() {
  const pathname = usePathname() || '';
  const parte = pathname.split('/')[2] as AbaFinanceiro | undefined;
  const aba: AbaFinanceiro = ABAS.some((a) => a.id === parte) ? parte! : 'painel';
  const [versao, setVersao] = useState(0);

  return (
    <div className="p-4 md:p-8">
      <div className={(aba === 'painel' ? 'max-w-6xl' : 'max-w-4xl') + ' mx-auto space-y-6'}>
        <div>
          <h1 className="text-2xl font-bold text-ink">Financeiro</h1>
          <p className="text-sm text-ink-muted">Painel, contas, fluxo de caixa, resultado do mês e parâmetros de preço</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={'/financeiro/' + a.id}
              aria-current={aba === a.id ? 'page' : undefined}
              className={
                'whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium border transition ' +
                (aba === a.id
                  ? 'bg-accent border-accent text-accent-contrast'
                  : 'bg-surface border-line text-ink-soft hover:bg-surface-hover')
              }
            >
              {a.rotulo}
            </Link>
          ))}
        </div>

        {aba === 'painel' && <PainelFinanceiro />}
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
