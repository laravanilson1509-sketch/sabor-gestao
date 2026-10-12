'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { getConfigFinanceira, salvarConfigFinanceira } from '@/lib/queries/financeiro';

function Campo(props: {
  rotulo: string;
  dica: string;
  valor: string;
  sufixo: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{props.rotulo}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={props.valor}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <span className="text-sm text-gray-500">{props.sufixo}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1">{props.dica}</p>
    </div>
  );
}

export default function ConfigPrecificacao({ onSalvo }: { onSalvo: () => void }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [margem, setMargem] = useState('50');
  const [impostos, setImpostos] = useState('0');
  const [cartao, setCartao] = useState('0');
  const [app, setApp] = useState('0');
  const [vendas, setVendas] = useState('0');

  useEffect(() => {
    async function carregar() {
      try {
        const c = await getConfigFinanceira(supabase, unidadeId);
        setMargem(String(c.margem_lucro_pct));
        setImpostos(String(c.impostos_pct));
        setCartao(String(c.taxa_cartao_pct));
        setApp(String(c.taxa_app_pct));
        setVendas(String(c.vendas_previstas_mes));
      } catch (err) {
        setErro('Erro ao carregar os parametros');
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  const soma =
    (parseFloat(margem) || 0) +
    (parseFloat(impostos) || 0) +
    (parseFloat(cartao) || 0) +
    (parseFloat(app) || 0);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setMsg(null);

    if (soma >= 100) {
      setErro('A soma de margem, impostos e taxas precisa ser menor que 100%.');
      return;
    }

    setSalvando(true);
    try {
      await salvarConfigFinanceira(supabase, {
        unidade_id: unidadeId,
        margem_lucro_pct: parseFloat(margem) || 0,
        impostos_pct: parseFloat(impostos) || 0,
        taxa_cartao_pct: parseFloat(cartao) || 0,
        taxa_app_pct: parseFloat(app) || 0,
        vendas_previstas_mes: parseFloat(vendas) || 0,
      });
      setMsg('Parametros salvos.');
      onSalvo();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-6 text-gray-600">Carregando...</div>;
  }

  return (
    <form onSubmit={handleSalvar} className="bg-white rounded-lg shadow p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Parametros de preco</h2>
        <p className="text-sm text-gray-500">
          Valem para todas as fichas tecnicas. O preco sugerido divide o custo por (1 - soma dos percentuais).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Campo rotulo="Margem de lucro" sufixo="%" valor={margem} onChange={setMargem}
          dica="Percentual do preco de venda que sobra como lucro" />
        <Campo rotulo="Impostos" sufixo="%" valor={impostos} onChange={setImpostos}
          dica="Ex: Simples Nacional sobre o faturamento" />
        <Campo rotulo="Taxa de cartao" sufixo="%" valor={cartao} onChange={setCartao}
          dica="Use a media: se metade das vendas e no cartao a 3%, coloque 1,5" />
        <Campo rotulo="Taxa de apps de delivery" sufixo="%" valor={app} onChange={setApp}
          dica="Comissao media do iFood e similares sobre todas as vendas" />
        <Campo rotulo="Vendas previstas por mes" sufixo="pratos" valor={vendas} onChange={setVendas}
          dica="Usado para ratear os custos fixos entre os pratos" />
      </div>

      <p className={'text-sm font-medium ' + (soma >= 100 ? 'text-red-600' : 'text-gray-700')}>
        Soma dos percentuais: {soma.toFixed(2)}%
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium"
      >
        {salvando ? 'Salvando...' : 'Salvar parametros'}
      </button>
    </form>
  );
}