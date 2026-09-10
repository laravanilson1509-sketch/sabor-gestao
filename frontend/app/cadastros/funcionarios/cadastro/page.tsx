'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { buscarCadastroPorId, criarCadastro, atualizarCadastro } from '@/lib/queries/cadastros';

function CadastroFuncionarioInner() {
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
  const [cargo, setCargo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!editando) return;
    async function carregar() {
      try {
        const dados = await buscarCadastroPorId(supabase, 'funcionarios', id!);
        setNome(dados.nome || '');
        setCargo(dados.cargo || '');
        setTelefone(dados.telefone || '');
        setEmail(dados.email || '');
        setDataAdmissao(dados.data_admissao || '');
        setAtivo(dados.ativo ?? true);
      } catch {
        setErro('Erro ao carregar funcionário');
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, [id]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) { setErro('Preenche o nome.'); return; }

    setSalvando(true);
    try {
      const params = {
        nome: nome.trim(),
        cargo: cargo.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        data_admissao: dataAdmissao || null,
        ativo,
      };

      if (editando) {
        await atualizarCadastro(supabase, 'funcionarios', id!, params);
      } else {
        await criarCadastro(supabase, 'funcionarios', { ...params, unidade_id: unidadeId });
      }
      router.push('/cadastros/funcionarios');
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/cadastros/funcionarios')} className="text-gray-500 hover:text-gray-700 text-xl">←</button>
          <h1 className="text-2xl font-bold text-gray-900">
            {editando ? '✏️ Editar funcionário' : '+ Novo funcionário'}
          </h1>
        </div>

        <form onSubmit={handleSalvar} className="bg-white rounded-lg shadow p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João Pereira"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ex: Cozinheiro, Garçom"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de admissão</label>
              <input
                type="date"
                value={dataAdmissao}
                onChange={(e) => setDataAdmissao(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(44) 99999-9999"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="funcionario@email.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setAtivo(true)}
                className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition ${ativo ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                ✅ Ativo
              </button>
              <button
                type="button"
                onClick={() => setAtivo(false)}
                className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition ${!ativo ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                ⏸️ Inativo
              </button>
            </div>
          </div>

          {erro && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {erro}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition"
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar funcionário'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/cadastros/funcionarios')}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CadastroFuncionarioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Carregando...</p></div>}>
      <CadastroFuncionarioInner />
    </Suspense>
  );
}