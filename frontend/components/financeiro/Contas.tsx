'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  listarContas,
  criarConta,
  quitarConta,
  reabrirConta,
  cancelarConta,
  excluirConta,
  situacaoConta,
  hojeISO,
  formatarData,
  formatarReais,
  CATEGORIAS,
  type Conta,
  type TipoConta,
} from '@/lib/queries/financeiroContas';
import { ROTULO_FORMA, rotuloForma } from '@/lib/queries/caixa';

const FORMAS = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'outro'];

const TEXTOS = {
  pagar: {
    titulo: 'Contas a pagar',
    subtitulo: 'Aluguel, energia, fornecedores, salários...',
    pessoa: 'Para quem (opcional)',
    quitar: 'Pagar',
    quitada: 'Paga',
    quitadasMes: 'Pagas este mês',
    exemplo: 'Ex: Conta de luz',
  },
  receber: {
    titulo: 'Contas a receber',
    subtitulo: 'Fiado, eventos, convênios com empresas...',
    pessoa: 'Quem deve (opcional)',
    quitar: 'Recebi',
    quitada: 'Recebida',
    quitadasMes: 'Recebidas este mês',
    exemplo: 'Ex: Fiado do João',
  },
};

const ESTILO_SITUACAO: Record<string, { texto: string; classe: string }> = {
  vencida: { texto: 'Vencida', classe: 'bg-[#FADBD6] text-[#B3261E] border-[#F2C2BB]' },
  vence_logo: { texto: 'Vence em breve', classe: 'bg-[#FFF0C7] text-[#7A5A0A] border-[#E8D28A]' },
  aberta: { texto: 'Em aberto', classe: 'bg-[#F4F7F8] text-[#2B3C44] border-[#DCE3E7]' },
  quitada: { texto: '', classe: 'bg-[#DDF1E4] text-[#1E6B3A] border-[#B7DFC4]' },
  cancelada: { texto: 'Cancelada', classe: 'bg-[#F4F7F8] text-[#8FA0A8] border-[#DCE3E7]' },
};

type Filtro = 'abertas' | 'quitadas' | 'canceladas' | 'todas';

const classeInput =
  'border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]';
const classeBotao =
  'text-xs px-3 py-1.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] font-medium hover:bg-[#F1F5F7] transition';

