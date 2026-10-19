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
      <div className="px-4 py-12 text-center">
        <p className="text-[#5B6B73]">Carregando...</p>
      </div>
    );
  }

  if (!solicitacao) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[#5B6B73]">Solicitação não encontrada</p>
      </div>
    );
  }

  const statusInfo = getStatusLabel(solicitacao.status);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/compras')} className="h-10 w-10 rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition">←</button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[#16252B]">Solicitação de compra</h1>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.cor}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-sm text-[#5B6B73]">{new Date(solicitacao.criado_em).toLocaleString('pt-BR')}</p>
          </div>
          {solicitacao.status !== 'recebido' && (
            <button
              onClick={() => setParaDeletar(true)}
              className="text-sm px-3 py-1.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] hover:bg-[#FADBD6] transition"
            >
              Excluir
            </button>
          )}
        </div>

        {/* Itens solicitados */}
        <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4">
          <h2 className="text-base font-semibold text-[#16252B] mb-3">Itens solicitados</h2>
          <div className="divide-y divide-[#E6ECEF]">
            {itens.map((item) => (
              <div key={item.id} className="flex justify-between py-2 text-sm">
                <span className="text-[#16252B]">{item.ingredientes?.nome}</span>
                <span className="text-[#5B6B73]">{item.quantidade} {item.unidade}</span>
              </div>
            ))}
          </div>
          {solicitacao.observacao && (
            <p className="text-sm text-[#5B6B73] mt-3 pt-3 border-t border-[#DCE3E7]">{solicitacao.observacao}</p>
          )}
        </div>

        {/* Cotações */}
        {(solicitacao.status === 'aguardando_cotacao' || solicitacao.status === 'cotado') && (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#16252B]">Cotações</h2>
              {!showCotacaoForm && (
                <button
                  onClick={() => setShowCotacaoForm(true)}
                  className="text-sm font-medium text-[#0E6B7E] hover:underline"
                >
                  + Adicionar cotação
                </button>
              )}
            </div>

            {cotacoes.length === 0 && !showCotacaoForm && (
              <p className="text-sm text-[#5B6B73] py-6 text-center">Nenhuma cotação ainda</p>
            )}

            {cotacoes.map((cot) => (
              <div key={cot.id} className="border border-[#DCE3E7] rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-[#16252B]">{cot.fornecedores?.nome}</span>
                  <span className="font-bold text-sm text-[#0E6B7E]">R$ {totalCotacao(cot).toFixed(2)}</span>
                </div>
                <button
                  onClick={() => aprovarFornecedor(cot.fornecedor_id)}
                  disabled={processando}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[#0E6B7E] bg-white text-[#0E6B7E] font-medium hover:bg-[#F1F8FA] disabled:opacity-50 transition"
                >
                  Aprovar este fornecedor
                </button>
              </div>
            ))}

            {showCotacaoForm && (
              <form onSubmit={handleSalvarCotacao} className="border-t border-[#DCE3E7] pt-4 mt-2 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[#2B3C44] mb-1">Fornecedor</label>
                  <select
                    value={fornecedorCotacao}
                    onChange={(e) => setFornecedorCotacao(e.target.value)}
                    className="w-full border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
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
                      <span className="text-sm text-[#2B3C44] flex-1">{item.ingredientes?.nome} ({item.quantidade} {item.unidade})</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="R$"
                        value={precos[item.id] || ''}
                        onChange={(e) => setPrecos({ ...precos, [item.id]: e.target.value })}
                        className="w-28 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
                      />
                    </div>
                  ))}
                </div>

                {erro && <p role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</p>}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={salvandoCotacao}
                    className="flex-1 bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                  >
                    {salvandoCotacao ? 'Salvando...' : 'Salvar cotação'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCotacaoForm(false); setErro(null); }}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition"
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
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4">
            <h2 className="text-base font-semibold text-[#16252B] mb-2">Fornecedor aprovado</h2>
            <p className="text-sm text-[#5B6B73] mb-3">{solicitacao.fornecedores?.nome}</p>
            <button
              onClick={marcarPedidoEnviado}
              disabled={processando}
              className="w-full bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              Marcar pedido como enviado
            </button>
          </div>
        )}

        {/* Pedido enviado -> recebido */}
        {solicitacao.status === 'pedido_enviado' && (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4">
            <h2 className="text-base font-semibold text-[#16252B] mb-2">Pedido enviado</h2>
            <p className="text-sm text-[#5B6B73] mb-3">Fornecedor: {solicitacao.fornecedores?.nome}</p>
            <button
              onClick={marcarRecebido}
              disabled={processando}
              className="w-full bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              Marcar como recebido (entra no estoque automaticamente)
            </button>
          </div>
        )}

        {/* Recebido */}
        {solicitacao.status === 'recebido' && (
          <div className="bg-[#D9F0E3] rounded-xl p-4 mb-4">
            <p className="text-sm text-[#1E6B3F] font-medium">Pedido recebido — itens já entraram no estoque automaticamente.</p>
          </div>
        )}
      </div>

      {paraDeletar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-[#16252B]">Excluir solicitação?</h2>
            <p className="text-sm text-[#5B6B73] mb-6">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={confirmarExclusao}
                disabled={processando}
                className="flex-1 bg-[#B3261E] hover:bg-[#971F18] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
              >
                {processando ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button
                onClick={() => setParaDeletar(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition"
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