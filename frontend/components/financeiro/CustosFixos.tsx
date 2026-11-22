'use client';

import { useEffect, useState } from 'react';
import { moeda } from '@/lib/numeros';
import CampoMoeda from '@/components/CampoMoeda';
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
    if (!nome.trim() || isNaN(v) || v <= 0) {
      setErro('Informe o nome e um valor mensal válido.');
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
    return <div className="bg-surface border border-line rounded-xl p-6 text-sm text-ink-muted">Carregando...</div>;
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink">Custos fixos mensais</h2>
        <p className="text-sm text-ink-muted">Aluguel, energia, salários, internet...</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-surface-hover border border-line rounded-lg p-3">
          <p className="text-xs text-ink-muted">Total ativo / mês</p>
          <p className="font-bold text-ink">{moeda(resumo.total)}</p>
        </div>
        <div className="bg-surface-hover border border-line rounded-lg p-3">
          <p className="text-xs text-ink-muted">Vendas previstas</p>
          <p className="font-bold text-ink">{vendas}</p>
        </div>
        <div className="bg-surface-hover border border-line rounded-lg p-3">
          <p className="text-xs text-ink-muted">Custo fixo por prato</p>
          <p className="font-bold text-accent">{moeda(resumo.porPrato)}</p>
        </div>
      </div>
      {vendas === 0 && (
        <p className="text-xs text-warning bg-warning-soft border border-warning-line rounded-lg px-3 py-2">
          Defina as vendas previstas por mês nos parâmetros acima para o rateio funcionar.
        </p>
      )}

      {custos.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum custo fixo cadastrado</p>
      ) : (
        <div className="divide-y divide-line-soft border border-line rounded-lg">
          {custos.map((c) => (
            <div key={c.id} className={'flex items-center justify-between p-3 ' + (c.ativo ? '' : 'opacity-50')}>
              <div>
                <p className="text-sm font-medium text-ink">{c.nome}</p>
                <p className="text-xs text-ink-muted">{moeda(c.valor_mensal)} por mês</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => alternarAtivo(c)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-line bg-surface text-ink-soft font-medium hover:bg-surface-hover transition"
                >
                  {c.ativo ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  onClick={() => excluir(c)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-danger-line bg-surface text-danger font-medium hover:bg-danger-soft transition"
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
          className="flex-1 min-w-40 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <CampoMoeda
          value={valor}
          onChange={setValor}
          placeholder="Ex: 4.000,00"
          className="w-36 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={salvando}
          className="btn btn-primario"
        >
          {salvando ? 'Salvando...' : '+ Adicionar'}
        </button>
      </form>

      {erro && <p className="text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">{erro}</p>}
    </div>
  );
}