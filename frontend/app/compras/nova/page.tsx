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
      <div className="px-4 py-12 text-center">
        <p className="text-[#5B6B73]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/compras')} className="h-10 w-10 rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition">←</button>
          <h1 className="text-2xl font-bold text-[#16252B]">Nova solicitação de compra</h1>
        </div>

        <form onSubmit={handleSalvar} className="bg-white border border-[#DCE3E7] rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#2B3C44] mb-2">Itens necessários</label>
            <div className="space-y-3">
              {itens.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <select
                    value={item.ingrediente_id}
                    onChange={(e) => atualizarLinha(index, 'ingrediente_id', e.target.value)}
                    className="flex-1 min-w-0 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
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
                    className="w-24 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
                  />
                  <select
                    value={item.unidade}
                    onChange={(e) => atualizarLinha(index, 'unidade', e.target.value)}
                    className="w-20 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
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
                      className="h-10 px-2 text-[#8FA0A8] hover:text-[#B3261E]"
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
              className="mt-3 text-sm font-medium text-[#0E6B7E] hover:underline"
            >
              + Adicionar item
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2B3C44] mb-1">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Ex: urgente, precisa até sexta"
              className="w-full border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
            />
          </div>

          {erro && (
            <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              {salvando ? 'Salvando...' : 'Criar solicitação'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/compras')}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}