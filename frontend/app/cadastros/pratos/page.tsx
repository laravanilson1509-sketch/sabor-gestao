'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { listarPratos } from '@/lib/queries/fichasTecnicas';
import { criarPratoSimples, deletarIngrediente } from '@/lib/queries/estoque';

type Prato = {
  id: string;
  nome: string;
  preco_venda: number | null;
  ativo: boolean;
};

const BTN =
  'text-sm px-3 py-1.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] hover:bg-[#F1F5F7] transition';

export default function PratosPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [pratos, setPratos] = useState<Prato[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const lista = await listarPratos(supabase, unidadeId);
      setPratos(lista as Prato[]);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setErro('Informe o nome do prato.');
      return;
    }
    const jaExiste = pratos.some((p) => p.nome.trim().toLowerCase() === nomeLimpo.toLowerCase());
    if (jaExiste) {
      setErro('Já existe um prato com esse nome.');
      return;
    }
    setSalvando(true);
    try {
      await criarPratoSimples(supabase, { nome: nomeLimpo, ativo: true });
      setNome('');
      setShowForm(false);
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function renomear(p: Prato) {
    const novo = window.prompt('Novo nome do prato:', p.nome);
    if (!novo || !novo.trim() || novo.trim() === p.nome) return;
    const { error } = await supabase
      .from('ingredientes')
      .update({ nome: novo.trim() })
      .eq('id', p.id);
    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    await carregar();
  }

  async function alternarAtivo(p: Prato) {
    const { error } = await supabase
      .from('ingredientes')
      .update({ ativo: !p.ativo })
      .eq('id', p.id);
    if (error) {
      alert('Erro: ' + error.message);
      return;
    }
    await carregar();
  }

  async function excluir(p: Prato) {
    const ok = window.confirm(
      'Excluir o prato "' + p.nome + '"? Isso apaga também a ficha técnica dele. Não pode ser desfeito.'
    );
    if (!ok) return;
    try {
      await deletarIngrediente(supabase, p.id);
      await carregar();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link
            href="/cadastros"
            className="h-10 w-10 flex items-center justify-center rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition"
            aria-label="Voltar para Cadastros"
          >
            ←
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#16252B]">Pratos</h1>
            <p className="text-sm text-[#5B6B73]">Pratos do cardápio e seus preços de venda</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-[#0E6B7E] hover:bg-[#0B5A6A] text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            {showForm ? 'Cancelar' : '+ Novo prato'}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCriar}
            className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-6 flex gap-2 flex-wrap"
          >
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do prato. Ex: Tacacá"
              className="flex-1 min-w-48 border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]"
              autoFocus
            />
            <button
              type="submit"
              disabled={salvando}
              className="bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
            >
              {salvando ? 'Salvando...' : 'Cadastrar prato'}
            </button>
            {erro && (
              <p role="alert" className="w-full text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
                {erro}
              </p>
            )}
          </form>
        )}

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : pratos.length === 0 ? (
          <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center">
            <p className="text-[#16252B]">Nenhum prato cadastrado</p>
            <p className="text-sm text-[#5B6B73] mt-2">Clique em + Novo prato para começar</p>
          </div>
        ) : (
          <div className="bg-white border border-[#DCE3E7] rounded-xl overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Prato</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Preço de venda</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6ECEF]">
                {pratos.map((p) => (
                  <tr key={p.id} className={'hover:bg-[#F8FAFB] ' + (p.ativo ? '' : 'opacity-60')}>
                    <td className="px-4 py-4 text-sm font-medium text-[#16252B]">{p.nome}</td>
                    <td className="px-4 py-4 text-right text-sm text-[#2B3C44]">
                      {Number(p.preco_venda) > 0
                        ? 'R$ ' + Number(p.preco_venda).toFixed(2)
                        : 'Não definido'}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {p.ativo ? (
                        <span className="inline-block rounded-full bg-[#D9F0E3] text-[#1E6B3F] px-3 py-1 text-xs font-semibold">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-[#FFF0C7] text-[#7A5A0A] px-3 py-1 text-xs font-semibold">
                          Pausado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5 justify-center flex-wrap">
                        <Link
                          href={'/cadastros/fichas-tecnicas/' + p.id}
                          className="text-sm px-3 py-1.5 rounded-lg bg-[#DCEEF2] text-[#0B4F5E] font-medium hover:bg-[#C9E3EA] transition"
                        >
                          Ficha técnica
                        </Link>
                        <button onClick={() => renomear(p)} className={BTN}>
                          Renomear
                        </button>
                        <button onClick={() => alternarAtivo(p)} className={BTN}>
                          {p.ativo ? 'Pausar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => excluir(p)}
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
    </div>
  );
}