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
type FiltroSituacao = 'todas' | 'baixo' | 'zerado' | 'ok';
type Ordem = 'critico' | 'nome' | 'valor';

const chip = (ativo: boolean) =>
  'text-sm px-3.5 py-1.5 rounded-full font-medium transition border ' +
  (ativo ? 'bg-[#0E6B7E] text-white border-[#0E6B7E]' : 'bg-white text-[#5B6B73] border-[#DCE3E7] hover:bg-[#F1F5F7]');

// situação de cada item (cores e textos da etiqueta e da barra de nível)
const SITUACAO = {
  ok: { rotulo: 'Normal', etiqueta: 'bg-[#D9F0E3] text-[#1E6B3F]', barra: '#2E9D5F' },
  alerta: { rotulo: 'Abaixo do mínimo', etiqueta: 'bg-[#FFF0C7] text-[#7A5A0A]', barra: '#E3B341' },
  critico: { rotulo: 'Sem estoque', etiqueta: 'bg-[#FADBD6] text-[#B3261E]', barra: '#B3261E' },
} as const;

const brl = (v: number) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const ROTULO_MOV: Record<string, string> = { entrada: 'Entrada', consumo: 'Consumo', ajuste: 'Ajuste', inventario: 'Inventário', perda: 'Perda' };

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
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas');
  const [ordem, setOrdem] = useState<Ordem>('critico');

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

  const statusDe = (i: ItemEstoque) => calcularStatus(Number(i.quantidade_disponivel) || 0, Number(i.estoque_minimo) || 0);
  const valorDe = (i: ItemEstoque) => (Number(i.quantidade_disponivel) || 0) * (Number(i.custo_unitario) || 0);

  // resumo do topo: considera o tipo e o status escolhidos, não a busca
  const resumo = {
    total: itens.length,
    baixos: itens.filter((i) => statusDe(i) === 'alerta').length,
    zerados: itens.filter((i) => statusDe(i) === 'critico').length,
    valor: itens.reduce((soma, i) => soma + Math.max(valorDe(i), 0), 0),
  };

  const ORDEM_STATUS = { critico: 0, alerta: 1, ok: 2 } as const;
  const visiveis = itens
    .filter(passaFiltroBebida)
    .filter((i) => {
      const st = statusDe(i);
      return situacao === 'todas' || (situacao === 'baixo' && st === 'alerta') || (situacao === 'zerado' && st === 'critico') || (situacao === 'ok' && st === 'ok');
    })
    .sort((a, b) => {
      const nomeA = a.ingredientes?.nome || '';
      const nomeB = b.ingredientes?.nome || '';
      if (ordem === 'valor') return valorDe(b) - valorDe(a) || nomeA.localeCompare(nomeB);
      if (ordem === 'critico') return ORDEM_STATUS[statusDe(a)] - ORDEM_STATUS[statusDe(b)] || nomeA.localeCompare(nomeB);
      return nomeA.localeCompare(nomeB);
    });

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
            <p className="text-sm text-[#5B6B73] mt-1">Ingredientes, produtos acabados e bebidas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/compras" className="btn btn-secundario">
              Compras
            </Link>
            <Link href="/estoque/cadastro" className="btn btn-primario">
              <IconPlus /> Novo produto
            </Link>
          </div>
        </div>

        <ConferenciasPendentes unidadeId={unidadeId} onAlterado={carregar} />

        {(resumo.baixos > 0 || resumo.zerados > 0) && (
          <div className="mb-5 rounded-xl border border-[#F0DFA8] bg-[#FFFAEB] p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[14rem]">
              <p className="text-sm font-semibold text-[#7A5A0A]">
                {resumo.baixos + resumo.zerados} {resumo.baixos + resumo.zerados === 1 ? 'item precisa' : 'itens precisam'} de reposição
              </p>
              <p className="text-sm text-[#5B6B73] mt-0.5">
                {resumo.zerados > 0 && resumo.zerados + (resumo.zerados === 1 ? ' sem estoque' : ' sem estoque')}
                {resumo.zerados > 0 && resumo.baixos > 0 && ' · '}
                {resumo.baixos > 0 && resumo.baixos + ' abaixo do mínimo'}
              </p>
            </div>
            <Link href="/compras/nova?sugestao=1" className="btn btn-primario">
              Montar solicitação de compra
            </Link>
          </div>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setSituacao('todas')}
            className={'text-left rounded-xl border p-4 transition bg-white hover:border-[#0E6B7E] ' + (situacao === 'todas' ? 'border-[#0E6B7E] ring-1 ring-[#0E6B7E]' : 'border-[#DCE3E7]')}
          >
            <span className="block text-xs font-medium text-[#5B6B73]">Produtos</span>
            <span className="block text-2xl font-bold text-[#16252B] mt-1">{resumo.total}</span>
          </button>
          <button
            onClick={() => setSituacao(situacao === 'baixo' ? 'todas' : 'baixo')}
            className={'text-left rounded-xl border p-4 transition hover:border-[#E3B341] ' + (situacao === 'baixo' ? 'border-[#E3B341] ring-1 ring-[#E3B341] bg-[#FFFAEB]' : 'border-[#DCE3E7] bg-white')}
          >
            <span className="block text-xs font-medium text-[#5B6B73]">Abaixo do mínimo</span>
            <span className={'block text-2xl font-bold mt-1 ' + (resumo.baixos > 0 ? 'text-[#7A5A0A]' : 'text-[#16252B]')}>{resumo.baixos}</span>
          </button>
          <button
            onClick={() => setSituacao(situacao === 'zerado' ? 'todas' : 'zerado')}
            className={'text-left rounded-xl border p-4 transition hover:border-[#B3261E] ' + (situacao === 'zerado' ? 'border-[#B3261E] ring-1 ring-[#B3261E] bg-[#FFF5F3]' : 'border-[#DCE3E7] bg-white')}
          >
            <span className="block text-xs font-medium text-[#5B6B73]">Sem estoque</span>
            <span className={'block text-2xl font-bold mt-1 ' + (resumo.zerados > 0 ? 'text-[#B3261E]' : 'text-[#16252B]')}>{resumo.zerados}</span>
          </button>
          <div className="rounded-xl border border-[#DCE3E7] bg-white p-4">
            <span className="block text-xs font-medium text-[#5B6B73]">Valor em estoque</span>
            <span className="block text-2xl font-bold text-[#0E6B7E] mt-1">{brl(resumo.valor)}</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-6 space-y-4">
          <BarraBusca valor={busca} onChange={setBusca} placeholder="Buscar produto ou ingrediente..." />
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5B6B73] mb-1.5">Tipo</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['todos', 'ingrediente', 'acabado', 'bebida'] as FiltroTipo[]).map((t) => (
                  <button key={t} onClick={() => setFiltroTipo(t)} className={chip(filtroTipo === t)}>
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
                      <button key={valor} onClick={() => setFiltroBebida(valor)} className={chip(filtroBebida === valor)}>
                        {rotulo}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#5B6B73] mb-1.5">Situação</label>
              <div className="flex gap-1.5 flex-wrap">
                {([['todas', 'Todas'], ['baixo', 'Abaixo do mínimo'], ['zerado', 'Sem estoque'], ['ok', 'Normal']] as [FiltroSituacao, string][]).map(
                  ([valor, rotulo]) => (
                    <button key={valor} onClick={() => setSituacao(valor)} className={chip(situacao === valor)}>
                      {rotulo}
                    </button>
                  )
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5B6B73] mb-1.5">Cadastro</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['todos', 'ativo', 'inativo'] as FiltroAtivo[]).map((a) => (
                  <button key={a} onClick={() => setFiltroAtivo(a)} className={chip(filtroAtivo === a)}>
                    {rotuloAtivo(a)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5B6B73] mb-1.5">Ordenar por</label>
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as Ordem)}
                className="border border-[#C9D3D8] rounded-lg px-3 py-1.5 text-sm text-[#16252B] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
              >
                <option value="critico">Mais urgentes primeiro</option>
                <option value="nome">Nome (A-Z)</option>
                <option value="valor">Maior valor em estoque</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : itens.length > 0 && visiveis.length === 0 ? (
          busca ? (
            <NadaEncontrado busca={busca} />
          ) : (
            <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
              <p className="text-[#16252B]">Nenhum item nesta situação</p>
              <button onClick={() => setSituacao('todas')} className="mt-3 text-sm font-medium text-[#0E6B7E] hover:underline">
                Ver todos
              </button>
            </div>
          )
        ) : itens.length === 0 ? (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
            <p className="text-[#16252B]">Nenhum item encontrado</p>
            <p className="text-sm text-[#5B6B73] mt-2">
              Tente mudar os filtros ou cadastre um novo produto
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#DCE3E7] rounded-xl overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Situação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Quantidade</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Mínimo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Custo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6ECEF]">
                {visiveis.map((item) => {
                  const status = statusDe(item);
                  const info = SITUACAO[status];
                  const qtdAtual = Number(item.quantidade_disponivel) || 0;
                  const minimo = Number(item.estoque_minimo) || 0;
                  // barra cheia = 2x o mínimo (ou o próprio saldo quando não há mínimo)
                  const nivel = minimo > 0 ? Math.min(100, (Math.max(qtdAtual, 0) / (minimo * 2)) * 100) : qtdAtual > 0 ? 100 : 0;
                  const inativo = item.ingredientes ? item.ingredientes.ativo === false : false;
                  const tipo = item.ingredientes ? item.ingredientes.tipo_produto : '';
                  const rotulo =
                    tipo === 'acabado'
                      ? 'Produto acabado'
                      : tipo === 'bebida'
                      ? 'Bebida' + (rotuloCategoria(item.ingredientes?.categoria_bebida) ? ' · ' + rotuloCategoria(item.ingredientes?.categoria_bebida) : '')
                      : 'Ingrediente';

                  return (
                    <tr key={item.id} className={'hover:bg-[#F8FAFB] ' + (inativo ? 'opacity-50' : '')}>
                      <td className="px-4 py-3.5">
                        <span className="block text-sm font-medium text-[#16252B]">
                          {item.ingredientes ? item.ingredientes.nome : 'N/A'}
                          {inativo && <span className="ml-1.5 text-xs font-normal text-[#8FA0A8]">(inativo)</span>}
                        </span>
                        <span className="block text-xs text-[#8FA0A8] mt-0.5">{rotulo}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ' + info.etiqueta}>{info.rotulo}</span>
                      </td>
                      <td className="px-4 py-3.5 min-w-[9rem]">
                        <span className="block text-sm font-semibold text-[#16252B]">
                          {num(qtdAtual)} <span className="font-normal text-[#5B6B73]">{item.unidade}</span>
                        </span>
                        <span className="mt-1.5 block h-1.5 w-full rounded-full bg-[#E6ECEF] overflow-hidden" aria-hidden>
                          <span className="block h-full rounded-full" style={{ width: nivel + '%', background: info.barra }} />
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-[#5B6B73]">
                        {num(minimo)} {item.unidade}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-[#2B3C44]">{brl(item.custo_unitario || 0)}</td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold text-[#16252B]">{brl(valorDe(item))}</td>
                      <td className="px-4 py-3.5">
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
                          <button onClick={() => abrirHistorico(item)} className={BTN_ACAO} title="Ver histórico" aria-label="Ver histórico">
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
            <p className="px-4 py-2.5 text-xs text-[#8FA0A8] border-t border-[#E6ECEF] bg-[#F8FAFB]">
              {visiveis.length} {visiveis.length === 1 ? 'produto' : 'produtos'} · a barra mostra o saldo: cheia = 2× o mínimo
            </p>
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
                className="btn btn-primario flex-1"
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
                className="btn btn-secundario flex-1"
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
                      <td className="px-3 py-2">
                        <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' + (mov.tipo === 'entrada' ? 'bg-[#D9F0E3] text-[#1E6B3F]' : 'bg-[#F1F5F7] text-[#2B3C44]')}>
                          {ROTULO_MOV[mov.tipo] || mov.tipo}
                        </span>
                      </td>
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
                className="btn btn-perigo-cheio flex-1"
              >
                {deletando ? 'Excluindo...' : 'Sim, excluir'}
              </button>
              <button
                onClick={() => setItemParaDeletar(null)}
                className="btn btn-secundario flex-1"
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
