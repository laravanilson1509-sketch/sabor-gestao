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
    return <div className="bg-white border border-[#DCE3E7] rounded-xl p-6 text-sm text-[#5B6B73]">Carregando...</div>;
  }

  return (
    <div className="bg-white border border-[#DCE3E7] rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#16252B]">Custos fixos mensais</h2>
        <p className="text-sm text-[#5B6B73]">Aluguel, energia, salarios, internet...</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
          <p className="text-xs text-[#5B6B73]">Total ativo / mes</p>
          <p className="font-bold text-[#16252B]">R$ {resumo.total.toFixed(2)}</p>
        </div>
        <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
          <p className="text-xs text-[#5B6B73]">Vendas previstas</p>
          <p className="font-bold text-[#16252B]">{vendas}</p>
        </div>
        <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
          <p className="text-xs text-[#5B6B73]">Custo fixo por prato</p>
          <p className="font-bold text-[#0E6B7E]">R$ {resumo.porPrato.toFixed(2)}</p>
        </div>
      </div>
      {vendas === 0 && (
        <p className="text-xs text-[#7A5A0A] bg-[#FFF0C7] border border-[#E8D28A] rounded-lg px-3 py-2">
          Defina as vendas previstas por mes nos parametros acima para o rateio funcionar.
        </p>
      )}

      {custos.length === 0 ? (
        <p className="text-sm text-[#5B6B73]">Nenhum custo fixo cadastrado</p>
      ) : (
        <div className="divide-y divide-[#E6ECEF] border border-[#DCE3E7] rounded-lg">
          {custos.map((c) => (
            <div key={c.id} className={'flex items-center justify-between p-3 ' + (c.ativo ? '' : 'opacity-50')}>
              <div>
                <p className="text-sm font-medium text-[#16252B]">{c.nome}</p>
                <p className="text-xs text-[#5B6B73]">R$ {c.valor_mensal.toFixed(2)} por mes</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => alternarAtivo(c)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] font-medium hover:bg-[#F1F5F7] transition"
                >
                  {c.ativo ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  onClick={() => excluir(c)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] font-medium hover:bg-[#FADBD6] transition"
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
          className="flex-1 min-w-40 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Valor mensal"
          className="w-36 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
        />
        <button
          type="submit"
          disabled={salvando}
          className="bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          {salvando ? 'Salvando...' : '+ Adicionar'}
        </button>
      </form>

      {erro && <p className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</p>}
    </div>
  );
}