'use client';

import { grupoDaCategoria, rotuloCategoria } from '@/lib/queries/bebidas';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import { combina } from '@/lib/busca';
import { createBrowserClient } from '@supabase/ssr';
import {
  getEstoqueComStatus,
  registrarMovimentacao,
  deletarIngrediente,
  calcularStatus,
  getStatusDisplay,
} from '@/lib/queries/estoque';
import ConferenciasPendentes from '@/components/estoque/ConferenciasPendentes';

type ItemEstoque = {
  id: string;
  quantidade_disponivel: number;
  custo_unitario: number;
  estoque_minimo: number;
  unidade: string;
  ingredientes: { id: string; nome: string; tipo_produto: string; categoria_bebida?: string | null; ativo: boolean } | null;
};

type FiltroTipo = 'todos' | 'ingrediente' | 'acabado' | 'bebida';
type FiltroBebida = 'todas' | 'nao_alcoolica' | 'alcoolica';
type FiltroAtivo = 'todos' | 'ativo' | 'inativo';

function rotuloTipo(t: FiltroTipo) {
  if (t === 'todos') return 'Todos';
  if (t === 'ingrediente') return 'Ingrediente';
  if (t === 'bebida') return 'Bebida';
  return 'Acabado';
}

function rotuloAtivo(s: FiltroAtivo) {
  if (s === 'todos') return 'Todos';
  if (s === 'ativo') return 'Ativos';
  return 'Inativos';
}

const svgProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function IconPlus() {
  return (
    <svg {...svgProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconMinus() {
  return (
    <svg {...svgProps}>
      <path d="M5 12h14" />
    </svg>
  );
}
function IconList() {
  return (
    <svg {...svgProps}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg {...svgProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg {...svgProps}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

const BTN_ACAO =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE3E7] bg-white text-[#5B6B73] hover:bg-[#F1F5F7] hover:text-[#0E6B7E] transition';

export default function EstoquePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>('ativo');
  const [filtroBebida, setFiltroBebida] = useState<FiltroBebida>('todas');
  const [busca, setBusca] = useState('');

  const [itemMovimentacao, setItemMovimentacao] = useState<ItemEstoque | null>(null);
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'entrada' | 'consumo'>('entrada');
  const [qtdMov, setQtdMov] = useState('');
  const [obsMov, setObsMov] = useState('');

  const [showHistorico, setShowHistorico] = useState<ItemEstoque | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);

  const [itemParaDeletar, setItemParaDeletar] = useState<ItemEstoque | null>(null);
  const [deletando, setDeletando] = useState(false);

  // sub-filtro das bebidas: alcoólicas ou não alcoólicas
  function passaFiltroBebida(item: ItemEstoque) {
    if (!combina(busca, item.ingredientes?.nome, rotuloCategoria(item.ingredientes?.categoria_bebida))) return false;
    if (filtroTipo !== 'bebida' || filtroBebida === 'todas') return true;
    return grupoDaCategoria(item.ingredientes?.categoria_bebida) === filtroBebida;
  }

  async function carregar() {
    setLoading(true);
    try {
      const data = await getEstoqueComStatus(supabase, unidadeId, {
        tipo: filtroTipo,
        ativo: filtroAtivo,
      });
      setItens(data as any);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [filtroTipo, filtroAtivo]);

  async function handleMovimentacao(e: React.FormEvent) {
    e.preventDefault();
    if (!itemMovimentacao || !itemMovimentacao.ingredientes || !qtdMov) return;
    try {
      await registrarMovimentacao(supabase, {
        ingrediente_id: itemMovimentacao.ingredientes.id,
        unidade_id: unidadeId,
        tipo: tipoMovimentacao,
        quantidade: parseFloat(qtdMov),
        observacao: obsMov,
      });
      setItemMovimentacao(null);
      setQtdMov('');
      setObsMov('');
      await carregar();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function abrirHistorico(item: ItemEstoque) {
    setShowHistorico(item);
    const { data } = await supabase
      .from('movimentacoes_estoque')
      .select('*')
      .eq('ingrediente_id', item.ingredientes ? item.ingredientes.id : '')
      .order('criado_em', { ascending: false })
      .limit(20);
    setHistorico(data || []);
  }

  async function confirmarExclusao() {
    if (!itemParaDeletar || !itemParaDeletar.ingredientes) return;
    setDeletando(true);
    try {
      await deletarIngrediente(supabase, itemParaDeletar.ingredientes.id);
      setItemParaDeletar(null);
      await carregar();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setDeletando(false);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#16252B]">Estoque</h1>
            <p className="text-sm text-[#5B6B73] mt-1">Ingredientes e produtos acabados</p>
          </div>
          <Link
            href="/estoque/cadastro"
            className="bg-[#0E6B7E] hover:bg-[#0B5A6A] text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            + Novo produto
          </Link>
        </div>

        <ConferenciasPendentes unidadeId={unidadeId} onAlterado={carregar} />

        <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-6 flex flex-wrap gap-6">
          <div className="w-full">
            <BarraBusca valor={busca} onChange={setBusca} placeholder="Buscar produto ou ingrediente..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5B6B73] mb-1.5">Tipo</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'ingrediente', 'acabado', 'bebida'] as FiltroTipo[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className={
                    'text-sm px-3.5 py-1.5 rounded-full font-medium transition ' +
                    (filtroTipo === t
                      ? 'bg-[#0E6B7E] text-white'
                      : 'bg-[#F1F5F7] text-[#5B6B73] hover:bg-[#E3E9EC]')
                  }
                >
                  {rotuloTipo(t)}
                </button>
              ))}
            </div>
          </div>

          {filtroTipo === 'bebida' && (
            <div>
              <label className="block text-xs font-medium text-[#5B6B73] mb-1.5">Tipo de bebida</label>
              <div className="flex gap-1.5 flex-wrap">
                {([['todas', 'Todas'], ['nao_alcoolica', 'Não alcoólicas'], ['alcoolica', 'Alcoólicas']] as [FiltroBebida, string][]).map(
                  ([valor, rotulo]) => (
                    <button
                      key={valor}
                      onClick={() => setFiltroBebida(valor)}
                      className={
                        'text-sm px-3.5 py-1.5 rounded-full font-medium transition ' +
                        (filtroBebida === valor
                          ? 'bg-[#0E6B7E] text-white'
                          : 'bg-[#F1F5F7] text-[#5B6B73] hover:bg-[#E3E9EC]')
                      }
                    >
                      {rotulo}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#5B6B73] mb-1.5">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'ativo', 'inativo'] as FiltroAtivo[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFiltroAtivo(s)}
                  className={
                    'text-sm px-3.5 py-1.5 rounded-full font-medium transition ' +
                    (filtroAtivo === s
                      ? 'bg-[#0E6B7E] text-white'
                      : 'bg-[#F1F5F7] text-[#5B6B73] hover:bg-[#E3E9EC]')
                  }
                >
                  {rotuloAtivo(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : itens.filter(passaFiltroBebida).length === 0 && busca ? (
          <NadaEncontrado busca={busca} />
        ) : itens.length === 0 ? (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
            <p className="text-[#16252B]">Nenhum item encontrado</p>
            <p className="text-sm text-[#5B6B73] mt-2">
              Tente mudar os filtros ou cadastre um novo produto
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#DCE3E7] rounded-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Quantidade</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Mínimo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Custo (R$)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Total (R$)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6ECEF]">
                {itens.filter(passaFiltroBebida).map((item) => {
                  const total = (item.quantidade_disponivel || 0) * (item.custo_unitario || 0);
                  const status = calcularStatus(item.quantidade_disponivel, item.estoque_minimo);
                  const statusInfo = getStatusDisplay(status);
                  const inativo = item.ingredientes ? item.ingredientes.ativo === false : false;
                  const tipo = item.ingredientes ? item.ingredientes.tipo_produto : '';
                  const rotulo =
                    tipo === 'acabado'
                      ? 'Acabado'
                      : tipo === 'bebida'
                      ? 'Bebida' + (rotuloCategoria(item.ingredientes?.categoria_bebida) ? ' · ' + rotuloCategoria(item.ingredientes?.categoria_bebida) : '')
                      : 'Ingrediente';

                  return (
                    <tr key={item.id} className={'hover:bg-[#F8FAFB] ' + (inativo ? 'opacity-50' : '')}>
                      <td className="px-4 py-4 text-sm">
                        <span className={'inline-flex items-center font-medium ' + statusInfo.cor}>
                          <span className="inline-block h-2 w-2 rounded-full bg-current mr-2" />
                          {statusInfo.label}
                        </span>
                        {inativo && <span className="ml-1 text-xs text-[#8FA0A8]">(inativo)</span>}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-[#16252B]">
                        {item.ingredientes ? item.ingredientes.nome : 'N/A'}
                      </td>
                      <td className="px-4 py-4 text-sm text-[#5B6B73]">{rotulo}</td>
                      <td className="px-4 py-4 text-right text-sm text-[#2B3C44]">
                        {Number(item.quantidade_disponivel).toFixed(2)} {item.unidade}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-[#5B6B73]">
                        {Number(item.estoque_minimo).toFixed(2)} {item.unidade}
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-[#2B3C44]">
                        R$ {(item.custo_unitario || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-[#16252B]">
                        R$ {total.toFixed(2)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-1.5 justify-center flex-wrap">
                          <button
                            onClick={() => {
                              setItemMovimentacao(item);
                              setTipoMovimentacao('entrada');
                            }}
                            className={BTN_ACAO}
                            title="Registrar entrada"
                            aria-label="Registrar entrada"
                          >
                            <IconPlus />
                          </button>
                          <button
                            onClick={() => {
                              setItemMovimentacao(item);
                              setTipoMovimentacao('consumo');
                            }}
                            className={BTN_ACAO}
                            title="Registrar consumo"
                            aria-label="Registrar consumo"
                          >
                            <IconMinus />
                          </button>
                          <button
                            onClick={() => abrirHistorico(item)}
                            className={BTN_ACAO}
                            title="Ver histórico"
                            aria-label="Ver histórico"
                          >
                            <IconList />
                          </button>
                          <Link
                            href={'/estoque/cadastro?id=' + (item.ingredientes ? item.ingredientes.id : '')}
                            className={BTN_ACAO}
                            title="Editar"
                            aria-label="Editar"
                          >
                            <IconEdit />
                          </Link>
                          <button
                            onClick={() => setItemParaDeletar(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE3E7] bg-white text-[#5B6B73] hover:bg-[#FADBD6] hover:text-[#B3261E] transition"
                            title="Excluir"
                            aria-label="Excluir"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {itemMovimentacao && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleMovimentacao} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-[#16252B] mb-4">
              {tipoMovimentacao === 'entrada' ? 'Entrada' : 'Consumo'} —{' '}
              {itemMovimentacao.ingredientes ? itemMovimentacao.ingredientes.nome : ''}
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#2B3C44] mb-1">
                Quantidade ({itemMovimentacao.unidade})
              </label>
              <input
                type="number"
                step="0.01"
                value={qtdMov}
                onChange={(e) => setQtdMov(e.target.value)}
                className="w-full border border-[#C9D3D8] rounded-lg px-3 py-2 text-sm text-[#16252B] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#2B3C44] mb-1">
                Observação (opcional)
              </label>
              <input
                type="text"
                value={obsMov}
                onChange={(e) => setObsMov(e.target.value)}
                className="w-full border border-[#C9D3D8] rounded-lg px-3 py-2 text-sm text-[#16252B] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
                placeholder="Ex: Uso no almoço de segunda"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-[#0E6B7E] hover:bg-[#0B5A6A] text-white py-2.5 rounded-lg font-medium"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemMovimentacao(null);
                  setQtdMov('');
                  setObsMov('');
                }}
                className="flex-1 bg-[#F1F5F7] hover:bg-[#E3E9EC] text-[#2B3C44] py-2.5 rounded-lg font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {showHistorico && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-[#16252B]">
                Histórico — {showHistorico.ingredientes ? showHistorico.ingredientes.nome : ''}
              </h2>
              <button
                onClick={() => setShowHistorico(null)}
                className="text-[#5B6B73] hover:text-[#16252B] text-xl h-9 w-9"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            {historico.length === 0 ? (
              <p className="text-[#5B6B73] text-center py-8">Nenhuma movimentação ainda</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#F4F7F8]">
                  <tr>
                    <th className="px-3 py-2 text-left text-[#5B6B73]">Tipo</th>
                    <th className="px-3 py-2 text-right text-[#5B6B73]">Quantidade</th>
                    <th className="px-3 py-2 text-left text-[#5B6B73]">Observação</th>
                    <th className="px-3 py-2 text-left text-[#5B6B73]">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6ECEF]">
                  {historico.map((mov) => (
                    <tr key={mov.id}>
                      <td className="px-3 py-2 text-[#16252B]">{mov.tipo === 'entrada' ? 'Entrada' : 'Consumo'}</td>
                      <td className="px-3 py-2 text-right text-[#16252B]">{mov.quantidade}</td>
                      <td className="px-3 py-2 text-[#5B6B73]">{mov.observacao || '-'}</td>
                      <td className="px-3 py-2 text-[#5B6B73]">
                        {new Date(mov.criado_em).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {itemParaDeletar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-[#B3261E]">Excluir produto?</h2>
            <p className="text-sm text-[#5B6B73] mb-6">
              Tem certeza que quer excluir{' '}
              <strong className="text-[#16252B]">
                {itemParaDeletar.ingredientes ? itemParaDeletar.ingredientes.nome : ''}
              </strong>
              ? Isso apaga o produto, o estoque e todo o histórico de movimentações. Essa ação não
              pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmarExclusao}
                disabled={deletando}
                className="flex-1 bg-[#B3261E] hover:bg-[#971F18] disabled:opacity-50 text-white py-2.5 rounded-lg font-medium"
              >
                {deletando ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button
                onClick={() => setItemParaDeletar(null)}
                className="flex-1 bg-[#F1F5F7] hover:bg-[#E3E9EC] text-[#2B3C44] py-2.5 rounded-lg font-medium"
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
