'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { criarSolicitacao } from '@/lib/queries/compras';

type Ingrediente = { id: string; nome: string; unidade_padrao: string | null };

export default function NovaSolicitacaoPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');

  const [itens, setItens] = useState<{ ingrediente_id: string; quantidade: string; unidade: string }[]>([
    { ingrediente_id: '', quantidade: '', unidade: 'kg' },
  ]);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('ingredientes')
        .select('id, nome, unidade_padrao')
        .eq('tipo_produto', 'consumo')
        .eq('ativo', true)
        .order('nome');
      setIngredientes(data || []);
      setLoading(false);
    }
    carregar();
  }, []);

  function adicionarLinha() {
    setItens([...itens, { ingrediente_id: '', quantidade: '', unidade: 'kg' }]);
  }

  function removerLinha(index: number) {
    setItens(itens.filter((_, i) => i !== index));
  }

  function atualizarLinha(index: number, campo: string, valor: string) {
    const novos = [...itens];
    novos[index] = { ...novos[index], [campo]: valor };
    if (campo === 'ingrediente_id') {
      const ing = ingredientes.find((i) => i.id === valor);
      if (ing?.unidade_padrao) novos[index].unidade = ing.unidade_padrao;
    }
    setItens(novos);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const itensValidos = itens.filter((i) => i.ingrediente_id && i.quantidade && parseFloat(i.quantidade) > 0);
    if (itensValidos.length === 0) {
      setErro('Adiciona pelo menos um item com quantidade.');
      return;
    }

    setSalvando(true);
    try {
      const id = await criarSolicitacao(supabase, {
        unidade_id: unidadeId,
        observacao: observacao.trim() || null,
        itens: itensValidos.map((i) => ({
          ingrediente_id: i.ingrediente_id,
          quantidade: parseFloat(i.quantidade),
          unidade: i.unidade,
        })),
      });
      router.push(`/compras/${id}`);
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
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/compras')} className="text-gray-500 hover:text-gray-700 text-xl">←</button>
          <h1 className="text-2xl font-bold text-gray-900">+ Nova solicitação de compra</h1>
        </div>

        <form onSubmit={handleSalvar} className="bg-white rounded-lg shadow p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Itens necessários</label>
            <div className="space-y-3">
              {itens.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <select
                    value={item.ingrediente_id}
                    onChange={(e) => atualizarLinha(index, 'ingrediente_id', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {ingredientes.map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.nome}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={item.quantidade}
                    onChange={(e) => atualizarLinha(index, 'quantidade', e.target.value)}
                    placeholder="Qtd"
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={item.unidade}
                    onChange={(e) => atualizarLinha(index, 'unidade', e.target.value)}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                  </select>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerLinha(index)}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={adicionarLinha}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Adicionar item
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Ex: urgente, precisa até sexta"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {erro && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {erro}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition"
            >
              {salvando ? 'Salvando...' : 'Criar solicitação'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/compras')}
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