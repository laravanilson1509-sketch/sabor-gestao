'use client';

import { useEffect, useState } from 'react';
import { ConteudoVoltar } from '@/components/BotaoVoltar';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import BarraBusca from '@/components/BarraBusca';
import { criarSolicitacao, sugerirCompra } from '@/lib/queries/compras';
import { combina } from '@/lib/busca';
import { grupoDaCategoria, rotuloCategoria } from '@/lib/queries/bebidas';

type Ingrediente = {
  id: string;
  nome: string;
  unidade_padrao: string | null;
  tipo_produto: string;
  categoria_bebida?: string | null;
};

// o que se compra (prato não entra: é produzido na cozinha)
type FiltroTipo = 'todos' | 'ingrediente' | 'acabado' | 'bebida';
type FiltroBebida = 'todas' | 'nao_alcoolica' | 'alcoolica';

const TIPOS: { valor: FiltroTipo; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'ingrediente', rotulo: 'Ingredientes' },
  { valor: 'acabado', rotulo: 'Produtos acabados' },
  { valor: 'bebida', rotulo: 'Bebidas' },
];

const BEBIDAS: { valor: FiltroBebida; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'nao_alcoolica', rotulo: 'Não alcoólicas' },
  { valor: 'alcoolica', rotulo: 'Alcoólicas' },
];

