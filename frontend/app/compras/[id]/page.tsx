'use client';

import { useEffect, useState } from 'react';
import { ConteudoVoltar } from '@/components/BotaoVoltar';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  buscarSolicitacao,
  buscarRecebimento,
  criarCotacao,
  deletarCotacao,
  atualizarStatusSolicitacao,
  deletarSolicitacao,
  getStatusLabel,
} from '@/lib/queries/compras';
import ComparativoCotacoes from '@/components/compras/ComparativoCotacoes';
import ConferenciaRecebimento from '@/components/compras/ConferenciaRecebimento';
import { moeda, qtd } from '@/components/pdv/estilos';

type Fornecedor = { id: string; nome: string };

const INPUT =
  'w-full border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]';

const dataBr = (d: string) => d.split('-').reverse().join('/');

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
  const [recebido, setRecebido] = useState<{ recebimento: any; itens: any[] } | null>(null);

  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [fornecedorCotacao, setFornecedorCotacao] = useState('');
  const [prazo, setPrazo] = useState('');
  const [condicoes, setCondicoes] = useState('');
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [salvandoCotacao, setSalvandoCotacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [paraDeletar, setParaDeletar] = useState(false);
  const [mostrarRecebimento, setMostrarRecebimento] = useState(false);

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

      setRecebido(dados.solicitacao.status === 'recebido' ? await buscarRecebimento(supabase, id) : null);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [id]);

  function novaCotacao() {
    setFornecedorCotacao('');
    setPrazo('');
    setCondicoes('');
    setPrecos({});
    setErro(null);
    setShowCotacaoForm(true);
  }

  // abre o formulário já com os dados da cotação para corrigir
  function refazerCotacao(cot: any) {
    setFornecedorCotacao(cot.fornecedor_id);
    setPrazo(cot.prazo_entrega_dias === null || cot.prazo_entrega_dias === undefined ? '' : String(cot.prazo_entrega_dias));
    setCondicoes(cot.condicoes_pagamento || '');
    setPrecos(
      Object.fromEntries(cot.cotacoes_itens.map((ci: any) => [ci.solicitacao_item_id, String(Number(ci.preco_unitario))]))
    );
    setErro(null);
    setShowCotacaoForm(true);
  }

  async function handleSalvarCotacao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!fornecedorCotacao) { setErro('Escolha um fornecedor.'); return; }

    const precosPreenchidos = itens.every((item) => precos[item.id] !== undefined && precos[item.id] !== '' && parseFloat(precos[item.id]) >= 0);
    if (!precosPreenchidos) { setErro('Preencha o preço de todos os itens.'); return; }

    setSalvandoCotacao(true);
    try {
      await criarCotacao(supabase, {
        solicitacao_id: id,
        fornecedor_id: fornecedorCotacao,
        prazo_entrega_dias: prazo === '' ? null : Math.max(0, parseInt(prazo, 10) || 0),
        condicoes_pagamento: condicoes,
        precos: itens.map((item) => ({
          solicitacao_item_id: item.id,
          preco_unitario: parseFloat(precos[item.id]),
        })),
      });
      setShowCotacaoForm(false);
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar cotação');
    } finally {
      setSalvandoCotacao(false);
    }
  }

  async function executar(fn: () => Promise<void>) {
    setProcessando(true);
    setErro(null);
    try {
      await fn();
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro');
    } finally {
      setProcessando(false);
    }
  }

  const aprovarFornecedor = (fornecedorId: string) =>
    executar(() => atualizarStatusSolicitacao(supabase, id, 'aprovado', fornecedorId));
  const marcarPedidoEnviado = () => executar(() => atualizarStatusSolicitacao(supabase, id, 'pedido_enviado'));
  const excluirCotacao = (cotacaoId: string) => {
    if (!window.confirm('Excluir esta cotação?')) return;
    return executar(() => deletarCotacao(supabase, cotacaoId, id));
  };
  // volta para a fase de cotações (trocou de ideia sobre o fornecedor)
  const voltarParaCotacao = () => {
    if (!window.confirm('Voltar para as cotações e escolher outro fornecedor?')) return;
    return executar(() => atualizarStatusSolicitacao(supabase, id, 'cotado'));
  };

  async function copiarPedido() {
    const linhas = itens.map((i) => `• ${i.ingredientes?.nome}: ${qtd(i.quantidade)} ${i.unidade}`);
    const texto = `Olá! Pedido de compra:\n\n${linhas.join('\n')}${solicitacao?.observacao ? '\n\nObs: ' + solicitacao.observacao : ''}\n\nPode confirmar o prazo de entrega?`;
    try {
      await navigator.clipboard.writeText(texto);
      setAviso('Pedido copiado. É só colar no WhatsApp ou e-mail do fornecedor.');
    } catch {
      setAviso(null);
      window.prompt('Copie o pedido:', texto);
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

  if (loading && !solicitacao) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[#5B6B73]">Carregando...</p>
      </div>
    );
  }

  if (!solicitacao) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[#5B6B73]">Solicitação não encontrada. Se as Compras são novas por aqui, falta rodar o SQL 0021_compras.sql no Supabase.</p>
      </div>
    );
  }

  const statusInfo = getStatusLabel(solicitacao.status);
  const podeCotar = solicitacao.status === 'aguardando_cotacao' || solicitacao.status === 'cotado';
  const podeReceber = solicitacao.status === 'pedido_enviado' || (solicitacao.status === 'aprovado' && mostrarRecebimento);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/compras')} className="btn-voltar"><ConteudoVoltar /></button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[#16252B]">Solicitação de compra</h1>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.cor}`}>
                {statusInfo.label}
              </span>
              {solicitacao.origem === 'sugestao' && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FFF0C7] text-[#7A5A0A]">
                  sugerida pelo estoque
                </span>
              )}
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

        {erro && !showCotacaoForm && (
          <div role="alert" className="mb-4 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</div>
        )}
        {aviso && <div className="mb-4 text-sm text-[#1E6B3F] bg-[#D9F0E3] rounded-lg px-3 py-2">{aviso}</div>}

        {/* Itens solicitados */}
        <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4">
          <h2 className="text-base font-semibold text-[#16252B] mb-3">Itens solicitados</h2>
          <div className="divide-y divide-[#E6ECEF]">
            {itens.map((item) => (
              <div key={item.id} className="flex justify-between py-2 text-sm">
                <span className="text-[#16252B]">{item.ingredientes?.nome}</span>
                <span className="text-[#5B6B73]">{qtd(item.quantidade)} {item.unidade}</span>
              </div>
            ))}
          </div>
          {solicitacao.observacao && (
            <p className="text-sm text-[#5B6B73] mt-3 pt-3 border-t border-[#DCE3E7]">{solicitacao.observacao}</p>
          )}
        </div>

        {/* Cotações */}
        {podeCotar && (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#16252B]">Cotações</h2>
              {!showCotacaoForm && (
                <button onClick={novaCotacao} className="text-sm font-medium text-[#0E6B7E] hover:underline">
                  + Adicionar cotação
                </button>
              )}
            </div>

            {cotacoes.length === 0 && !showCotacaoForm && (
              <p className="text-sm text-[#5B6B73] py-6 text-center">
                Nenhuma cotação ainda. Peça preço para mais de um fornecedor e compare aqui.
              </p>
            )}

            <ComparativoCotacoes
              itens={itens}
              cotacoes={cotacoes}
              processando={processando}
              onAprovar={aprovarFornecedor}
              onExcluir={excluirCotacao}
              onRefazer={refazerCotacao}
            />

            {showCotacaoForm && (
              <form onSubmit={handleSalvarCotacao} className="border-t border-[#DCE3E7] pt-4 mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[#2B3C44] mb-1">Fornecedor</label>
                  <select value={fornecedorCotacao} onChange={(e) => setFornecedorCotacao(e.target.value)} className={INPUT}>
                    <option value="">Selecione...</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                  {fornecedores.length === 0 && (
                    <p className="text-xs text-[#8FA0A8] mt-1">
                      Nenhum fornecedor ativo. Cadastre em <Link href="/cadastros/fornecedores" className="text-[#0E6B7E] underline">Cadastros → Fornecedores</Link>.
                    </p>
                  )}
                  {cotacoes.some((c) => c.fornecedor_id === fornecedorCotacao) && (
                    <p className="text-xs text-[#7A5A0A] mt-1">Este fornecedor já tem cotação: salvar substitui a anterior.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-[#5B6B73]">Preço por unidade de cada item (o total é calculado pela quantidade).</p>
                  {itens.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-[#2B3C44] flex-1">
                        {item.ingredientes?.nome} <span className="text-[#8FA0A8]">({qtd(item.quantidade)} {item.unidade})</span>
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={'R$/' + item.unidade}
                        value={precos[item.id] || ''}
                        onChange={(e) => setPrecos({ ...precos, [item.id]: e.target.value })}
                        className="w-28 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#2B3C44] mb-1">Prazo de entrega (dias)</label>
                    <input type="number" min="0" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={INPUT} placeholder="Ex: 2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#2B3C44] mb-1">Condição de pagamento</label>
                    <input type="text" value={condicoes} onChange={(e) => setCondicoes(e.target.value)} className={INPUT} placeholder="Ex: 28 dias, à vista" />
                  </div>
                </div>

                {erro && <p role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</p>}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={salvandoCotacao}
                    className="btn btn-primario flex-1"
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
            <h2 className="text-base font-semibold text-[#16252B] mb-1">Fornecedor aprovado</h2>
            <p className="text-sm text-[#5B6B73] mb-3">{solicitacao.fornecedores?.nome}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <button
                onClick={copiarPedido}
                className="px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition"
              >
                Copiar o pedido para enviar
              </button>
              <button
                onClick={marcarPedidoEnviado}
                disabled={processando}
                className="btn btn-primario"
              >
                Marcar pedido como enviado
              </button>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <button onClick={() => setMostrarRecebimento(true)} className="text-[#0E6B7E] hover:underline">
                A mercadoria já chegou? Conferir o recebimento
              </button>
              <button onClick={voltarParaCotacao} className="text-[#8FA0A8] hover:text-[#16252B]">
                Escolher outro fornecedor
              </button>
            </div>
          </div>
        )}

        {solicitacao.status === 'pedido_enviado' && (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4">
            <h2 className="text-base font-semibold text-[#16252B] mb-1">Pedido enviado</h2>
            <p className="text-sm text-[#5B6B73]">Fornecedor: {solicitacao.fornecedores?.nome}. Quando a mercadoria chegar, confira abaixo.</p>
          </div>
        )}

        {/* Conferência do recebimento */}
        {podeReceber && (
          <ConferenciaRecebimento
            supabase={supabase}
            solicitacaoId={id}
            fornecedorId={solicitacao.fornecedor_escolhido_id}
            itens={itens}
            cotacoes={cotacoes}
            onConcluido={carregar}
          />
        )}

        {/* Recebido */}
        {solicitacao.status === 'recebido' && (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4 space-y-3">
            <div className="bg-[#D9F0E3] rounded-lg px-3 py-2">
              <p className="text-sm text-[#1E6B3F] font-medium">
                Compra recebida e conferida. O estoque já foi atualizado e a conta a pagar foi para o Financeiro.
              </p>
            </div>
            {recebido ? (
              <>
                <div className="flex flex-wrap justify-between gap-2 text-sm text-[#2B3C44]">
                  <span>
                    {recebido.recebimento.numero_nota ? 'Nota ' + recebido.recebimento.numero_nota + ' · ' : ''}
                    recebido em {dataBr(recebido.recebimento.data_recebimento)}
                    {recebido.recebimento.recebido_por && ' por ' + recebido.recebimento.recebido_por}
                  </span>
                  <span className="font-bold text-[#16252B]">{moeda(recebido.recebimento.total)}</span>
                </div>
                {recebido.recebimento.vencimento && (
                  <p className="text-sm text-[#5B6B73]">
                    Vence em {dataBr(recebido.recebimento.vencimento)} ·{' '}
                    <Link href="/financeiro" className="text-[#0E6B7E] underline">ver no Financeiro</Link>
                  </p>
                )}
                <ul className="divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg">
                  {recebido.itens.map((i) => {
                    const diferenca = Number(i.qtd_recebida) - Number(i.qtd_pedida);
                    const preco = i.preco_cotado !== null && Math.abs(Number(i.preco_unitario) - Number(i.preco_cotado)) > 0.00005;
                    return (
                      <li key={i.id} className="px-3 py-2.5 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-[#16252B]">{i.ingredientes?.nome}</span>
                          <span className="text-[#2B3C44]">
                            {qtd(i.qtd_recebida)} {i.unidade} × {moeda(i.preco_unitario)}
                          </span>
                        </div>
                        {(diferenca !== 0 || preco || i.observacao) && (
                          <p className="text-xs text-[#7A5A0A] mt-0.5">
                            {diferenca < 0 && 'Faltaram ' + qtd(-diferenca) + ' ' + i.unidade + '. '}
                            {diferenca > 0 && 'Vieram ' + qtd(diferenca) + ' ' + i.unidade + ' a mais. '}
                            {preco && 'Cotado a ' + moeda(i.preco_cotado) + '. '}
                            {i.observacao}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-sm text-[#5B6B73]">Sem detalhes de conferência para esta compra.</p>
            )}
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
                className="btn btn-perigo-cheio flex-1"
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