export default function Contas({ tipo }: { tipo: TipoConta }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;
  const textos = TEXTOS[tipo];
  const categorias = CATEGORIAS[tipo];
  const hoje = hojeISO();

  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('abertas');

  // formulário de nova conta
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('outros');
  const [pessoa, setPessoa] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(hoje);
  const [repetir, setRepetir] = useState('1');
  const [salvando, setSalvando] = useState(false);

  // conta sendo quitada (abre os campos de data e forma de pagamento)
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const [dataQuitacao, setDataQuitacao] = useState(hoje);
  const [forma, setForma] = useState('pix');

  async function carregar() {
    try {
      setContas(await listarContas(supabase, tipo, unidadeId));
      setErro(null);
    } catch (err: any) {
      setErro(
        err?.code === 'PGRST205'
          ? 'A tabela ainda não existe no banco. Rode o arquivo 0016_financeiro_contas.sql no Supabase.'
          : 'Erro ao carregar as contas'
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [tipo]);

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const v = parseFloat(valor);
    const vezes = parseInt(repetir) || 1;
    if (!descricao.trim() || isNaN(v) || v <= 0 || !vencimento) {
      setErro('Informe a descrição, um valor maior que zero e o vencimento.');
      return;
    }
    if (vezes < 1 || vezes > 24) {
      setErro('Repetir: escolha de 1 a 24 meses.');
      return;
    }
    setSalvando(true);
    try {
      await criarConta(supabase, tipo, {
        unidade_id: unidadeId,
        descricao: descricao.trim(),
        categoria,
        pessoa: pessoa.trim() || null,
        valor: v,
        vencimento,
        observacao: null,
        repetir: vezes,
      });
      setDescricao('');
      setPessoa('');
      setValor('');
      setRepetir('1');
      await carregar();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  function abrirQuitacao(c: Conta) {
    setQuitandoId(c.id);
    setDataQuitacao(hoje);
    setForma('pix');
  }

  async function confirmarQuitacao(c: Conta) {
    try {
      await quitarConta(supabase, tipo, c.id, { data: dataQuitacao, forma_pagamento: forma });
      setQuitandoId(null);
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  }

  async function executar(acao: () => Promise<void>, pergunta?: string) {
    if (pergunta && !window.confirm(pergunta)) return;
    try {
      await acao();
      await carregar();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  }

  // resumo do topo
  const abertas = contas.filter((c) => c.status === 'aberta');
  const totalAberto = abertas.reduce((a, c) => a + c.valor, 0);
  const vencidas = abertas.filter((c) => c.vencimento < hoje);
  const totalVencido = vencidas.reduce((a, c) => a + c.valor, 0);
  const mesAtual = hoje.slice(0, 7);
  const totalQuitadoMes = contas
    .filter((c) => c.status === 'quitada' && c.quitado_em?.startsWith(mesAtual))
    .reduce((a, c) => a + c.valor, 0);

  const visiveis = contas.filter((c) =>
    filtro === 'abertas'
      ? c.status === 'aberta'
      : filtro === 'quitadas'
        ? c.status === 'quitada'
        : filtro === 'canceladas'
          ? c.status === 'cancelada'
          : true
  );
  // pagas mais recentes primeiro; abertas pela data de vencimento
  if (filtro === 'quitadas') visiveis.sort((a, b) => (b.quitado_em || '').localeCompare(a.quitado_em || ''));

  if (loading) {
    return <div className="bg-white border border-[#DCE3E7] rounded-xl p-6 text-sm text-[#5B6B73]">Carregando...</div>;
  }

  return (
    <div className="bg-white border border-[#DCE3E7] rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#16252B]">{textos.titulo}</h2>
        <p className="text-sm text-[#5B6B73]">{textos.subtitulo}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
          <p className="text-xs text-[#5B6B73]">Em aberto ({abertas.length})</p>
          <p className="font-bold text-[#16252B]">{formatarReais(totalAberto)}</p>
        </div>
        <div
          className={
            'border rounded-lg p-3 ' +
            (vencidas.length > 0 ? 'bg-[#FADBD6] border-[#F2C2BB]' : 'bg-[#F4F7F8] border-[#DCE3E7]')
          }
        >
          <p className="text-xs text-[#5B6B73]">Vencidas ({vencidas.length})</p>
          <p className={'font-bold ' + (vencidas.length > 0 ? 'text-[#B3261E]' : 'text-[#16252B]')}>
            {formatarReais(totalVencido)}
          </p>
        </div>
        <div className="bg-[#F4F7F8] border border-[#DCE3E7] rounded-lg p-3">
          <p className="text-xs text-[#5B6B73]">{textos.quitadasMes}</p>
          <p className="font-bold text-[#0E6B7E]">{formatarReais(totalQuitadoMes)}</p>
        </div>
      </div>

      <form onSubmit={handleAdicionar} className="border border-[#DCE3E7] rounded-lg p-4 space-y-3 bg-[#FAFCFC]">
        <p className="text-sm font-semibold text-[#16252B]">Nova conta</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={textos.exemplo}
            className={classeInput}
          />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={classeInput}>
            {Object.entries(categorias).map(([chave, rotulo]) => (
              <option key={chave} value={chave}>
                {rotulo}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={pessoa}
            onChange={(e) => setPessoa(e.target.value)}
            placeholder={textos.pessoa}
            className={classeInput}
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor (R$)"
            className={classeInput}
          />
          <label className="text-xs text-[#5B6B73] space-y-1">
            <span>Vencimento</span>
            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className={classeInput + ' w-full'}
            />
          </label>
          <label className="text-xs text-[#5B6B73] space-y-1">
            <span>Repetir por quantos meses (1 = só esta)</span>
            <input
              type="number"
              min="1"
              max="24"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              className={classeInput + ' w-full'}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          {salvando ? 'Salvando...' : '+ Adicionar conta'}
        </button>
      </form>

      {erro && <p className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">{erro}</p>}

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ['abertas', 'Em aberto'],
            ['quitadas', textos.quitada + 's'],
            ['canceladas', 'Canceladas'],
            ['todas', 'Todas'],
          ] as [Filtro, string][]
        ).map(([valorFiltro, rotulo]) => (
          <button
            key={valorFiltro}
            onClick={() => setFiltro(valorFiltro)}
            className={
              'text-xs px-3 py-1.5 rounded-full border font-medium transition ' +
              (filtro === valorFiltro
                ? 'bg-[#0E6B7E] border-[#0E6B7E] text-white'
                : 'bg-white border-[#DCE3E7] text-[#2B3C44] hover:bg-[#F1F5F7]')
            }
          >
            {rotulo}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="text-sm text-[#5B6B73]">Nenhuma conta aqui</p>
      ) : (
        <div className="divide-y divide-[#E6ECEF] border border-[#DCE3E7] rounded-lg">
          {visiveis.map((c) => {
            const situacao = situacaoConta(c, hoje);
            const estilo = ESTILO_SITUACAO[situacao];
            return (
              <div key={c.id} className={'p-3 space-y-2 ' + (c.status === 'cancelada' ? 'opacity-60' : '')}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#16252B]">{c.descricao}</p>
                    <p className="text-xs text-[#5B6B73]">
                      {categorias[c.categoria] || c.categoria}
                      {c.pessoa ? ' · ' + c.pessoa : ''}
                      {' · vence ' + formatarData(c.vencimento)}
                    </p>
                    {c.status === 'quitada' && c.quitado_em && (
                      <p className="text-xs text-[#1E6B3A]">
                        {textos.quitada} em {formatarData(c.quitado_em)} · {rotuloForma(c.forma_pagamento)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#16252B]">{formatarReais(c.valor)}</p>
                    <span className={'inline-block text-[11px] px-2 py-0.5 rounded-full border ' + estilo.classe}>
                      {situacao === 'quitada' ? textos.quitada : estilo.texto}
                    </span>
                  </div>
                </div>

                {quitandoId === c.id ? (
                  <div className="flex gap-2 flex-wrap items-center bg-[#F4F7F8] rounded-lg p-2">
                    <input
                      type="date"
                      value={dataQuitacao}
                      onChange={(e) => setDataQuitacao(e.target.value)}
                      className={classeInput + ' py-1.5'}
                    />
                    <select value={forma} onChange={(e) => setForma(e.target.value)} className={classeInput + ' py-1.5'}>
                      {FORMAS.map((f) => (
                        <option key={f} value={f}>
                          {ROTULO_FORMA[f]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => confirmarQuitacao(c)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#0E6B7E] hover:bg-[#0B5A6A] text-white font-medium transition"
                    >
                      Confirmar
                    </button>
                    <button onClick={() => setQuitandoId(null)} className={classeBotao}>
                      Voltar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {c.status === 'aberta' && (
                      <>
                        <button
                          onClick={() => abrirQuitacao(c)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-[#0E6B7E] hover:bg-[#0B5A6A] text-white font-medium transition"
                        >
                          {textos.quitar}
                        </button>
                        <button
                          onClick={() =>
                            executar(() => cancelarConta(supabase, tipo, c.id), 'Cancelar a conta "' + c.descricao + '"?')
                          }
                          className={classeBotao}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                    {c.status !== 'aberta' && (
                      <button
                        onClick={() =>
                          executar(() => reabrirConta(supabase, tipo, c.id), 'Voltar "' + c.descricao + '" para em aberto?')
                        }
                        className={classeBotao}
                      >
                        Reabrir
                      </button>
                    )}
                    <button
                      onClick={() =>
                        executar(() => excluirConta(supabase, tipo, c.id), 'Excluir a conta "' + c.descricao + '"?')
                      }
                      className="text-xs px-3 py-1.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] font-medium hover:bg-[#FADBD6] transition"
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