const chip = (ativo: boolean) =>
  'text-sm px-3.5 py-1.5 rounded-full font-medium transition border ' +
  (ativo ? 'bg-accent text-accent-contrast border-accent' : 'bg-surface text-ink-muted border-line hover:bg-surface-hover');

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
  const [origem, setOrigem] = useState<'manual' | 'sugestao'>('manual');
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroBebida, setFiltroBebida] = useState<FiltroBebida>('todas');
  const [busca, setBusca] = useState('');

  const [itens, setItens] = useState<{ ingrediente_id: string; quantidade: string; unidade: string }[]>([
    { ingrediente_id: '', quantidade: '', unidade: 'kg' },
  ]);

  useEffect(() => {
    async function carregar() {
      const consulta = (campos: string) =>
        supabase
          .from('ingredientes')
          .select(campos)
          .in('tipo_produto', ['ingrediente', 'acabado', 'bebida'])
          .eq('ativo', true)
          .order('nome');
      let { data, error } = await consulta('id, nome, unidade_padrao, tipo_produto, categoria_bebida');
      // SQL das bebidas (0020) ainda não rodado: segue sem a categoria da bebida
      if (error && (error.message || '').includes('categoria_bebida')) {
        ({ data, error } = await consulta('id, nome, unidade_padrao, tipo_produto'));
      }
      setIngredientes((data || []) as unknown as Ingrediente[]);
      setLoading(false);
      // veio do botão "Montar solicitação" da lista de compras
      if (new URLSearchParams(window.location.search).get('sugestao')) preencherPeloEstoque(true);
    }
    carregar();
  }, []);

  // lista o que está no estoque mínimo ou abaixo, ainda sem pedido em andamento
  async function preencherPeloEstoque(silencioso = false) {
    setErro(null);
    setAviso(null);
    try {
      const todas = await sugerirCompra(supabase, unidadeId);
      const novas = todas.filter((s) => !s.jaSolicitado);
      const jaPedidas = todas.length - novas.length;
      if (novas.length === 0) {
        if (!silencioso || todas.length > 0) {
          setAviso(
            todas.length === 0
              ? 'Nenhum item está no estoque mínimo ou abaixo dele.'
              : 'Todos os itens abaixo do mínimo já estão em outra solicitação em andamento.'
          );
        }
        return;
      }
      setItens(novas.map((s) => ({ ingrediente_id: s.ingrediente_id, quantidade: String(s.sugerido), unidade: s.unidade })));
      setOrigem('sugestao');
      setAviso(
        novas.length +
          (novas.length === 1 ? ' item preenchido' : ' itens preenchidos') +
          ' para chegar a 2× o estoque mínimo' +
          (jaPedidas > 0 ? ' (' + jaPedidas + ' já em outra solicitação ficaram de fora)' : '') +
          '. Ajuste as quantidades se quiser.'
      );
    } catch (err: any) {
      setErro(err.message || 'Erro ao consultar o estoque');
    }
  }

  // opções do seletor: respeitam o filtro e a busca (o item já escolhido nunca some)
  function opcoesDaLinha(escolhido: string) {
    return ingredientes.filter((ing) => {
      if (ing.id === escolhido) return true;
      if (filtroTipo !== 'todos' && ing.tipo_produto !== filtroTipo) return false;
      if (filtroTipo === 'bebida' && filtroBebida !== 'todas' && grupoDaCategoria(ing.categoria_bebida) !== filtroBebida) return false;
      return combina(busca, ing.nome, rotuloCategoria(ing.categoria_bebida));
    });
  }
  const totalFiltrado = ingredientes.filter((ing) => opcoesDaLinha('').includes(ing)).length;

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
        origem,
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
        <p className="text-ink-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/compras')} className="btn-voltar"><ConteudoVoltar /></button>
          <h1 className="text-2xl font-bold text-ink">Nova solicitação de compra</h1>
        </div>

        <form onSubmit={handleSalvar} className="bg-surface border border-line rounded-xl p-6 space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="block text-sm font-medium text-ink-soft">Itens necessários</label>
              <button
                type="button"
                onClick={() => preencherPeloEstoque(false)}
                className="text-sm font-medium text-accent hover:underline"
              >
                Preencher pelo estoque mínimo
              </button>
            </div>
            {aviso && <p className="text-sm text-success bg-success-soft rounded-lg px-3 py-2 mb-3">{aviso}</p>}

            {/* Filtros: facilitam achar o item na lista de escolha */}
            <div className="rounded-lg border border-line-soft bg-surface-hover p-3 mb-3 space-y-2.5">
              <BarraBusca valor={busca} onChange={setBusca} placeholder="Buscar item para comprar..." />
              <div className="flex flex-wrap gap-1.5">
                {TIPOS.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setFiltroTipo(t.valor)}
                    className={chip(filtroTipo === t.valor)}
                  >
                    {t.rotulo}
                  </button>
                ))}
              </div>
              {filtroTipo === 'bebida' && (
                <div className="flex flex-wrap gap-1.5">
                  {BEBIDAS.map((b) => (
                    <button
                      key={b.valor}
                      type="button"
                      onClick={() => setFiltroBebida(b.valor)}
                      className={chip(filtroBebida === b.valor)}
                    >
                      {b.rotulo}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-ink-subtle">
                {totalFiltrado === 0
                  ? 'Nenhum item com esse filtro.'
                  : totalFiltrado + (totalFiltrado === 1 ? ' item disponível' : ' itens disponíveis') + ' na lista de escolha abaixo. Pratos não aparecem aqui.'}
              </p>
            </div>
            <div className="space-y-3">
              {itens.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <select
                    value={item.ingrediente_id}
                    onChange={(e) => atualizarLinha(index, 'ingrediente_id', e.target.value)}
                    className="flex-1 min-w-0 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Selecione...</option>
                    {opcoesDaLinha(item.ingrediente_id).map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.nome}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={item.quantidade}
                    onChange={(e) => atualizarLinha(index, 'quantidade', e.target.value)}
                    placeholder="Qtd"
                    className="w-24 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <select
                    value={item.unidade}
                    onChange={(e) => atualizarLinha(index, 'unidade', e.target.value)}
                    className="w-20 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                    <option value="cx">cx</option>
                    <option value="pct">pct</option>
                  </select>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerLinha(index)}
                      className="h-10 px-2 text-ink-subtle hover:text-danger"
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
              className="mt-3 text-sm font-medium text-accent hover:underline"
            >
              + Adicionar item
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft mb-1">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Ex: urgente, precisa até sexta"
              className="w-full border border-line-strong rounded-lg px-3 py-2.5 text-sm text-ink bg-surface placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {erro && (
            <div role="alert" className="text-sm text-danger bg-danger-soft rounded-lg px-3 py-2">{erro}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="btn btn-primario flex-1"
            >
              {salvando ? 'Salvando...' : 'Criar solicitação'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/compras')}
              className="flex-1 px-4 py-2.5 rounded-lg border border-line bg-surface text-ink-soft text-sm font-medium hover:bg-surface-hover transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}