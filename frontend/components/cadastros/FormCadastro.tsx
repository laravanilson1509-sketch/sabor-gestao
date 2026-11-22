'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  buscarCadastroPorId,
  criarCadastro,
  atualizarCadastro,
} from '@/lib/queries/cadastros';
import PageHeader from '@/components/ui/PageHeader';
import FormField, { CAMPO } from '@/components/ui/FormField';

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
  titulo?: string; // nome da lista, usado na trilha (ex.: "Clientes")
};

function FormInner({ tabela, singular, rota, campos, titulo }: Props) {
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

  const erroNome = erro === 'Preencha o nome.' ? erro : null;

  function renderCampo(c: Campo) {
    const valor = valores[c.chave] || '';
    return (
      <FormField key={c.chave} label={c.rotulo} obrigatorio={c.chave === 'nome'} erro={c.chave === 'nome' ? erroNome : null}>
        {(a) =>
          c.tipo === 'textarea' ? (
            <textarea
              {...a}
              value={valor}
              onChange={(e) => mudar(c.chave, e.target.value)}
              rows={3}
              placeholder={c.placeholder}
              className={CAMPO}
            />
          ) : (
            <input
              {...a}
              type={c.tipo || 'text'}
              value={valor}
              onChange={(e) => mudar(c.chave, c.maiusculo ? e.target.value.toUpperCase() : e.target.value)}
              placeholder={c.placeholder}
              className={CAMPO}
            />
          )
        }
      </FormField>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8" aria-busy="true">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="ui-skeleton h-8 w-48" />
          <div className="rounded-card border border-line bg-surface p-6 space-y-5">
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="space-y-2">
                <div className="ui-skeleton h-4 w-24" />
                <div className="ui-skeleton h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const nomeDaLista = titulo || rota.split('/').filter(Boolean).pop()!.replace(/^./, (l) => l.toUpperCase());

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <PageHeader
          trilha={[
            { rotulo: 'Início', href: '/' },
            { rotulo: 'Cadastros', href: '/cadastros' },
            { rotulo: nomeDaLista, href: rota },
            { rotulo: editando ? 'Editar' : 'Novo' },
          ]}
          voltarHref={rota}
          titulo={editando ? 'Editar ' + singular : 'Novo ' + singular}
        />

        <form onSubmit={handleSalvar} noValidate className="bg-surface border border-line rounded-card shadow-token-sm p-6 space-y-5">
          {linhas.map((linha, i) =>
            linha.length === 2 ? (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {linha.map(renderCampo)}
              </div>
            ) : (
              renderCampo(linha[0])
            )
          )}

          <fieldset>
            <legend className="block text-sm font-medium text-ink mb-2">Status</legend>
            <div role="radiogroup" aria-label="Status do cadastro" className="grid grid-cols-2 gap-3">
              {[
                { valor: true, rotulo: 'Ativo', ativoCls: 'border-accent bg-accent-soft text-info' },
                { valor: false, rotulo: 'Inativo', ativoCls: 'border-warning bg-warning-soft text-warning' },
              ].map((op) => (
                <button
                  key={op.rotulo}
                  type="button"
                  role="radio"
                  aria-checked={ativo === op.valor}
                  onClick={() => setAtivo(op.valor)}
                  className={
                    'ui-focus py-2.5 rounded-token border-2 font-medium text-sm transition-colors ' +
                    (ativo === op.valor ? op.ativoCls : 'border-line text-ink-muted hover:border-line-strong')
                  }
                >
                  {op.rotulo}
                </button>
              ))}
            </div>
          </fieldset>

          {erro && !erroNome && (
            <div role="alert" className="text-sm text-danger bg-danger-soft rounded-token px-3 py-2">
              {erro}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={salvando} className="btn btn-primario flex-1">
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar ' + singular}
            </button>
            <button type="button" onClick={() => router.push(rota)} className="btn btn-secundario flex-1">
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
          <p className="text-ink-muted">Carregando...</p>
        </div>
      }
    >
      <FormInner {...props} />
    </Suspense>
  );
}