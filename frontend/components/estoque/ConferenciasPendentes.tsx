'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  listarPendenciasAbertas,
  conferirPendencia,
  EVENTO_PENDENCIAS,
  type PendenciaEstoque,
} from '@/lib/queries/pendenciasEstoque';

const INPUT =
  'border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]';
const BTN_PRIMARY =
  'bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition';
const BTN_SECONDARY =
  'px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition';

const SELO: Record<PendenciaEstoque['tipo'], { rotulo: string; cor: string }> = {
  estoque_insuficiente: { rotulo: 'Estoque insuficiente', cor: 'bg-[#FADBD6] text-[#B3261E]' },
  sem_ficha: { rotulo: 'Sem ficha técnica', cor: 'bg-[#FFF0C7] text-[#7A5A0A]' },
  unidade_diferente: { rotulo: 'Unidade diferente', cor: 'bg-[#E6E4F7] text-[#3F3A8C]' },
};

const qtd = (v: number | null) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
  ' ' +
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function descricao(p: PendenciaEstoque) {
  const onde = p.origem ? ' (' + p.origem + ')' : '';
  if (p.tipo === 'estoque_insuficiente') {
    const faltou = Number(p.quantidade_necessaria || 0) - Number(p.quantidade_baixada || 0);
    return (
      'Faltou ' + qtd(faltou) + ' ' + (p.unidade || '') + ' de ' + p.ingrediente_nome +
      ' ao preparar ' + p.produto_nome + onde + '. O sistema só tinha ' +
      qtd(p.quantidade_baixada) + ' ' + (p.unidade || '') + '.'
    );
  }
  if (p.tipo === 'unidade_diferente') {
    return (
      'A ficha de ' + p.produto_nome + ' usa ' + p.unidade + ' para ' + p.ingrediente_nome +
      onde + '. Como a unidade não bate, nada foi baixado.'
    );
  }
  return qtd(p.quantidade_necessaria) + '× ' + p.produto_nome + onde +
    ' foi preparado sem ficha técnica. Nada saiu do estoque.';
}

export default function ConferenciasPendentes({
  unidadeId,
  onAlterado,
}: {
  unidadeId: string;
  onAlterado: () => void;
}) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [pendencias, setPendencias] = useState<PendenciaEstoque[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [contado, setContado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      setPendencias(await listarPendenciasAbertas(supabase, unidadeId));
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar as conferências');
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrir(p: PendenciaEstoque) {
    setAberta(aberta === p.id ? null : p.id);
    setContado('');
    setObservacao('');
    setErro(null);
  }

  async function confirmar(p: PendenciaEstoque) {
    const texto = contado.trim().replace(',', '.');
    const quantidade = texto === '' ? null : parseFloat(texto);
    if (quantidade !== null && (isNaN(quantidade) || quantidade < 0)) {
      setErro('Informe uma quantidade válida.');
      return;
    }
    if (p.tipo !== 'estoque_insuficiente' && !observacao.trim()) {
      setErro('Escreva uma observação sobre o que foi conferido.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await conferirPendencia(supabase, {
        pendencia: p,
        unidadeId,
        quantidadeContada: p.tipo === 'estoque_insuficiente' ? quantidade : null,
        observacao: observacao.trim() || null,
      });
      setAberta(null);
      await carregar();
      window.dispatchEvent(new Event(EVENTO_PENDENCIAS));
      onAlterado();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar a conferência');
    }
    setSalvando(false);
  }

  if (pendencias.length === 0) return null;

  return (
    <div className="bg-white border border-[#E8D28A] rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-semibold text-[#16252B]">Conferências pendentes</h2>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#FFF0C7] text-[#7A5A0A]">
          {pendencias.length}
        </span>
      </div>
      <p className="text-sm text-[#5B6B73] mb-3">
        Itens preparados na cozinha em que a baixa automática do estoque não saiu completa.
      </p>

      {erro && (
        <div role="alert" className="mb-3 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
          {erro}
        </div>
      )}

      <ul className="divide-y divide-[#E6ECEF] border-t border-[#E6ECEF]">
        {pendencias.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[220px]">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + SELO[p.tipo].cor}>
                    {SELO[p.tipo].rotulo}
                  </span>
                  <span className="text-xs text-[#8FA0A8]">{dataHora(p.criado_em)}</span>
                </div>
                <p className="text-sm text-[#16252B]">{descricao(p)}</p>
              </div>
              <button onClick={() => abrir(p)} className={BTN_SECONDARY}>
                {aberta === p.id ? 'Cancelar' : 'Conferir'}
              </button>
            </div>

            {aberta === p.id && (
              <div className="mt-3 bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3 space-y-3">
                {p.tipo === 'estoque_insuficiente' ? (
                  <div>
                    <label className="block text-sm font-medium text-[#2B3C44] mb-1">
                      Quanto tem de {p.ingrediente_nome} agora? ({p.unidade})
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={contado}
                      onChange={(e) => setContado(e.target.value)}
                      placeholder="Conte e digite a quantidade"
                      className={INPUT + ' w-full sm:w-64'}
                    />
                    <p className="text-xs text-[#8FA0A8] mt-1">
                      O estoque será corrigido para esse valor. Deixe em branco para só confirmar.
                    </p>
                  </div>
                ) : (
                  p.produto_id && (
                    <Link
                      href={'/cadastros/fichas-tecnicas/' + p.produto_id}
                      className="inline-block text-sm font-medium text-[#0E6B7E] hover:underline"
                    >
                      {p.tipo === 'sem_ficha' ? 'Cadastrar ficha técnica de ' : 'Revisar ficha técnica de '}
                      {p.produto_nome} →
                    </Link>
                  )
                )}

                <div>
                  <label className="block text-sm font-medium text-[#2B3C44] mb-1">
                    Observação {p.tipo === 'estoque_insuficiente' ? '(opcional)' : ''}
                  </label>
                  <input
                    type="text"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder={
                      p.tipo === 'estoque_insuficiente'
                        ? 'Ex: entrada de compra não tinha sido lançada'
                        : 'Ex: conferido com a cozinha, usou 300 g de camarão'
                    }
                    className={INPUT + ' w-full'}
                  />
                </div>

                <button onClick={() => confirmar(p)} disabled={salvando} className={BTN_PRIMARY}>
                  {salvando ? 'Salvando...' : 'Confirmar conferência'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
