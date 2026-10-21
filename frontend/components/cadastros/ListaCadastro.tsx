'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarCadastros, deletarCadastro } from '@/lib/queries/cadastros';
import { diaMes, proximoAniversario } from '@/lib/queries/aniversarios';

type Coluna = { chave: string; rotulo: string; tipo?: 'aniversario' };

type Props = {
  tabela: string;
  titulo: string;
  singular: string;
  rota: string;
  colunas: Coluna[];
};

export default function ListaCadastro({ tabela, titulo, singular, rota, colunas }: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paraDeletar, setParaDeletar] = useState<any | null>(null);
  const [deletando, setDeletando] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const data = await listarCadastros(supabase, tabela as any, unidadeId);
      setItens((data as any[]) || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function confirmarExclusao() {
    if (!paraDeletar) return;
    setDeletando(true);
    try {
      await deletarCadastro(supabase, tabela as any, paraDeletar.id);
      setParaDeletar(null);
      await carregar();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setDeletando(false);
    }
  }

  // dia/mês do aniversário, com destaque para hoje e para os próximos 7 dias
  function celulaAniversario(data: string | null) {
    if (!data) return '-';
    const { faltam } = proximoAniversario(data);
    return (
      <span>
        {diaMes(data)}
        {faltam === 0 && (
          <span className="ml-2 rounded-full bg-[#FFF0C7] text-[#7A5A0A] px-2.5 py-0.5 text-xs font-semibold">
            🎂 Hoje!
          </span>
        )}
        {faltam > 0 && faltam <= 7 && (
          <span className="ml-2 text-xs text-[#8FA0A8]">em {faltam} {faltam === 1 ? 'dia' : 'dias'}</span>
        )}
      </span>
    );
  }

  const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]';

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link
            href="/cadastros"
            className="h-10 w-10 flex items-center justify-center rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition"
            aria-label="Voltar para Cadastros"
          >
            ←
          </Link>
          <h1 className="flex-1 text-2xl font-bold text-[#16252B]">{titulo}</h1>
          <Link
            href={rota + '/cadastro'}
            className="bg-[#0E6B7E] hover:bg-[#0B5A6A] text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            + Novo {singular}
          </Link>
        </div>

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : itens.length === 0 ? (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
            <p className="text-[#16252B]">Nenhum {singular} cadastrado</p>
            <p className="text-sm text-[#5B6B73] mt-2">Clique em + Novo {singular} para começar</p>
          </div>
        ) : (
          <div className="bg-white border border-[#DCE3E7] rounded-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
                <tr>
                  <th className={TH}>Nome</th>
                  {colunas.map((c) => (
                    <th key={c.chave} className={TH}>
                      {c.rotulo}
                    </th>
                  ))}
                  <th className={TH}>Status</th>
                  <th className={TH + ' text-center'}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6ECEF]">
                {itens.map((item) => (
                  <tr key={item.id} className={'hover:bg-[#F8FAFB] ' + (item.ativo ? '' : 'opacity-60')}>
                    <td className="px-4 py-4 text-sm font-medium text-[#16252B]">{item.nome}</td>
                    {colunas.map((c) => (
                      <td key={c.chave} className="px-4 py-4 text-sm text-[#2B3C44]">
                        {c.tipo === 'aniversario' ? celulaAniversario(item[c.chave]) : item[c.chave] || '-'}
                      </td>
                    ))}
                    <td className="px-4 py-4 text-sm">
                      {item.ativo ? (
                        <span className="inline-block rounded-full bg-[#D9F0E3] text-[#1E6B3F] px-3 py-1 text-xs font-semibold">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-[#FFF0C7] text-[#7A5A0A] px-3 py-1 text-xs font-semibold">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5 justify-center">
                        <Link
                          href={rota + '/cadastro?id=' + item.id}
                          className="text-sm px-3 py-1.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] hover:bg-[#F1F5F7] transition"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => setParaDeletar(item)}
                          className="text-sm px-3 py-1.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] hover:bg-[#FADBD6] transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paraDeletar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-2 text-[#B3261E]">Excluir {singular}?</h2>
            <p className="text-sm text-[#5B6B73] mb-6">
              Tem certeza que quer excluir{' '}
              <strong className="text-[#16252B]">{paraDeletar.nome}</strong>? Essa ação não pode ser
              desfeita.
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
                onClick={() => setParaDeletar(null)}
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