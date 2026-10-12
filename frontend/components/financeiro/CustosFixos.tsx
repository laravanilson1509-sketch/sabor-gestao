'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  listarCustosFixos,
  criarCustoFixo,
  atualizarCustoFixo,
  deletarCustoFixo,
  getConfigFinanceira,
  calcularCustoFixoPorPrato,
  type CustoFixo,
} from '@/lib/queries/financeiro';

export default function CustosFixos({ versao }: { versao: number }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [custos, setCustos] = useState<CustoFixo[]>([]);
  const [vendas, setVendas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');

  async function carregar() {
    try {
      const lista = await listarCustosFixos(supabase, unidadeId);
      setCustos(lista);
      const cfg = await getConfigFinanceira(supabase, unidadeId);
      setVendas(cfg.vendas_previstas_mes);
    } catch (err) {
      setErro('Erro ao carregar os custos fixos');
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [versao]);

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const v = parseFloat(valor);
    if (!nome.trim() || isNaN(v) || v < 0) {
      setErro('Informe o nome e um valor mensal valido.');
      return;
    }
    setSalvando(true);
    try {
      await criarCustoFixo(supabase, {
        unidade_id: unidadeId,
        nome: nome.trim(),
        valor_mensal: v,
      });
      setNome('');
      setValor('');
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(c: CustoFixo) {
    try {
      await atualizarCustoFixo(supabase, c.id, { ativo: !c.ativo });
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  }

  async function excluir(c: CustoFixo) {
    if (!window.confirm('Excluir o custo fixo "' + c.nome + '"?')) return;
    try {
      await deletarCustoFixo(supabase, c.id);
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  }

  const resumo = calcularCustoFixoPorPrato(custos, vendas);

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-6 text-gray-600">Carregando...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Custos fixos mensais</h2>
        <p className="text-sm text-gray-500">Aluguel, energia, salarios, internet...</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total ativo / mes</p>
          <p className="font-bold text-gray-900">R$ {resumo.total.toFixed(2)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Vendas previstas</p>
          <p className="font-bold text-gray-900">{vendas}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Custo fixo por prato</p>
          <p className="font-bold text-blue-600">R$ {resumo.porPrato.toFixed(2)}</p>
        </div>
      </div>
      {vendas === 0 && (
        <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-2">
          Defina as vendas previstas por mes nos parametros acima para o rateio funcionar.
        </p>
      )}

      {custos.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum custo fixo cadastrado</p>
      ) : (
        <div className="divide-y border rounded-lg">
          {custos.map((c) => (
            <div key={c.id} className={'flex items-center justify-between p-3 ' + (c.ativo ? '' : 'opacity-50')}>
              <div>
                <p className="text-sm font-medium text-gray-900">{c.nome}</p>
                <p className="text-xs text-gray-500">R$ {c.valor_mensal.toFixed(2)} por mes</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => alternarAtivo(c)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                >
                  {c.ativo ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  onClick={() => excluir(c)}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdicionar} className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Aluguel"
          className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Valor mensal"
          className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={salvando}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {salvando ? 'Salvando...' : '+ Adicionar'}
        </button>
      </form>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}