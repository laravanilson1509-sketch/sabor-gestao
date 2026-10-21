'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { listarImpressoras, erroImpressao, type Impressora } from '@/lib/queries/impressao';
import FilaImpressao from '@/components/impressao/FilaImpressao';
import EstacaoImpressao from '@/components/impressao/EstacaoImpressao';
import ConfigImpressoras from '@/components/impressao/ConfigImpressoras';
import ConfigConta from '@/components/impressao/ConfigConta';

type Aba = 'fila' | 'estacao' | 'impressoras' | 'conta';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'fila', rotulo: 'Fila' },
  { valor: 'estacao', rotulo: 'Estação de impressão' },
  { valor: 'impressoras', rotulo: 'Impressoras e setores' },
  { valor: 'conta', rotulo: 'Conta e equipe' },
];

export default function ImpressaoPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [aba, setAba] = useState<Aba>('fila');
  const [impressoras, setImpressoras] = useState<Impressora[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarImpressoras() {
    try {
      setImpressoras(await listarImpressoras(supabase, unidadeId));
      setErro(null);
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao carregar as impressoras'));
    }
  }

  // o "online" das impressoras muda com o tempo: recarrega de vez em quando
  useEffect(() => {
    carregarImpressoras();
    const t = setInterval(carregarImpressoras, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#16252B]">Impressão</h1>
          <p className="text-sm text-[#5B6B73]">Comandas por setor, pré-conta, comprovantes e regras da conta</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {ABAS.map((a) => (
            <button
              key={a.valor}
              onClick={() => setAba(a.valor)}
              className={
                'text-sm px-4 py-2 rounded-lg font-medium transition border ' +
                (aba === a.valor
                  ? 'bg-[#0E6B7E] text-white border-[#0E6B7E]'
                  : 'bg-white text-[#2B3C44] border-[#DCE3E7] hover:bg-[#F1F5F7]')
              }
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {erro && (
          <div role="alert" className="mb-4 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        {/* a estação continua montada nas outras abas, para não parar de imprimir */}
        <div className={aba === 'estacao' ? '' : 'hidden'}>
          <EstacaoImpressao supabase={supabase} unidadeId={unidadeId} impressoras={impressoras} />
        </div>
        {aba === 'fila' && (
          <FilaImpressao supabase={supabase} unidadeId={unidadeId} impressoras={impressoras} onMudou={carregarImpressoras} />
        )}
        {aba === 'impressoras' && (
          <ConfigImpressoras
            supabase={supabase}
            unidadeId={unidadeId}
            impressoras={impressoras}
            onImpressorasMudaram={carregarImpressoras}
          />
        )}
        {aba === 'conta' && <ConfigConta supabase={supabase} unidadeId={unidadeId} />}
      </div>
    </div>
  );
}
