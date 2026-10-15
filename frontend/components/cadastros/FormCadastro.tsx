'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  buscarCadastroPorId,
  criarCadastro,
  atualizarCadastro,
} from '@/lib/queries/cadastros';

type Campo = {
  chave: string;
  rotulo: string;
  tipo?: 'text' | 'email' | 'date' | 'textarea';
  placeholder?: string;
  maiusculo?: boolean;
  meia?: boolean; // ocupa meia linha (junta com o próximo campo "meia")
};

type Props = {
  tabela: string;
  singular: string;
  rota: string;
  campos: Campo[];
};

const INPUT =
  'w-full border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]';
const LABEL = 'block text-sm font-medium text-[#2B3C44] mb-1';

function FormInner({ tabela, singular, rota, campos }: Props) {
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
  const [valores, setValores] = useState<Record<string, string>>({});
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!editando) return;

    async function carregarDados() {
      try {
        const dados: any = await buscarCadastroPorId(supabase, tabela as any, id!);
        const v: Record<string, string> = {};
        campos.forEach((c) => {
          v[c.chave] = dados[c.chave] || '';
        });
        setValores(v);
        setAtivo(dados.ativo ?? true);
      } catch (err) {
        setErro('Erro ao carregar ' + singular);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [id]);

  function mudar(chave: string, valor: string) {
    setValores((antes) => ({ ...antes, [chave]: valor }));
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!(valores['nome'] || '').trim()) {
      setErro('Preencha o nome.');
      return;
    }

    const params: Record<string, any> = { ativo };
    campos.forEach((c) => {
      const bruto = valores[c.chave] || '';
      if (c.chave === 'nome') params[c.chave] = bruto.trim();
      else if (c.tipo === 'date') params[c.chave] = bruto || null;
      else params[c.chave] = bruto.trim() || null;
    });

    setSalvando(true);
    try {
      if (editando) {
        await atualizarCadastro(supabase, tabela as any, id!, params as any);
      } else {
        await criarCadastro(supabase, tabela as any, { ...params, unidade_id: unidadeId } as any);
      }
      router.push(rota);
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  // agrupa campos "meia" de dois em dois
  const linhas: Campo[][] = [];
  for (let i = 0; i < campos.length; i++) {
    const atual = campos[i];
    const prox = campos[i + 1];
    if (atual.meia && prox && prox.meia) {
      linhas.push([atual, prox]);
      i++;
    } else {
      linhas.push([atual]);
    }
  }

  function renderCampo(c: Campo) {
    const valor = valores[c.chave] || '';
    return (
      <div key={c.chave}>
        <label className={LABEL}>
          {c.rotulo}
          {c.chave === 'nome' && <span className="text-[#B3261E]"> *</span>}
        </label>
        {c.tipo === 'textarea' ? (
          <textarea
            value={valor}
            onChange={(e) => mudar(c.chave, e.target.value)}
            rows={3}
            placeholder={c.placeholder}
            className={INPUT}
          />
        ) : (
          <input
            type={c.tipo || 'text'}
            value={valor}
            onChange={(e) => mudar(c.chave, c.maiusculo ? e.target.value.toUpperCase() : e.target.value)}
            placeholder={c.placeholder}
            className={INPUT}
          />
        )}
      </div>
    );
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
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push(rota)}
            className="h-10 w-10 rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition"
            aria-label="Voltar"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-[#16252B]">
            {editando ? 'Editar ' + singular : 'Novo ' + singular}
          </h1>
        </div>

        <form
          onSubmit={handleSalvar}
          className="bg-white border border-[#DCE3E7] rounded-xl p-6 space-y-5"
        >
          {linhas.map((linha, i) =>
            linha.length === 2 ? (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {linha.map(renderCampo)}
              </div>
            ) : (
              renderCampo(linha[0])
            )
          )}

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

          {erro && (
            <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition"
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar ' + singular}
            </button>
            <button
              type="button"
              onClick={() => router.push(rota)}
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

export default function FormCadastro(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-[#5B6B73]">Carregando...</p>
        </div>
      }
    >
      <FormInner {...props} />
    </Suspense>
  );
}