'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  getIngredientePorId,
  criarIngredienteComEstoque,
  atualizarIngrediente,
} from '@/lib/queries/estoque';

function CadastroEstoquePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const editando = !!id;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [loading, setLoading] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [tipoProduto, setTipoProduto] = useState<'consumo' | 'acabado'>('consumo');
  const [unidade, setUnidade] = useState('kg');
  const [quantidade, setQuantidade] = useState('0');
  const [custo, setCusto] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('0');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!editando) return;

    async function carregarDados() {
      try {
        const { ingrediente, estoque } = await getIngredientePorId(supabase, id!);
        setNome(ingrediente.nome || '');
        setTipoProduto(ingrediente.tipo_produto || 'consumo');
        setAtivo(ingrediente.ativo ?? true);
        setUnidade(estoque?.unidade || 'kg');
        setQuantidade(String(estoque?.quantidade_disponivel || 0));
        setCusto(String(estoque?.custo_unitario || ''));
        setEstoqueMinimo(String(estoque?.estoque_minimo || 0));
      } catch (err) {
        setErro('Erro ao carregar produto');
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [id]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !custo) {
      setErro('Preenche nome e custo unitário.');
      return;
    }

    setSalvando(true);
    try {
      if (editando) {
        await atualizarIngrediente(supabase, id!, {
          nome: nome.trim(),
          tipo_produto: tipoProduto,
          ativo,
          custo_unitario: parseFloat(custo),
          estoque_minimo: parseFloat(estoqueMinimo) || 0,
        });
      } else {
        await criarIngredienteComEstoque(supabase, {
          nome: nome.trim(),
          tipo_produto: tipoProduto,
          unidade_padrao: unidade,
          ativo,
          quantidade_disponivel: parseFloat(quantidade) || 0,
          custo_unitario: parseFloat(custo),
          estoque_minimo: parseFloat(estoqueMinimo) || 0,
          unidade_id: unidadeId,
        });
      }
      router.push('/estoque');
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/estoque')}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {editando ? '✏️ Editar produto' : '+ Novo produto'}
          </h1>
        </div>

        <form onSubmit={handleSalvar} className="bg-white rounded-lg shadow p-6 space-y-5">

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do produto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Farinha de Trigo ou Pizza Congelada"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tipo de produto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de produto
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTipoProduto('consumo')}
                className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition ${
                  tipoProduto === 'consumo'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                🧂 Produto de Consumo
                <p className="text-xs font-normal mt-1 opacity-70">Ingrediente/insumo</p>
              </button>
              <button
                type="button"
                onClick={() => setTipoProduto('acabado')}
                className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition ${
                  tipoProduto === 'acabado'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                🍕 Produto Acabado
                <p className="text-xs font-normal mt-1 opacity-70">Pronto pra venda</p>
              </button>
            </div>
          </div>

          {/* Unidade + Quantidade (só no cadastro novo) */}
          {!editando && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidade de medida
                </label>
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kg">kg — quilograma</option>
                  <option value="g">g — grama</option>
                  <option value="L">L — litro</option>
                  <option value="ml">ml — mililitro</option>
                  <option value="un">un — unidade</option>
                  <option value="cx">cx — caixa</option>
                  <option value="pct">pct — pacote</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade inicial
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Custo + Estoque mínimo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custo unitário (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estoque mínimo
                <span className="ml-1 text-xs text-gray-400">(alerta 🟡)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
                placeholder="Ex: 10"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAtivo(true)}
                className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition ${
                  ativo
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                ✅ Ativo
              </button>
              <button
                type="button"
                onClick={() => setAtivo(false)}
                className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition ${
                  !ativo
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                ⏸️ Inativo
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠️ {erro}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition"
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/estoque')}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CadastroEstoquePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Carregando...</p></div>}>
      <CadastroEstoquePageInner />
    </Suspense>
  );
}