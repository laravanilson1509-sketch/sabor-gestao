'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  getFichaTecnica,
  listarIngredientesConsumo,
  adicionarItemFicha,
  removerItemFicha,
  salvarPrecoVenda,
} from '@/lib/queries/fichasTecnicas';
import {
  getConfigFinanceira,
  listarCustosFixos,
  calcularCustoFixoPorPrato,
  calcularPrecoSugerido,
  type ConfigFinanceira,
} from '@/lib/queries/financeiro';

type IngredienteConsumo = { id: string; nome: string; unidade_padrao: string | null };

function moeda(v: number) {
  return 'R$ ' + v.toFixed(2);
}

export default function EditarFichaTecnicaPage() {
  const router = useRouter();
  const params = useParams();
  const produtoId = params.id as string;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [loading, setLoading] = useState(true);
  const [produto, setProduto] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [custoTotal, setCustoTotal] = useState(0);
  const [ingredientesDisponiveis, setIngredientesDisponiveis] = useState<IngredienteConsumo[]>([]);

  const [config, setConfig] = useState<ConfigFinanceira | null>(null);
  const [custoFixoPrato, setCustoFixoPrato] = useState(0);

  const [ingredienteSelecionado, setIngredienteSelecionado] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState('kg');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const [precoInput, setPrecoInput] = useState('');
  const [salvandoPreco, setSalvandoPreco] = useState(false);

  async function carregar() {
    setLoading(true);

    try {
      const { data: prod } = await supabase
        .from('ingredientes')
        .select('id, nome, preco_venda')
        .eq('id', produtoId)
        .single();
      setProduto(prod);
      setPrecoInput(prod && prod.preco_venda ? String(prod.preco_venda) : '');
    } catch (err) {
      console.error(err);
    }

    try {
      const resultado = await getFichaTecnica(supabase, produtoId, unidadeId);
      setItens(resultado.itens);
      setCustoTotal(resultado.custoTotal);
    } catch (err) {
      console.error(err);
    }

    try {
      const disponiveis = await listarIngredientesConsumo(supabase);
      setIngredientesDisponiveis(disponiveis);
    } catch (err) {
      console.error(err);
    }

    try {
      const cfg = await getConfigFinanceira(supabase, unidadeId);
      const custos = await listarCustosFixos(supabase, unidadeId);
      const rateio = calcularCustoFixoPorPrato(custos, cfg.vendas_previstas_mes);
      setConfig(cfg);
      setCustoFixoPrato(rateio.porPrato);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [produtoId]);

  function handleSelecionarIngrediente(id: string) {
    setIngredienteSelecionado(id);
    const ing = ingredientesDisponiveis.find((i) => i.id === id);
    if (ing && ing.unidade_padrao) {
      setUnidade(ing.unidade_padrao);
    }
  }

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!ingredienteSelecionado || !quantidade || parseFloat(quantidade) <= 0) {
      setErro('Escolha um ingrediente e informe a quantidade.');
      return;
    }

    const jaExiste = itens.some((i) => i.ingrediente_id === ingredienteSelecionado);
    if (jaExiste) {
      setErro('Esse ingrediente já está na receita.');
      return;
    }

    setSalvando(true);
    try {
      await adicionarItemFicha(supabase, {
        produto_acabado_id: produtoId,
        ingrediente_id: ingredienteSelecionado,
        quantidade: parseFloat(quantidade),
        unidade: unidade,
      });
      setIngredienteSelecionado('');
      setQuantidade('');
      setUnidade('kg');
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao adicionar');
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(itemId: string) {
    setRemovendo(itemId);
    try {
      await removerItemFicha(supabase, itemId);
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setRemovendo(null);
    }
  }

  async function handleSalvarPreco() {
    const valor = parseFloat(precoInput);
    if (!valor || valor <= 0) {
      alert('Informe um preço válido.');
      return;
    }
    setSalvandoPreco(true);
    try {
      await salvarPrecoVenda(supabase, produtoId, valor);
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setSalvandoPreco(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-12 flex items-center justify-center">
        <p className="text-[#5B6B73]">Carregando...</p>
      </div>
    );
  }

  const precoSalvo = Number(produto && produto.preco_venda ? produto.preco_venda : 0);
  const custoBase = custoTotal + custoFixoPrato;
  const sugestao = config
    ? calcularPrecoSugerido({ custoIngredientes: custoTotal, custoFixoPorPrato: custoFixoPrato, config })
    : null;

  const deducoesPct = config ? config.impostos_pct + config.taxa_cartao_pct + config.taxa_app_pct : 0;
  const lucro = precoSalvo > 0 ? precoSalvo * (1 - deducoesPct / 100) - custoBase : 0;
  const margemPct = precoSalvo > 0 ? (lucro / precoSalvo) * 100 : 0;
  const alvo = config ? config.margem_lucro_pct : 50;
  const corMargem =
    margemPct >= alvo ? 'text-[#1E6B3F]' : margemPct >= alvo / 2 ? 'text-[#8A5F00]' : 'text-[#B3261E]';

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/cadastros/pratos'))}
            className="h-10 w-10 rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-[#16252B]">{produto ? produto.nome : ''}</h1>
        </div>

        <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-4">
          <h2 className="text-base font-semibold text-[#16252B] mb-3">Ingredientes da receita</h2>
          {itens.length === 0 ? (
            <p className="text-sm text-[#5B6B73] py-4 text-center">Nenhum ingrediente adicionado ainda</p>
          ) : (
            <div className="space-y-2">
              {itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm border-b border-[#E6ECEF] pb-2 last:border-0">
                  <div>
                    <span className="font-medium text-[#16252B]">{item.ingredientes ? item.ingredientes.nome : ''}</span>
                    <span className="text-[#5B6B73]">
                      {' '}
                      - {item.quantidade} {item.unidade}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#5B6B73]">{moeda(item.quantidade * item.custo_unitario)}</span>
                    <button
                      onClick={() => handleRemover(item.id)}
                      disabled={removendo === item.id}
                      className="text-[#8FA0A8] hover:text-[#B3261E] disabled:opacity-50"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleAdicionar} className="bg-white border border-[#DCE3E7] rounded-xl p-4 space-y-3 mb-4">
          <h2 className="text-base font-semibold text-[#16252B]">Adicionar ingrediente</h2>
          <div className="flex gap-2">
            <select
              value={ingredienteSelecionado}
              onChange={(e) => handleSelecionarIngrediente(e.target.value)}
              className="flex-1 min-w-0 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
            >
              <option value="">Selecione...</option>
              {ingredientesDisponiveis
                .filter((ing) => !itens.some((i) => i.ingrediente_id === ing.id))
                .map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.nome}
                  </option>
                ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Qtd"
              className="w-24 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
            />
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="w-20 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="un">un</option>
            </select>
          </div>

          {erro && <p role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</p>}

          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            {salvando ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>

        <div className="bg-white border border-[#DCE3E7] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-[#16252B]">Formação do preço</h2>
            <Link href="/financeiro" className="text-xs font-medium text-[#0E6B7E] hover:underline">
              Alterar parâmetros no Financeiro
            </Link>
          </div>

          {!config ? (
            <p className="text-sm text-[#B3261E] mb-3">
              Não foi possível ler os parâmetros do Financeiro. Abra a tela Financeiro e salve os parâmetros.
            </p>
          ) : (
            <div className="text-sm space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-[#5B6B73]">Custo dos ingredientes</span>
                <span>{moeda(custoTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B73]">Custo fixo por prato (rateio)</span>
                <span>{moeda(custoFixoPrato)}</span>
              </div>
              <div className="flex justify-between font-medium text-[#16252B] border-t border-[#DCE3E7] pt-1">
                <span>Custo base</span>
                <span>{moeda(custoBase)}</span>
              </div>
              <div className="flex justify-between text-[#5B6B73] pt-2">
                <span>Margem de lucro</span>
                <span>{config.margem_lucro_pct}%</span>
              </div>
              <div className="flex justify-between text-[#5B6B73]">
                <span>Impostos</span>
                <span>{config.impostos_pct}%</span>
              </div>
              <div className="flex justify-between text-[#5B6B73]">
                <span>Taxa de cartão</span>
                <span>{config.taxa_cartao_pct}%</span>
              </div>
              <div className="flex justify-between text-[#5B6B73]">
                <span>Taxa de apps de delivery</span>
                <span>{config.taxa_app_pct}%</span>
              </div>
              <div className="flex justify-between font-semibold text-[#0E6B7E] border-t border-[#DCE3E7] pt-2">
                <span>Preço sugerido</span>
                <span>
                  {sugestao && sugestao.valido && sugestao.preco > 0 ? moeda(sugestao.preco) : '-'}
                </span>
              </div>
              {sugestao && !sugestao.valido && (
                <p className="text-xs text-[#B3261E]">
                  A soma dos percentuais chegou a {sugestao.percentuais}%. Ajuste no Financeiro (precisa ser
                  menor que 100%).
                </p>
              )}
              {config.vendas_previstas_mes === 0 && (
                <p className="text-xs text-[#7A5A0A] bg-[#FFF0C7] border border-[#E8D28A] rounded-lg px-3 py-2 mt-2">
                  Defina as vendas previstas por mês no Financeiro para o custo fixo entrar no preço.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 mb-2 flex-wrap">
            <input
              type="number"
              step="0.01"
              value={precoInput}
              onChange={(e) => setPrecoInput(e.target.value)}
              placeholder="Defina o preço final"
              className="flex-1 min-w-40 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
            />
            <button
              type="button"
              onClick={() => {
                if (sugestao && sugestao.valido && sugestao.preco > 0) {
                  setPrecoInput(sugestao.preco.toFixed(2));
                }
              }}
              className="px-4 py-2.5 rounded-lg border border-[#0E6B7E] bg-white text-[#0E6B7E] text-sm font-medium hover:bg-[#F1F8FA] transition"
            >
              Usar sugerido
            </button>
            <button
              onClick={handleSalvarPreco}
              disabled={salvandoPreco}
              className="bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              {salvandoPreco ? 'Salvando...' : 'Salvar preço'}
            </button>
          </div>

          {precoSalvo > 0 && (
            <p className={'text-sm font-semibold ' + corMargem}>
              Preço salvo: {moeda(precoSalvo)} | Lucro: {moeda(lucro)} ({margemPct.toFixed(0)}% do preço)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}