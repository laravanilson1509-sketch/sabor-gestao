'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  getIngredientePorId,
  criarIngredienteComEstoque,
  atualizarIngrediente,
} from '@/lib/queries/estoque';

const INPUT =
  'w-full border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]';
const LABEL = 'block text-sm font-medium text-[#2B3C44] mb-1';

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
  const [tipoProduto, setTipoProduto] = useState<'ingrediente' | 'acabado'>('ingrediente');
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

        // Pratos agora são cadastrados e editados em Cadastros > Pratos
        if (ingrediente.tipo_produto === 'prato') {
          router.replace('/cadastros/pratos');
          return;
        }

        setNome(ingrediente.nome || '');
        setTipoProduto(ingrediente.tipo_produto === 'acabado' ? 'acabado' : 'ingrediente');
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

    if (!nome.trim()) {
      setErro('Preencha o nome.');
      return;
    }

    if (!custo) {
      setErro('Preencha o custo unitário.');
      return;
    }

    setSalvando(true);
    try {
      if (editando) {
        await atualizarIngrediente(supabase, id!, {
          nome: nome.trim(),
          tipo_produto: tipoProduto,
          ativo,
          custo_unitario: parseFloat(custo) || 0,
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-[#5B6B73]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/estoque')}
            className="h-10 w-10 rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition"
            aria-label="Voltar"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-[#16252B]">
            {editando ? 'Editar produto' : 'Novo produto'}
          </h1>
        </div>

        <form
          onSubmit={handleSalvar}
          className="bg-white border border-[#DCE3E7] rounded-xl p-6 space-y-5"
        >
          {/* Nome */}
          <div>
            <label className={LABEL}>
              Nome do produto <span className="text-[#B3261E]">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Farinha de trigo ou Refrigerante lata"
              className={INPUT}
            />
          </div>

          {/* Tipo de produto */}
          <div>
            <label className="block text-sm font-medium text-[#2B3C44] mb-2">
              Tipo de produto
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTipoProduto('ingrediente')}
                className={`py-3 px-4 rounded-lg border-2 text-left transition ${
                  tipoProduto === 'ingrediente'
                    ? 'border-[#0E6B7E] bg-[#DCEEF2] text-[#0B4F5E]'
                    : 'border-[#DCE3E7] text-[#5B6B73] hover:border-[#C9D3D8]'
                }`}
              >
                <span className="block text-sm font-semibold">Ingrediente</span>
                <span className="block text-xs font-normal mt-1 opacity-80">
                  Insumo usado nas fichas técnicas
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTipoProduto('acabado')}
                className={`py-3 px-4 rounded-lg border-2 text-left transition ${
                  tipoProduto === 'acabado'
                    ? 'border-[#0E6B7E] bg-[#DCEEF2] text-[#0B4F5E]'
                    : 'border-[#DCE3E7] text-[#5B6B73] hover:border-[#C9D3D8]'
                }`}
              >
                <span className="block text-sm font-semibold">Acabado</span>
                <span className="block text-xs font-normal mt-1 opacity-80">
                  Pronto para revenda direta
                </span>
              </button>
            </div>
          </div>

          {/* Unidade + Quantidade (só no cadastro novo) */}
          {!editando && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Unidade de medida</label>
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className={INPUT}
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
                <label className={LABEL}>Quantidade inicial</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
          )}

          {/* Custo + Estoque mínimo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>
                Custo unitário (R$) <span className="text-[#B3261E]">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                placeholder="0.00"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>
                Estoque mínimo
                <span className="ml-1 text-xs text-[#8FA0A8]">(dispara o alerta)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
                placeholder="Ex: 10"
                className={INPUT}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-[#2B3C44] mb-2">Status</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAtivo(true)}
                className={`py-2.5 rounded-lg border-2 font-medium text-sm transition ${
                  ativo
                    ? 'border-[#0E6B7E] bg-[#DCEEF2] text-[#0B4F5E]'
                    : 'border-[#DCE3E7] text-[#5B6B73] hover:border-[#C9D3D8]'
                }`}
              >
                Ativo
              </button>
              <button
                type="button"
                onClick={() => setAtivo(false)}
                className={`py-2.5 rounded-lg border-2 font-medium text-sm transition ${
                  !ativo
                    ? 'border-[#B58300] bg-[#FFF0C7] text-[#7A5A0A]'
                    : 'border-[#DCE3E7] text-[#5B6B73] hover:border-[#C9D3D8]'
                }`}
              >
                Inativo
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div
              role="alert"
              className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2"
            >
              {erro}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition"
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar produto'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/estoque')}
              className="flex-1 bg-[#F1F5F7] hover:bg-[#E3E9EC] text-[#2B3C44] py-2.5 rounded-lg font-medium transition"
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
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-[#5B6B73]">Carregando...</p>
        </div>
      }
    >
      <CadastroEstoquePageInner />
    </Suspense>
  );
}