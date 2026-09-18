'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  buscarSolicitacao,
  criarCotacao,
  atualizarStatusSolicitacao,
  deletarSolicitacao,
  getStatusLabel,
} from '@/lib/queries/compras';

type Fornecedor = { id: string; nome: string };

export default function DetalheSolicitacaoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(true);
  const [solicitacao, setSolicitacao] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [cotacoes, setCotacoes] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [fornecedorCotacao, setFornecedorCotacao] = useState('');
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [salvandoCotacao, setSalvandoCotacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [paraDeletar, setParaDeletar] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const dados = await buscarSolicitacao(supabase, id);
      setSolicitacao(dados.solicitacao);
      setItens(dados.itens);
      setCotacoes(dados.cotacoes);

      const { data: forns } = await supabase
        .from('fornecedores')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      setFornecedores(forns || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [id]);

  async function handleSalvarCotacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!fornecedorCotacao) { setErro('Escolhe um fornecedor.'); return; }

    const precosPreenchidos = itens.every((item) => precos[item.id] && parseFloat(precos[item.id]) >= 0);
    if (!precosPreenchidos) { setErro('Preenche o preço de todos os itens.'); return; }

    setSalvandoCotacao(true);
    try {
      await criarCotacao(supabase, {
        solicitacao_id: id,
        fornecedor_id: fornecedorCotacao,
        precos: itens.map((item) => ({
          solicitacao_item_id: item.id,
          preco_unitario: parseFloat(precos[item.id]),
        })),
      });
      setShowCotacaoForm(false);
      setFornecedorCotacao('');
      setPrecos({});
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar cotação');
    } finally {
      setSalvandoCotacao(false);
    }
  }

  async function aprovarFornecedor(fornecedorId: string) {
    setProcessando(true);
    try {
      await atualizarStatusSolicitacao(supabase, id, 'aprovado', fornecedorId);
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setProcessando(false);
    }
  }

  async function marcarPedidoEnviado() {
    setProcessando(true);
    try {
      await atualizarStatusSolicitacao(supabase, id, 'pedido_enviado');
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setProcessando(false);
    }
  }

  async function marcarRecebido() {
    setProcessando(true);
    try {
      await atualizarStatusSolicitacao(supabase, id, 'recebido');
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarExclusao() {
    setProcessando(true);
    try {
      await deletarSolicitacao(supabase, id);
      router.push('/compras');
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setProcessando(false);
    }
  }

  function totalCotacao(cotacao: any) {
    return cotacao.cotacoes_itens.reduce((acc: number, ci: any) => acc + Number(ci.preco_unitario), 0);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  if (!solicitacao) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Solicitação não encontrada</p>
      </div>
    );
  }

  const statusInfo = getStatusLabel(solicitacao.status);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/compras')} className="text-gray-500 hover:text-gray-700 text-xl">←</button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Solicitação de compra</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.cor}`}>
                {statusInfo.emoji} {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-gray-400">{new Date(solicitacao.criado_em).toLocaleString('pt-BR')}</p>
          </div>
          {solicitacao.status !== 'recebido' && (
            <button
              onClick={() => setParaDeletar(true)}
              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg"
            >
              🗑️ Excluir
            </button>
          )}
        </div>

        {/* Itens solicitados */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">📝 Itens solicitados</h2>
          <div className="space-y-1">
            {itens.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.ingredientes?.nome}</span>
                <span className="text-gray-500">{item.quantidade} {item.unidade}</span>
              </div>
            ))}
          </div>
          {solicitacao.observacao && (
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t">{solicitacao.observacao}</p>
          )}
        </div>

        {/* Cotações */}
        {(solicitacao.status === 'aguardando_cotacao' || solicitacao.status === 'cotado') && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">💰 Cotações</h2>
              {!showCotacaoForm && (
                <button
                  onClick={() => setShowCotacaoForm(true)}
                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg"
                >
                  + Adicionar cotação
                </button>
              )}
            </div>

            {cotacoes.length === 0 && !showCotacaoForm && (
              <p className="text-sm text-gray-500">Nenhuma cotação ainda</p>
            )}

            {cotacoes.map((cot) => (
              <div key={cot.id} className="border rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{cot.fornecedores?.nome}</span>
                  <span className="font-bold text-sm">R$ {totalCotacao(cot).toFixed(2)}</span>
                </div>
                <button
                  onClick={() => aprovarFornecedor(cot.fornecedor_id)}
                  disabled={processando}
                  className="w-full text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 py-1.5 rounded-lg font-medium disabled:opacity-50"
                >
                  ✅ Aprovar este fornecedor
                </button>
              </div>
            ))}

            {showCotacaoForm && (
              <form onSubmit={handleSalvarCotacao} className="border-t pt-4 mt-2 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                  <select
                    value={fornecedorCotacao}
                    onChange={(e) => setFornecedorCotacao(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {itens.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm flex-1">{item.ingredientes?.nome} ({item.quantidade} {item.unidade})</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="R$"
                        value={precos[item.id] || ''}
                        onChange={(e) => setPrecos({ ...precos, [item.id]: e.target.value })}
                        className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                  ))}
                </div>

                {erro && <p className="text-xs text-red-600">{erro}</p>}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={salvandoCotacao}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
                  >
                    {salvandoCotacao ? 'Salvando...' : 'Salvar cotação'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCotacaoForm(false); setErro(null); }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Aprovado -> pedido enviado */}
        {solicitacao.status === 'aprovado' && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-2">✅ Fornecedor aprovado</h2>
            <p className="text-sm text-gray-600 mb-3">{solicitacao.fornecedores?.nome}</p>
            <button
              onClick={marcarPedidoEnviado}
              disabled={processando}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium"
            >
              📤 Marcar pedido como enviado
            </button>
          </div>
        )}

        {/* Pedido enviado -> recebido */}
        {solicitacao.status === 'pedido_enviado' && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-2">📤 Pedido enviado</h2>
            <p className="text-sm text-gray-600 mb-3">Fornecedor: {solicitacao.fornecedores?.nome}</p>
            <button
              onClick={marcarRecebido}
              disabled={processando}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium"
            >
              📦 Marcar como recebido (entra no estoque automaticamente)
            </button>
          </div>
        )}

        {/* Recebido */}
        {solicitacao.status === 'recebido' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-700 font-medium">📦 Pedido recebido — itens já entraram no estoque automaticamente.</p>
          </div>
        )}
      </div>

      {paraDeletar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-red-700">🗑️ Excluir solicitação?</h2>
            <p className="text-sm text-gray-600 mb-6">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={confirmarExclusao}
                disabled={processando}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium"
              >
                {processando ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button
                onClick={() => setParaDeletar(false)}
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