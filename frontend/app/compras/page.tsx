'use client';

import { useEffect, useState } from 'react';
import BarraBusca, { NadaEncontrado } from '@/components/BarraBusca';
import { combina } from '@/lib/busca';
import { grupoDaCategoria } from '@/lib/queries/bebidas';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarSolicitacoes, getStatusLabel, sugerirCompra, type SugestaoCompra } from '@/lib/queries/compras';

type Solicitacao = {
  id: string;
  status: string;
  observacao: string | null;
  criado_em: string;
  fornecedores: { nome: string } | null;
  solicitacoes_compra_itens?: { ingredientes: { tipo_produto: string; categoria_bebida?: string | null } | null }[];
};

type FiltroTipo = 'todos' | 'ingrediente' | 'acabado' | 'bebida';
type FiltroBebida = 'todas' | 'nao_alcoolica' | 'alcoolica';

const TIPOS: { valor: FiltroTipo; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todas' },
  { valor: 'ingrediente', rotulo: 'Ingredientes' },
  { valor: 'acabado', rotulo: 'Produtos acabados' },
  { valor: 'bebida', rotulo: 'Bebidas' },
];

const BEBIDAS: { valor: FiltroBebida; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'nao_alcoolica', rotulo: 'Não alcoólicas' },
  { valor: 'alcoolica', rotulo: 'Alcoólicas' },
];

const ROTULO_TIPO: Record<string, string> = { ingrediente: 'Ingredientes', acabado: 'Acabados', bebida: 'Bebidas' };

const chip = (ativo: boolean) =>
  'text-sm px-3.5 py-1.5 rounded-full font-medium transition border ' +
  (ativo ? 'bg-[#0E6B7E] text-white border-[#0E6B7E]' : 'bg-white text-[#5B6B73] border-[#DCE3E7] hover:bg-[#F1F5F7]');

// tipos de item de uma solicitação (para o filtro e para as etiquetas do cartão)
const tiposDaSolicitacao = (s: Solicitacao) => [
  ...new Set((s.solicitacoes_compra_itens || []).map((i) => i.ingredientes?.tipo_produto).filter(Boolean) as string[]),
];

export default function ComprasPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [itens, setItens] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<SugestaoCompra[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroBebida, setFiltroBebida] = useState<FiltroBebida>('todas');
  // a solicitação aparece se tiver ao menos um item do tipo escolhido
  const passaTipo = (s: Solicitacao) => {
    if (filtroTipo === 'todos') return true;
    const lista = s.solicitacoes_compra_itens || [];
    return lista.some((i) => {
      if (i.ingredientes?.tipo_produto !== filtroTipo) return false;
      if (filtroTipo !== 'bebida' || filtroBebida === 'todas') return true;
      return grupoDaCategoria(i.ingredientes?.categoria_bebida) === filtroBebida;
    });
  };
  const itensFiltrados = itens.filter(passaTipo).filter((s) =>
    combina(busca, s.fornecedores?.nome, s.observacao, getStatusLabel(s.status).label, new Date(s.criado_em).toLocaleDateString('pt-BR'))
  );

  async function carregar() {
    setLoading(true);
    try {
      const data = await listarSolicitacoes(supabase, unidadeId);
      setItens(data as any);
    } catch (err) {
      console.error(err);
    }
    sugerirCompra(supabase, unidadeId)
      .then(setSugestoes)
      .catch(() => setSugestoes([]));
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#16252B]">Compras</h1>
            <p className="text-sm text-[#5B6B73]">Solicitações, cotações e pedidos</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/compras/precos"
              className="px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition"
            >
              Histórico de preços
            </Link>
            <Link
              href="/compras/nova"
              className="btn btn-primario"
            >
              + Nova solicitação
            </Link>
          </div>
        </div>

        {(() => {
          const novas = sugestoes.filter((s) => !s.jaSolicitado);
          if (novas.length === 0) return null;
          return (
            <div className="mb-6 rounded-xl border border-[#F0DFA8] bg-[#FFFAEB] p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[14rem]">
                <p className="text-sm font-semibold text-[#7A5A0A]">
                  {novas.length === 1 ? '1 item' : novas.length + ' itens'} no estoque mínimo ou abaixo
                </p>
                <p className="text-sm text-[#5B6B73] mt-0.5">
                  {novas.slice(0, 4).map((s) => s.nome).join(', ')}
                  {novas.length > 4 && ' e mais ' + (novas.length - 4)}
                </p>
              </div>
              <Link
                href="/compras/nova?sugestao=1"
                className="btn btn-primario"
              >
                Montar solicitação
              </Link>
            </div>
          );
        })()}

        {!loading && itens.length > 0 && (
          <div className="mb-4 space-y-3">
            <BarraBusca valor={busca} onChange={setBusca} placeholder="Buscar por fornecedor, observação ou situação..." />
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map((t) => (
                <button key={t.valor} onClick={() => setFiltroTipo(t.valor)} className={chip(filtroTipo === t.valor)}>
                  {t.rotulo}
                </button>
              ))}
            </div>
            {filtroTipo === 'bebida' && (
              <div className="flex flex-wrap gap-1.5">
                {BEBIDAS.map((b) => (
                  <button key={b.valor} onClick={() => setFiltroBebida(b.valor)} className={chip(filtroBebida === b.valor)}>
                    {b.rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : itens.length === 0 ? (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
            <p className="text-[#2B3C44]">Nenhuma solicitação de compra ainda</p>
            <p className="text-sm text-[#5B6B73] mt-2">Clica em "+ Nova solicitação" para começar</p>
          </div>
        ) : itensFiltrados.length === 0 ? (
          <NadaEncontrado busca={busca} />
        ) : (
          <div className="grid gap-3">
            {itensFiltrados.map((s) => {
              const statusInfo = getStatusLabel(s.status);
              const data = new Date(s.criado_em).toLocaleDateString('pt-BR');
              return (
                <Link
                  key={s.id}
                  href={`/compras/${s.id}`}
                  className="bg-white border border-[#DCE3E7] rounded-xl p-4 hover:border-[#0E6B7E] transition flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.cor}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-[#8FA0A8]">{data}</span>
                      {tiposDaSolicitacao(s).map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[#F1F5F7] text-[#5B6B73]">
                          {ROTULO_TIPO[t] || t}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm font-medium text-[#16252B]">
                      {s.fornecedores?.nome ? `Fornecedor: ${s.fornecedores.nome}` : 'Sem fornecedor definido'}
                    </p>
                    {s.observacao && <p className="text-xs text-[#5B6B73] mt-1">{s.observacao}</p>}
                  </div>
                  <span className="text-[#8FA0A8]">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}