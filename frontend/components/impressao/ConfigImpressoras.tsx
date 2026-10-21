'use client';

// Impressoras, setores de produção, rotas (qual impressora imprime o quê, por
// setor e por terminal), setor de cada produto e o nome deste computador.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  atualizarSetor,
  criarSetor,
  criarTerminal,
  definirRota,
  definirSetorPadrao,
  definirSetorProduto,
  erroImpressao,
  excluirImpressora,
  excluirTerminal,
  impressoraOnline,
  listarProdutosComSetor,
  listarRotas,
  listarSetores,
  listarTerminais,
  renomearTerminal,
  salvarImpressora,
  type Impressora,
  type ProdutoSetor,
  type Rota,
  type Setor,
  type Terminal,
} from '@/lib/queries/impressao';
import { salvarTerminalLocal, terminalAtual, type TerminalLocal } from '@/lib/impressao/terminal';
import { BTN_LINK, BTN_PRIMARY, BTN_SECONDARY, CARTAO, INPUT, LABEL, TITULO_SECAO } from '@/components/pdv/estilos';

type Props = {
  supabase: SupabaseClient;
  unidadeId: string;
  impressoras: Impressora[];
  onImpressorasMudaram: () => Promise<void>;
};

const IMPRESSORA_NOVA: Omit<Impressora, 'id' | 'ultimo_sinal'> & { id?: string } = {
  nome: '',
  largura_mm: 80,
  conexao: 'navegador',
  endereco: null,
  copias: 1,
  fonte: 'normal',
  cortar_papel: true,
  ativo: true,
};

const CONEXOES = {
  navegador: 'Navegador (estação nesta página)',
  escpos_rede: 'ESC/POS em rede (agente)',
  escpos_usb: 'ESC/POS USB (agente)',
};

