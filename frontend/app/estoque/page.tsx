'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  getEstoqueComStatus,
  registrarMovimentacao,
  deletarIngrediente,
  calcularStatus,
  getStatusDisplay,
} from '@/lib/queries/estoque';

type ItemEstoque = {
  id: string;
  quantidade_disponivel: number;
  custo_unitario: number;
  estoque_minimo: number;
  unidade: string;
  ingredientes: { id: string; nome: string; tipo_produto: string; ativo: boolean } | null;
};

export default function EstoquePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'consumo' | 'acabado'>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('ativo');

  // modal de movimentação
  const [itemMovimentacao, setItemMovimentacao] = useState<ItemEstoque | null>(null);
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'entrada' | 'consumo'>('entrada');
  const [qtdMov, setQtdMov] = useState('');
  const [obsMov, setObsMov] = useState('');

  // modal de histórico
  const [showHistorico, setShowHistorico] = useState<ItemEstoque | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);

  // modal de confirmação de exclusão
  const [itemParaDeletar, setItemParaDeletar] = useState<ItemEstoque | null>(null);
  const [deletando, setDeletando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const data = await getEstoqueComStatus(supabase, unidadeId, {
        tipo: filtroTipo,
        ativo: filtroAtivo,
      });
      setItens(data as any);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [filtroTipo, filtroAtivo]);

  async function handleMovimentacao(e: React.FormEvent) {
    e.preventDefault();
    if (!itemMovimentacao?.ingredientes || !qtdMov) return;
    try {
      await registrarMovimentacao(supabase, {
        ingrediente_id: itemMovimentacao.ingredientes.id,
        unidade_id: unidadeId,
        tipo: tipoMovimentacao,
        quantidade: parseFloat(qtdMov),
        observacao: obsMov,
      });
      setItemMovimentacao(null);
      setQtdMov('');
      setObsMov('');
      await carregar();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function abrirHistorico(item: ItemEstoque) {
    setShowHistorico(item);
    const { data } = await supabase
      .from('movimentacoes_estoque')
      .select('*')
      .eq('ingrediente_id', item.ingredientes?.id)
      .order('criado_em', { ascending: false })
      .limit(20);
    setHistorico(data || []);
  }

  async function confirmarExclusao() {
    if (!itemParaDeletar?.ingredientes) return;
    setDeletando(true);
    try {
      await deletarIngrediente(supabase, itemParaDeletar.ingredientes.id);
      setItemParaDeletar(null);
      await carregar();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setDeletando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">📦 Estoque</h1>
          <Link
            href="/estoque/cadastro"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            + Novo produto
          </Link>
        </div>

        {/* FILTROS */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <div className="flex gap-1">
              {(['todos', 'consumo', 'acabado'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                    filtroTipo === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'todos' ? 'Todos' : t === 'consumo' ? '🧂 Consumo' : '🍕 Acabado'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <div className="flex gap-1">
              {(['todos', 'ativo', 'inativo'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFiltroAtivo(s)}
                  className={`text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                    filtroAtivo === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'todos' ? 'Todos' : s === 'ativo' ? '✅ Ativos' : '⏸️ Inativos'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-12 text-gray-600">Carregando...</p>
        ) : itens.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">Nenhum item encontrado</p>
            <p className="text-sm text-gray-500 mt-2">
              Tenta mudar os filtros ou cadastra um novo produto
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Produto</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Tipo</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Quantidade</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Mínimo</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Custo (R$)</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total (R$)</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itens.map((item) => {
                  const total = (item.quantidade_disponivel || 0) * (item.custo_unitario || 0);
                  const status = calcularStatus(item.quantidade_disponivel, item.estoque_minimo);
                  const statusInfo = getStatusDisplay(status);
                  const inativo = item.ingredientes?.ativo === false;

                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 ${inativo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-4 text-sm">
                        <span className={statusInfo.cor}>
                          {statusInfo.emoji} {statusInfo.label}
                        </span>
                        {inativo && <span className="ml-1 text-xs text-gray-400">(inativo)</span>}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {item.ingredientes?.nome || 'N/A'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {item.ingredientes?.tipo_produto === 'acabado' ? '🍕 Acabado' : '🧂 Consumo'}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">
                        {item.quantidade_disponivel?.toFixed(2)} {item.unidade}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-500">
                        {item.estoque_minimo?.toFixed(2)} {item.unidade}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-gray-600">
                        R$ {(item.custo_unitario || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-gray-900">
                        R$ {total.toFixed(2)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1 justify-center flex-wrap">
                          <button
                            onClick={() => { setItemMovimentacao(item); setTipoMovimentacao('entrada'); }}
                            className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded"
                            title="Registrar entrada"
                          >
                            ➕
                          </button>
                          <button
                            onClick={() => { setItemMovimentacao(item); setTipoMovimentacao('consumo'); }}
                            className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded"
                            title="Registrar consumo"
                          >
                            ➖
                          </button>
                          <button
                            onClick={() => abrirHistorico(item)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                            title="Ver histórico"
                          >
                            📋
                          </button>
                          <Link
                            href={`/estoque/cadastro?id=${item.ingredientes?.id}`}
                            className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded"
                            title="Editar"
                          >
                            ✏️
                          </Link>
                          <button
                            onClick={() => setItemParaDeletar(item)}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Entrada/Consumo */}
      {itemMovimentacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <form onSubmit={handleMovimentacao} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">
              {tipoMovimentacao === 'entrada' ? '➕ Entrada' : '➖ Consumo'} — {itemMovimentacao.ingredientes?.nome}
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantidade ({itemMovimentacao.unidade})
              </label>
              <input
                type="number"
                step="0.01"
                value={qtdMov}
                onChange={(e) => setQtdMov(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observação (opcional)
              </label>
              <input
                type="text"
                value={obsMov}
                onChange={(e) => setObsMov(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Uso no almoço de segunda"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium">
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => { setItemMovimentacao(null); setQtdMov(''); setObsMov(''); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Histórico */}
      {showHistorico && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">📋 Histórico — {showHistorico.ingredientes?.nome}</h2>
              <button onClick={() => setShowHistorico(null)} className="text-gray-500 hover:text-gray-700 text-xl">✕</button>
            </div>
            {historico.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhuma movimentação ainda</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-right">Quantidade</th>
                    <th className="px-3 py-2 text-left">Observação</th>
                    <th className="px-3 py-2 text-left">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historico.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{mov.tipo === 'entrada' ? '➕ Entrada' : '➖ Consumo'}</td>
                      <td className="px-3 py-2 text-right">{mov.quantidade}</td>
                      <td className="px-3 py-2 text-gray-500">{mov.observacao || '-'}</td>
                      <td className="px-3 py-2 text-gray-500">{new Date(mov.criado_em).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de exclusão */}
      {itemParaDeletar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-red-700">🗑️ Excluir produto?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Tem certeza que quer excluir <strong>{itemParaDeletar.ingredientes?.nome}</strong>?
              Isso vai apagar o produto, o estoque e todo o histórico de movimentações. Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmarExclusao}
                disabled={deletando}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium"
              >
                {deletando ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button
                onClick={() => setItemParaDeletar(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}