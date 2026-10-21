'use client';

// Regras da conta (taxa de serviço, limite de desconto, impressão automática,
// cabeçalho do cupom), equipe com PIN, quadro de permissões e auditoria.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { carregarConfig, salvarConfig, erroImpressao, type ConfigPdv } from '@/lib/queries/impressao';
import {
  listarAuditoria,
  listarOperadores,
  salvarOperador,
  PERFIS,
  PERMISSOES,
  ROTULO_ACAO,
  type Operador,
  type RegistroAuditoria,
} from '@/lib/queries/conta';
import { resumoDetalhes } from '@/components/pdv/HistoricoPedido';
import { BTN_LINK, BTN_PRIMARY, BTN_SECONDARY, CARTAO, INPUT, LABEL, TITULO_SECAO, dataHora } from '@/components/pdv/estilos';

type Props = { supabase: SupabaseClient; unidadeId: string };

type FormOperador = { id?: string; nome: string; perfil: Operador['perfil']; ativo: boolean; pinNovo: string; pinAutorizador: string };

export default function ConfigConta({ supabase, unidadeId }: Props) {
  const [config, setConfig] = useState<ConfigPdv | null>(null);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([]);
  const [form, setForm] = useState<FormOperador | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const seteDias = new Date(Date.now() - 7 * 86400000).toISOString();
    try {
      const [c, o, a] = await Promise.all([
        carregarConfig(supabase, unidadeId),
        listarOperadores(supabase, unidadeId),
        listarAuditoria(supabase, unidadeId, seteDias),
      ]);
      setConfig(c);
      setOperadores(o);
      setAuditoria(a);
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao carregar'));
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const temGestor = operadores.some((o) => o.ativo && (o.perfil === 'gerente' || o.perfil === 'administrador'));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      await salvarConfig(supabase, config);
      setAviso('Regras salvas. Valem para as próximas contas abertas.');
    } catch (err: any) {
      setErro(erroImpressao(err, 'Erro ao salvar'));
    }
    setSalvando(false);
  }

  async function salvarForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErroForm(null);
    try {
      await salvarOperador(supabase, unidadeId, form);
      setForm(null);
      setAviso('Operador salvo.');
      await carregar();
    } catch (err: any) {
      setErroForm(err.message || 'Erro ao salvar');
    }
  }

  const campo = <K extends keyof ConfigPdv>(chave: K, valor: ConfigPdv[K]) =>
    setConfig((c) => (c ? { ...c, [chave]: valor } : c));

  const caixa = (chave: keyof ConfigPdv, rotulo: string, ajuda?: string) => (
    <label className="flex items-start gap-2 text-sm text-[#2B3C44]">
      <input
        type="checkbox"
        checked={Boolean(config?.[chave])}
        onChange={(e) => campo(chave, e.target.checked as never)}
        className="mt-0.5"
      />
      <span>
        {rotulo}
        {ajuda && <span className="block text-xs text-[#8FA0A8]">{ajuda}</span>}
      </span>
    </label>
  );

  return (
    <div className="space-y-8">
      {erro && (
        <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
          {erro}
        </div>
      )}
      {aviso && <div className="text-sm text-[#1E6B3F] bg-[#D9F0E3] rounded-lg px-3 py-2">{aviso}</div>}

      {/* ---------------- EQUIPE ---------------- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className={TITULO_SECAO + ' mb-0'}>Equipe e PIN</h2>
          <button
            onClick={() => {
              setErroForm(null);
              setForm({ nome: '', perfil: temGestor ? 'atendente' : 'administrador', ativo: true, pinNovo: '', pinAutorizador: '' });
            }}
            className={BTN_SECONDARY}
          >
            + Novo operador
          </button>
        </div>
        {!temGestor && (
          <p className="text-sm text-[#7A5A0A] bg-[#FFF0C7] rounded-lg px-3 py-2 mb-3">
            Comece cadastrando você como Administrador com um PIN. Sem isso, ninguém consegue autorizar desconto,
            cancelamento ou reabertura.
          </p>
        )}
        {operadores.length > 0 && (
          <ul className={CARTAO + ' divide-y divide-[#E6ECEF]'}>
            {operadores.map((o) => (
              <li key={o.id} className="px-4 py-3 flex items-center gap-3">
                <span className={'flex-1 text-sm font-medium ' + (o.ativo ? 'text-[#16252B]' : 'text-[#8FA0A8] line-through')}>
                  {o.nome}
                </span>
                <span className="text-xs rounded-full px-2.5 py-0.5 bg-[#F1F5F7] text-[#2B3C44]">{PERFIS[o.perfil]}</span>
                <button
                  onClick={() => {
                    setErroForm(null);
                    setForm({ id: o.id, nome: o.nome, perfil: o.perfil, ativo: o.ativo, pinNovo: '', pinAutorizador: '' });
                  }}
                  className={BTN_LINK}
                >
                  Editar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- PERMISSÕES ---------------- */}
      <section>
        <h2 className={TITULO_SECAO}>Quem pode autorizar</h2>
        <div className={CARTAO + ' overflow-x-auto'}>
          <table className="w-full">
            <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ação</th>
                {(['atendente', 'caixa', 'gerente', 'administrador'] as const).map((p) => (
                  <th key={p} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">
                    {PERFIS[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6ECEF]">
              {PERMISSOES.map((p) => (
                <tr key={p.acao}>
                  <td className="px-4 py-2.5 text-sm text-[#2B3C44]">{p.rotulo}</td>
                  {(['atendente', 'caixa', 'gerente', 'administrador'] as const).map((perfil) => (
                    <td key={perfil} className="px-3 py-2.5 text-center text-sm">
                      {p.perfis.includes(perfil) ? <span className="text-[#1E6B3F]">✓</span> : <span className="text-[#C9D3D8]">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#8FA0A8] mt-2">
          Sem PIN: lançar itens, tirar da comanda o que ainda não foi enviado, enviar para a produção, pré-conta,
          receber pagamento, fechar conta paga e reimprimir (a reimpressão fica registrada com o login).
        </p>
      </section>

      {/* ---------------- REGRAS DA CONTA ---------------- */}
      {config && (
        <form onSubmit={salvar}>
          <h2 className={TITULO_SECAO}>Regras da conta e do cupom</h2>
          <div className={CARTAO + ' p-4 space-y-5'}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={LABEL}>Nome no cupom</label>
                <input
                  type="text"
                  value={config.nome_estabelecimento || ''}
                  onChange={(e) => campo('nome_estabelecimento', e.target.value || null)}
                  className={INPUT + ' w-full'}
                />
              </div>
              <div>
                <label className={LABEL}>CNPJ / CPF</label>
                <input
                  type="text"
                  value={config.documento || ''}
                  onChange={(e) => campo('documento', e.target.value || null)}
                  className={INPUT + ' w-full'}
                />
              </div>
              <div>
                <label className={LABEL}>Telefone</label>
                <input
                  type="text"
                  value={config.telefone || ''}
                  onChange={(e) => campo('telefone', e.target.value || null)}
                  className={INPUT + ' w-full'}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Endereço</label>
                <input
                  type="text"
                  value={config.endereco || ''}
                  onChange={(e) => campo('endereco', e.target.value || null)}
                  className={INPUT + ' w-full'}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Rodapé do cupom</label>
                <input
                  type="text"
                  value={config.rodape || ''}
                  onChange={(e) => campo('rodape', e.target.value || null)}
                  className={INPUT + ' w-full'}
                />
              </div>
            </div>

            <div className="border-t border-[#E6ECEF] pt-4 space-y-3">
              <p className="text-sm font-semibold text-[#16252B]">Taxa de serviço</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={Number(config.taxa_servico_pct)}
                  onChange={(e) => campo('taxa_servico_pct', Number(e.target.value) || 0)}
                  className={INPUT + ' w-24'}
                />
                <span className="text-sm text-[#2B3C44]">% sobre os itens (depois do desconto)</span>
              </div>
              {caixa('taxa_servico_mesa', 'Cobrar nas mesas')}
              {caixa('taxa_servico_balcao', 'Cobrar no balcão')}
              {caixa('remover_taxa_exige_pin', 'Retirar a taxa pede PIN', 'Desmarcado: qualquer um retira (fica registrado)')}
            </div>

            <div className="border-t border-[#E6ECEF] pt-4 space-y-3">
              <p className="text-sm font-semibold text-[#16252B]">Desconto e caixa</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={Number(config.desconto_max_caixa_pct)}
                  onChange={(e) => campo('desconto_max_caixa_pct', Number(e.target.value) || 0)}
                  className={INPUT + ' w-24'}
                />
                <span className="text-sm text-[#2B3C44]">% de desconto máximo com PIN do caixa (acima disso, gerente)</span>
              </div>
              {caixa('exigir_caixa_aberto', 'Só receber pagamento com o caixa aberto', 'Recomendado: assim o dinheiro sempre cai em um caixa para conferência')}
            </div>

            <div className="border-t border-[#E6ECEF] pt-4 space-y-3">
              <p className="text-sm font-semibold text-[#16252B]">Impressão automática</p>
              {caixa('imprimir_producao_auto', 'Imprimir o ticket de produção ao enviar o pedido')}
              {caixa('imprimir_comprovante_auto', 'Imprimir o comprovante ao fechar a conta')}
              {caixa('imprimir_via_estabelecimento', 'Imprimir também a via do estabelecimento', 'Mostra itens cancelados, para controle interno')}
            </div>

            <button type="submit" disabled={salvando} className={BTN_PRIMARY}>
              {salvando ? 'Salvando...' : 'Salvar regras'}
            </button>
          </div>
        </form>
      )}

      {/* ---------------- AUDITORIA ---------------- */}
      <section>
        <h2 className={TITULO_SECAO}>Auditoria · últimos 7 dias</h2>
        {auditoria.length === 0 ? (
          <div className={CARTAO + ' p-6 text-center text-sm text-[#5B6B73]'}>Nenhuma ação sensível registrada.</div>
        ) : (
          <ul className={CARTAO + ' divide-y divide-[#E6ECEF]'}>
            {auditoria.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <p className="text-[#16252B]">
                  <span className="font-medium">{ROTULO_ACAO[a.acao] || a.acao}</span>
                  {resumoDetalhes(a.acao, a.detalhes) && ' · ' + resumoDetalhes(a.acao, a.detalhes)}
                </p>
                <p className="text-xs text-[#5B6B73]">
                  {dataHora(a.criado_em)}
                  {a.autorizado_por_nome && ' · autorizado por ' + a.autorizado_por_nome}
                  {a.operador_email && ' · login ' + a.operador_email}
                  {a.motivo && ' · motivo: ' + a.motivo}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- FORMULÁRIO DO OPERADOR ---------------- */}
      {form && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={salvarForm} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-[#16252B]">{form.id ? 'Editar operador' : 'Novo operador'}</h2>
            <div>
              <label className={LABEL}>Nome</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className={INPUT + ' w-full'}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Perfil</label>
                <select
                  value={form.perfil}
                  onChange={(e) => setForm({ ...form, perfil: e.target.value as Operador['perfil'] })}
                  className={INPUT + ' w-full'}
                >
                  {Object.entries(PERFIS).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Situação</label>
                <select
                  value={form.ativo ? '1' : '0'}
                  onChange={(e) => setForm({ ...form, ativo: e.target.value === '1' })}
                  className={INPUT + ' w-full'}
                >
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL}>{form.id ? 'Novo PIN (vazio = não muda)' : 'PIN (4 a 6 números)'}</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={form.pinNovo}
                onChange={(e) => setForm({ ...form, pinNovo: e.target.value.replace(/\D/g, '') })}
                className={INPUT + ' w-full tracking-[0.4em]'}
              />
            </div>
            {temGestor && (
              <div>
                <label className={LABEL}>PIN de um gerente/administrador para autorizar</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={form.pinAutorizador}
                  onChange={(e) => setForm({ ...form, pinAutorizador: e.target.value.replace(/\D/g, '') })}
                  className={INPUT + ' w-full tracking-[0.4em]'}
                />
              </div>
            )}
            {erroForm && (
              <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
                {erroForm}
              </div>
            )}
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