export default function ConfigImpressoras({ supabase, unidadeId, impressoras, onImpressorasMudaram }: Props) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [terminais, setTerminais] = useState<Terminal[]>([]);
  const [produtos, setProdutos] = useState<ProdutoSetor[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [form, setForm] = useState<typeof IMPRESSORA_NOVA | null>(null);
  const [novoSetor, setNovoSetor] = useState('');
  const [escopo, setEscopo] = useState<string>(''); // '' = todos os terminais
  const [buscaProduto, setBuscaProduto] = useState('');
  const [esteTerminal, setEsteTerminal] = useState<TerminalLocal | null>(null);
  const [nomeTerminal, setNomeTerminal] = useState('');

  async function carregar() {
    try {
      const [s, r, t, p] = await Promise.all([
        listarSetores(supabase, unidadeId),
        listarRotas(supabase, unidadeId),
        listarTerminais(supabase, unidadeId),
        listarProdutosComSetor(supabase),
      ]);
      setSetores(s);
      setRotas(r);
      setTerminais(t);
      setProdutos(p);
      // o terminal salvo neste navegador pode ter sido excluído em outro lugar
      const local = terminalAtual();
      if (local && !t.some((x) => x.id === local.id)) {
        salvarTerminalLocal(null);
        setEsteTerminal(null);
      } else {
        setEsteTerminal(local);
      }
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao carregar a configuração'));
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function acao(fn: () => Promise<unknown>, sucesso?: string) {
    setErro(null);
    setAviso(null);
    try {
      await fn();
      if (sucesso) setAviso(sucesso);
      await carregar();
    } catch (e: any) {
      setErro(erroImpressao(e, 'Não foi possível salvar'));
    }
  }

  // ---------- impressoras ----------

  async function salvarForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.nome.trim()) {
      setErro('Dê um nome para a impressora (ex: Cozinha, Caixa).');
      return;
    }
    await acao(async () => {
      await salvarImpressora(supabase, unidadeId, { ...form, nome: form.nome.trim() });
      await onImpressorasMudaram();
      setForm(null);
    }, 'Impressora salva.');
  }

  async function apagarImpressora(i: Impressora) {
    if (!window.confirm('Excluir a impressora ' + i.nome + '? As rotas dela também somem.')) return;
    await acao(async () => {
      await excluirImpressora(supabase, i.id);
      await onImpressorasMudaram();
    });
  }

  // ---------- rotas ----------

  const terminalEscopo = escopo || null;
  const rotaDe = (documento: 'producao' | 'conta', setorId: string | null, terminal: string | null) =>
    rotas.find(
      (r) => r.documento === documento && r.setor_id === setorId && r.terminal_id === terminal
    )?.impressora_id || '';

  function mudarRota(documento: 'producao' | 'conta', setorId: string | null, impressoraId: string) {
    acao(() =>
      definirRota(supabase, unidadeId, {
        documento,
        setorId,
        terminalId: terminalEscopo,
        impressoraId: impressoraId || null,
      })
    );
  }

  function linhaRota(documento: 'producao' | 'conta', setorId: string | null, rotulo: string, ajuda?: string) {
    const geral = rotaDe(documento, setorId, null);
    const valor = rotaDe(documento, setorId, terminalEscopo);
    return (
      <li key={documento + (setorId || '')} className="px-3 py-2.5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[10rem]">
          <p className="text-sm font-medium text-[#16252B]">{rotulo}</p>
          {ajuda && <p className="text-xs text-[#8FA0A8]">{ajuda}</p>}
        </div>
        <select
          value={valor}
          onChange={(e) => mudarRota(documento, setorId, e.target.value)}
          className={INPUT + ' py-1.5 w-56'}
        >
          <option value="">
            {terminalEscopo
              ? geral
                ? 'Igual aos outros (' + (impressoras.find((i) => i.id === geral)?.nome || '?') + ')'
                : 'Igual aos outros (nenhuma)'
              : 'Não imprimir'}
          </option>
          {impressoras
            .filter((i) => i.ativo)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
        </select>
      </li>
    );
  }

  // ---------- terminal ----------

  async function usarTerminal(e: React.FormEvent) {
    e.preventDefault();
    const nome = nomeTerminal.trim();
    if (!nome) return;
    await acao(async () => {
      const existente = terminais.find((t) => t.nome.toLowerCase() === nome.toLowerCase());
      const t = existente || (await criarTerminal(supabase, unidadeId, nome));
      salvarTerminalLocal({ id: t.id, nome: t.nome });
      setNomeTerminal('');
    }, 'Este computador agora é “' + nome + '”.');
  }

  const produtosFiltrados = produtos.filter((p) =>
    p.nome.toLowerCase().includes(buscaProduto.trim().toLowerCase())
  );
  const setorPadrao = setores.find((s) => s.padrao);

  return (
    <div className="space-y-8">
      {erro && (
        <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
          {erro}
        </div>
      )}
      {aviso && <div className="text-sm text-[#1E6B3F] bg-[#D9F0E3] rounded-lg px-3 py-2">{aviso}</div>}

      {/* ---------------- ESTE COMPUTADOR ---------------- */}
      <section>
        <h2 className={TITULO_SECAO}>Este computador (terminal)</h2>
        <div className={CARTAO + ' p-4 space-y-3'}>
          <p className="text-sm text-[#2B3C44]">
            {esteTerminal ? (
              <>
                Este computador é o terminal <b>{esteTerminal.nome}</b>. O nome sai nos tickets e permite ter impressora
                diferente por terminal.{' '}
                <button
                  onClick={() => {
                    salvarTerminalLocal(null);
                    setEsteTerminal(null);
                  }}
                  className={BTN_LINK}
                >
                  Trocar
                </button>
              </>
            ) : (
              'Este computador ainda não tem nome. Dê um nome (ex: Caixa 1, Bar, Tablet do salão).'
            )}
          </p>
          {!esteTerminal && (
            <form onSubmit={usarTerminal} className="flex flex-wrap gap-2">
              <input
                type="text"
                list="terminais-existentes"
                value={nomeTerminal}
                onChange={(e) => setNomeTerminal(e.target.value)}
                placeholder="Nome do terminal"
                className={INPUT + ' flex-1 min-w-[12rem]'}
              />
              <datalist id="terminais-existentes">
                {terminais.map((t) => (
                  <option key={t.id} value={t.nome} />
                ))}
              </datalist>
              <button type="submit" className={BTN_PRIMARY}>
                Usar este nome
              </button>
            </form>
          )}
          {terminais.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {terminais.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-2 text-xs rounded-full border border-[#DCE3E7] px-3 py-1">
                  {t.nome}
                  <button
                    onClick={() => {
                      const novo = window.prompt('Novo nome do terminal:', t.nome);
                      if (novo && novo.trim()) acao(() => renomearTerminal(supabase, t.id, novo.trim()));
                    }}
                    className="text-[#0E6B7E] hover:underline"
                  >
                    renomear
                  </button>
                  <button
                    onClick={() =>
                      window.confirm('Excluir o terminal ' + t.nome + '? As rotas dele também somem.') &&
                      acao(() => excluirTerminal(supabase, t.id))
                    }
                    className="text-[#8FA0A8] hover:text-[#B3261E]"
                    aria-label={'Excluir ' + t.nome}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------------- IMPRESSORAS ---------------- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className={TITULO_SECAO + ' mb-0'}>Impressoras</h2>
          <button onClick={() => setForm({ ...IMPRESSORA_NOVA })} className={BTN_SECONDARY}>
            + Nova impressora
          </button>
        </div>
        {impressoras.length === 0 ? (
          <div className={CARTAO + ' p-6 text-center text-sm text-[#5B6B73]'}>
            Nenhuma impressora. Cadastre uma para cada local (ex: Cozinha, Bar, Caixa).
          </div>
        ) : (
          <ul className={CARTAO + ' divide-y divide-[#E6ECEF]'}>
            {impressoras.map((i) => (
              <li key={i.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <p className={'text-sm font-medium ' + (i.ativo ? 'text-[#16252B]' : 'text-[#8FA0A8] line-through')}>
                    {i.nome}
                  </p>
                  <p className="text-xs text-[#5B6B73]">
                    {i.largura_mm} mm · {CONEXOES[i.conexao]}
                    {i.endereco && ' · ' + i.endereco} · {i.copias} {i.copias === 1 ? 'via' : 'vias'} · fonte {i.fonte}
                  </p>
                </div>
                <span className={'text-xs font-medium ' + (impressoraOnline(i) ? 'text-[#1E6B3F]' : 'text-[#8FA0A8]')}>
                  {impressoraOnline(i) ? '● online' : '○ sem estação'}
                </span>
                <button onClick={() => setForm({ ...i })} className={BTN_LINK}>
                  Editar
                </button>
                <button onClick={() => apagarImpressora(i)} className="text-xs text-[#8FA0A8] hover:text-[#B3261E]">
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- SETORES ---------------- */}
      <section>
        <h2 className={TITULO_SECAO}>Setores de produção</h2>
        <div className={CARTAO + ' p-4 space-y-3'}>
          <ul className="divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg">
            {setores.map((s) => (
              <li key={s.id} className="px-3 py-2.5 flex flex-wrap items-center gap-3">
                <span className={'flex-1 text-sm font-medium ' + (s.ativo ? 'text-[#16252B]' : 'text-[#8FA0A8] line-through')}>
                  {s.nome}
                  {s.padrao && (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold bg-[#DCEEF2] text-[#0B4F5E]">
                      padrão
                    </span>
                  )}
                </span>
                {!s.padrao && s.ativo && (
                  <button onClick={() => acao(() => definirSetorPadrao(supabase, unidadeId, s.id))} className={BTN_LINK}>
                    Tornar padrão
                  </button>
                )}
                {!s.padrao && (
                  <button
                    onClick={() => acao(() => atualizarSetor(supabase, s.id, { ativo: !s.ativo }))}
                    className="text-xs text-[#8FA0A8] hover:text-[#16252B]"
                  >
                    {s.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#8FA0A8]">
            Produto sem setor vai para o setor padrão. Setor desativado manda os itens para o padrão.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!novoSetor.trim()) return;
              acao(async () => {
                await criarSetor(supabase, unidadeId, novoSetor.trim(), setores.length + 1);
                setNovoSetor('');
              });
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={novoSetor}
              onChange={(e) => setNovoSetor(e.target.value)}
              placeholder="Novo setor (ex: Pizzaria, Churrasqueira)"
              className={INPUT + ' flex-1 min-w-0'}
            />
            <button type="submit" className={BTN_SECONDARY}>
              Adicionar
            </button>
          </form>
        </div>
      </section>

      {/* ---------------- ROTAS ---------------- */}
      <section>
        <h2 className={TITULO_SECAO}>Qual impressora imprime o quê</h2>
        <div className={CARTAO + ' p-4 space-y-3'}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-[#2B3C44]">Regras para</label>
            <select value={escopo} onChange={(e) => setEscopo(e.target.value)} className={INPUT + ' py-1.5'}>
              <option value="">Todos os terminais</option>
              {terminais.map((t) => (
                <option key={t.id} value={t.id}>
                  Só o terminal {t.nome}
                </option>
              ))}
            </select>
          </div>
          {escopo && (
            <p className="text-xs text-[#8FA0A8]">
              Exceção para este terminal: o que não for escolhido aqui segue a regra de todos os terminais.
            </p>
          )}
          <ul className="divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg">
            {setores
              .filter((s) => s.ativo)
              .map((s) => linhaRota('producao', s.id, 'Produção · ' + s.nome, 'Tickets, acréscimos, alterações e cancelamentos'))}
            {linhaRota('conta', null, 'Conta', 'Pré-conta, comprovante de pagamento e via do estabelecimento')}
          </ul>
        </div>
      </section>

      {/* ---------------- PRODUTOS ---------------- */}
      <section>
        <h2 className={TITULO_SECAO}>Setor de cada produto</h2>
        <div className={CARTAO + ' p-4 space-y-3'}>
          <input
            type="text"
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Buscar produto..."
            className={INPUT + ' w-full'}
          />
          {produtosFiltrados.length === 0 ? (
            <p className="text-sm text-[#5B6B73] text-center py-4">Nenhum produto.</p>
          ) : (
            <ul className="divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg max-h-[28rem] overflow-y-auto">
              {produtosFiltrados.map((p) => (
                <li key={p.id} className="px-3 py-2 flex flex-wrap items-center gap-3">
                  <span className="flex-1 min-w-[10rem] text-sm text-[#16252B]">
                    {p.nome}
                    <span className="text-xs text-[#8FA0A8]"> · {p.tipo_produto === 'acabado' ? 'Produto acabado' : p.tipo_produto === 'bebida' ? 'Bebida' : 'Prato'}</span>
                  </span>
                  <select
                    value={p.setor_id || ''}
                    onChange={(e) => acao(() => definirSetorProduto(supabase, p.id, e.target.value || null))}
                    className={INPUT + ' py-1.5 w-48'}
                  >
                    <option value="">Padrão ({setorPadrao?.nome || '—'})</option>
                    {setores
                      .filter((s) => s.ativo)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------- FORMULÁRIO DA IMPRESSORA ---------------- */}
      {form && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={salvarForm} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-[#16252B]">{form.id ? 'Editar impressora' : 'Nova impressora'}</h2>
            <div>
              <label className={LABEL}>Nome</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Cozinha"
                className={INPUT + ' w-full'}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Papel</label>
                <select
                  value={form.largura_mm}
                  onChange={(e) => setForm({ ...form, largura_mm: Number(e.target.value) as 58 | 80 })}
                  className={INPUT + ' w-full'}
                >
                  <option value={80}>80 mm</option>
                  <option value={58}>58 mm</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Vias</label>
                <select
                  value={form.copias}
                  onChange={(e) => setForm({ ...form, copias: Number(e.target.value) })}
                  className={INPUT + ' w-full'}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Fonte</label>
                <select
                  value={form.fonte}
                  onChange={(e) => setForm({ ...form, fonte: e.target.value as 'normal' | 'grande' })}
                  className={INPUT + ' w-full'}
                >
                  <option value="normal">Normal</option>
                  <option value="grande">Grande</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Situação</label>
                <select
                  value={form.ativo ? '1' : '0'}
                  onChange={(e) => setForm({ ...form, ativo: e.target.value === '1' })}
                  className={INPUT + ' w-full'}
                >
                  <option value="1">Ativa</option>
                  <option value="0">Desativada</option>
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL}>Como imprime</label>
              <select
                value={form.conexao}
                onChange={(e) => setForm({ ...form, conexao: e.target.value as Impressora['conexao'] })}
                className={INPUT + ' w-full'}
              >
                {Object.entries(CONEXOES).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {form.conexao !== 'navegador' && (
              <div>
                <label className={LABEL}>{form.conexao === 'escpos_rede' ? 'IP e porta' : 'Porta USB'}</label>
                <input
                  type="text"
                  value={form.endereco || ''}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value || null })}
                  placeholder={form.conexao === 'escpos_rede' ? '192.168.0.50:9100' : 'USB001'}
                  className={INPUT + ' w-full'}
                />
                <p className="text-xs text-[#8FA0A8] mt-1">
                  Fica guardado para o agente ESC/POS. Enquanto ele não estiver instalado, os tickets desta impressora
                  esperam na fila.
                </p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-[#2B3C44]">
              <input
                type="checkbox"
                checked={form.cortar_papel}
                onChange={(e) => setForm({ ...form, cortar_papel: e.target.checked })}
              />
              Cortar o papel no fim (guilhotina)
            </label>
            <div className="flex gap-3">
              <button type="submit" className={BTN_PRIMARY + ' flex-1'}>
                Salvar
              </button>
              <button type="button" onClick={() => setForm(null)} className={BTN_SECONDARY + ' flex-1'}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
