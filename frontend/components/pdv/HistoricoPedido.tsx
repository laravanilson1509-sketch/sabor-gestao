'use client';

// Tudo o que foi impresso para um pedido (com reimpressão e "tentar de novo")
// e a trilha de auditoria: quem cancelou, deu desconto, reabriu...

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarFila,
  reimprimir,
  tentarNovamente,
  erroImpressao,
  ROTULO_STATUS,
  type Impressao,
} from '@/lib/queries/impressao';
import { listarHistoricoPedido, ROTULO_ACAO, type Fechamento, type RegistroAuditoria } from '@/lib/queries/conta';
import { NOME_DOCUMENTO } from '@/lib/impressao/layout';
import { terminalId } from '@/lib/impressao/terminal';
import { BTN_LINK, BTN_SECONDARY, dataHora, moeda } from './estilos';

type Props = {
  supabase: SupabaseClient;
  unidadeId: string;
  pedidoId: string;
  titulo: string;
  onFechar: () => void;
};

export function resumoDetalhes(acao: string, d: any) {
  if (!d) return '';
  switch (acao) {
    case 'cancelar_item':
      return `${d.quantidade}× ${d.item} (${moeda(d.valor)})${d.devolveu_estoque ? ' · voltou ao estoque' : ''}`;
    case 'cortesia':
    case 'cortesia_removida':
      return `${d.quantidade}× ${d.item}`;
    case 'desconto':
      return d.pct ? `${d.pct}% sobre ${moeda(d.subtotal)}` : moeda(d.valor);
    case 'estornar_pagamento':
      return `${d.forma} ${moeda(d.valor)}${d.pagador ? ' · ' + d.pagador : ''}`;
    case 'fechar_pendente':
      return `${moeda(d.valor)} para ${d.devedor}, vence ${d.vencimento}`;
    case 'reabrir_conta':
      return `estava fechada em ${moeda(d.total_fechado)}`;
    case 'reimpressao':
      return `${d.titulo} · ${d.via}ª via`;
    case 'alterar_item':
      return `${d.item}: ${[d.depois?.restricao, d.depois?.observacao].filter(Boolean).join(' · ') || 'sem observação'}`;
    case 'taxa_removida':
      return `${d.pct_anterior}% (${moeda(d.valor_anterior)})`;
    default:
      return '';
  }
}

export default function HistoricoPedido({ supabase, unidadeId, pedidoId, titulo, onFechar }: Props) {
  const [impressoes, setImpressoes] = useState<Impressao[]>([]);
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([]);
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try {
      const [fila, hist] = await Promise.all([
        listarFila(supabase, unidadeId, { desde: '', pedidoId }),
        listarHistoricoPedido(supabase, pedidoId),
      ]);
      setImpressoes(fila);
      setAuditoria(hist.auditoria);
      setFechamentos(hist.fechamentos);
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao carregar o histórico'));
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, [pedidoId]);

  async function pedirReimpressao(i: Impressao) {
    const motivo = window.prompt('Reimprimir "' + i.titulo + '".\nMotivo (opcional):', '');
    if (motivo === null) return;
    setErro(null);
    try {
      await reimprimir(supabase, i.id, terminalId(), motivo);
      setAviso('Segunda via enviada para a fila.');
      carregar();
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao reimprimir'));
    }
  }

  async function repetir(i: Impressao) {
    setErro(null);
    try {
      await tentarNovamente(supabase, i.id);
      carregar();
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao tentar de novo'));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#16252B]">Impressões e histórico · {titulo}</h2>
          <button onClick={onFechar} className="text-xl text-[#8FA0A8] hover:text-[#16252B]" aria-label="Fechar">
            ✕
          </button>
        </div>

        {erro && (
          <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
            {erro}
          </div>
        )}
        {aviso && <div className="text-sm text-[#1E6B3F] bg-[#D9F0E3] rounded-lg px-3 py-2">{aviso}</div>}

        {carregando ? (
          <p className="text-sm text-[#5B6B73] py-6 text-center">Carregando...</p>
        ) : (
          <>
            <section>
              <h3 className="text-sm font-semibold text-[#2B3C44] mb-2">Documentos impressos</h3>
              {impressoes.length === 0 ? (
                <p className="text-sm text-[#5B6B73]">Nada impresso ainda.</p>
              ) : (
                <ul className="divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg">
                  {impressoes.map((i) => (
                    <li key={i.id} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="flex-1 min-w-[12rem]">
                        <p className="text-sm font-medium text-[#16252B]">
                          {NOME_DOCUMENTO[i.documento]}
                          {i.via > 1 && <span className="text-[#7A5A0A]"> · {i.via}ª via</span>}
                        </p>
                        <p className="text-xs text-[#5B6B73]">
                          {i.titulo} · {dataHora(i.criado_em)}
                          {i.solicitado_por ? ' · ' + i.solicitado_por : ''}
                        </p>
                        {i.erro && <p className="text-xs text-[#B3261E]">{i.erro}</p>}
                      </div>
                      <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + ROTULO_STATUS[i.status].cor}>
                        {ROTULO_STATUS[i.status].rotulo}
                      </span>
                      {(i.status === 'falha' || i.status === 'sem_impressora') && (
                        <button onClick={() => repetir(i)} className={BTN_LINK}>
                          Tentar de novo
                        </button>
                      )}
                      <button onClick={() => pedirReimpressao(i)} className={BTN_LINK}>
                        Reimprimir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {fechamentos.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-[#2B3C44] mb-2">Fechamentos</h3>
                <ul className="divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg">
                  {fechamentos.map((f) => (
                    <li key={f.id} className="px-3 py-2.5 text-sm">
                      <p className="text-[#16252B]">
                        <span className="font-medium">{f.versao}º fechamento</span> · {moeda(f.total)} ·{' '}
                        {dataHora(f.fechado_em)} · {f.fechado_por || '-'}
                      </p>
                      {f.reaberto_em && (
                        <p className="text-xs text-[#B3261E]">
                          Reaberto em {dataHora(f.reaberto_em)} por {f.reaberto_por}: {f.reaberto_motivo}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-[#2B3C44] mb-2">Auditoria</h3>
              {auditoria.length === 0 ? (
                <p className="text-sm text-[#5B6B73]">Nenhuma ação sensível neste pedido.</p>
              ) : (
                <ul className="divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg">
                  {auditoria.map((a) => (
                    <li key={a.id} className="px-3 py-2.5 text-sm">
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
          </>
        )}

        <button onClick={onFechar} className={BTN_SECONDARY + ' w-full'}>
          Fechar
        </button>
      </div>
    </div>
  );
}
