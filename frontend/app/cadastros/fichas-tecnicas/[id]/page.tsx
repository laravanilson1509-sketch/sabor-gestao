'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  getFichaTecnica,
  listarIngredientesConsumo,
  adicionarItemFicha,
  removerItemFicha,
  salvarPrecoVenda,
  calcularMargem,
} from '@/lib/queries/fichasTecnicas';

type IngredienteConsumo = { id: string; nome: string; unidade_padrao: string | null };

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

      const resultado = await getFichaTecnica(supabase, produtoId, unidadeId);
      setItens(resultado.itens);
      setCustoTotal(resultado.custoTotal);

      const disponiveis = await listarIngredientesConsumo(supabase);
      setIngredientesDisponiveis(disponiveis);
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
      setErro('Escolhe um ingrediente e informa a quantidade.');
      return;
    }

    const jaExiste = itens.some((i) => i.ingrediente_id === ingredienteSelecionado);
    if (jaExiste) {
      setErro('Esse ingrediente ja esta na receita.');
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
      alert('Informa um preco valido.');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  const preco = Number(produto && produto.preco_venda ? produto.preco_venda : 0);
  const margemCalculo = calcularMargem(custoTotal, preco);
  const margemReais = margemCalculo.margemReais;
  const margemPct = margemCalculo.margemPct;
  const corMargem = margemPct >= 50 ? 'text-green-600' : margemPct >= 20 ? 'text-yellow-600' : 'text-red-600';

  const custoSugerido50 = custoTotal > 0 ? custoTotal / 0.5 : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/cadastros/fichas-tecnicas')} className="text-gray-500 hover:text-gray-700 text-xl">
            {'<-'}
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {produto ? produto.nome : ''}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Ingredientes da receita</h2>
          {itens.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum ingrediente adicionado ainda</p>
          ) : (
            <div className="space-y-2">
              {itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <span className="font-medium">{item.ingredientes ? item.ingredientes.nome : ''}</span>
                    <span className="text-gray-500"> - {item.quantidade} {item.unidade}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600">R$ {(item.quantidade * item.custo_unitario).toFixed(2)}</span>
                    <button
                      onClick={() => handleRemover(item.id)}
                      disabled={removendo === item.id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleAdicionar} className="bg-white rounded-lg shadow p-4 space-y-3 mb-4">
          <h2 className="font-semibold text-gray-900">Adicionar ingrediente</h2>
          <div className="flex gap-2">
            <select
              value={ingredienteSelecionado}
              onChange={(e) => handleSelecionarIngrediente(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {ingredientesDisponiveis
                .filter((ing) => !itens.some((i) => i.ingrediente_id === ing.id))
                .map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.nome}</option>
                ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Qtd"
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="L">L</option>
              <option value="ml">ml</option>
              <option value="un">un</option>
            </select>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={salvando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
          >
            {salvando ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Preco de venda</h2>

          <div className="grid grid-cols-2 gap-4 text-center mb-4">
            <div>
              <p className="text-xs text-gray-500">Custo da receita</p>
              <p className="text-lg font-bold text-gray-900">R$ {custoTotal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sugestao (margem 50%)</p>
              <p className="text-lg font-bold text-blue-600">
                {custoSugerido50 > 0 ? 'R$ ' + custoSugerido50.toFixed(2) : '-'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="number"
              step="0.01"
              value={precoInput}
              onChange={(e) => setPrecoInput(e.target.value)}
              placeholder="Defina o preco final"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleSalvarPreco}
              disabled={salvandoPreco}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {salvandoPreco ? 'Salvando...' : 'Salvar preco'}
            </button>
          </div>

          {preco > 0 && (
            <p className={'text-sm font-semibold ' + corMargem}>
              Margem atual: {margemPct.toFixed(0)}% (R$ {margemReais.toFixed(2)})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}