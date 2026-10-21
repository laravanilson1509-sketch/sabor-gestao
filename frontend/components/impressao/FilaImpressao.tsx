'use client';

// Fila de impressão do dia: o que saiu, o que está esperando e o que falhou.
// Dá para ver o ticket na tela, tentar de novo e pedir segunda via.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listarFila,
  reimprimir,
  tentarNovamente,
  erroImpressao,
  impressoraOnline,
  ROTULO_STATUS,
  type Impressao,
  type Impressora,
} from '@/lib/queries/impressao';
import { NOME_DOCUMENTO } from '@/lib/impressao/layout';
import BarraBusca from '@/components/BarraBusca';
import { combina } from '@/lib/busca';
import { htmlDoTicket } from '@/lib/impressao/navegador';
import { terminalId } from '@/lib/impressao/terminal';
import { BTN_LINK, BTN_SECONDARY, CARTAO, hora } from '@/components/pdv/estilos';

type Props = {
  supabase: SupabaseClient;
  unidadeId: string;
  impressoras: Impressora[];
  onMudou: () => void;
};

export default function FilaImpressao({ supabase, unidadeId, impressoras, onMudou }: Props) {
  const [fila, setFila] = useState<Impressao[]>([]);
  const [apenasProblemas, setApenasProblemas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Impressao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  async function carregar() {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    try {
      setFila(await listarFila(supabase, unidadeId, { desde: inicio.toISOString(), apenasProblemas }));
      setErro(null);
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao carregar a fila'));
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [apenasProblemas]);

  async function acao(fn: () => Promise<void>) {
    setErro(null);
    try {
      await fn();
      await carregar();
      onMudou();
    } catch (e: any) {
      setErro(erroImpressao(e, 'Não foi possível concluir'));
    }
  }

  function pedirReimpressao(i: Impressao) {
    const motivo = window.prompt('Reimprimir "' + i.titulo + '".\nMotivo (opcional):', '');
    if (motivo === null) return;
    acao(() => reimprimir(supabase, i.id, terminalId(), motivo));
  }

  const nomeImpressora = (id: string | null) => impressoras.find((i) => i.id === id)?.nome || '—';
  const filaFiltrada = fila.filter((i) => combina(busca, i.titulo, NOME_DOCUMENTO[i.documento], i.solicitado_por, nomeImpressora(i.impressora_id), i.erro));
  const parada = (i: Impressao) => i.status === 'pendente' && Date.now() - new Date(i.criado_em).getTime() > 120000;
  const impressoraPrevia = impressoras.find((i) => i.id === previa?.impressora_id);
  const semEstacao = impressoras.filter((i) => i.ativo && i.conexao === 'navegador' && !impressoraOnline(i));

  return (
    <div className="space-y-4">
      {semEstacao.length > 0 && (
        <div className="text-sm text-[#7A5A0A] bg-[#FFF0C7] rounded-lg px-3 py-2">
          Sem estação ligada agora: {semEstacao.map((i) => i.nome).join(', ')}. Os tickets ficam guardados na fila
          e saem assim que uma estação ligar.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <BarraBusca valor={busca} onChange={setBusca} placeholder="Buscar por mesa, documento ou quem pediu..." className="flex-1 min-w-[14rem]" />
        <label className="flex items-center gap-2 text-sm text-[#2B3C44]">
          <input type="checkbox" checked={apenasProblemas} onChange={(e) => setApenasProblemas(e.target.checked)} />
          Só os com problema
        </label>
        <button onClick={carregar} className={BTN_SECONDARY}>
          Atualizar
        </button>
      </div>

      {erro && (
        <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
          {erro}
        </div>
      )}

      <div className={CARTAO + ' overflow-x-auto'}>
        {carregando ? (
          <p className="text-center py-10 text-sm text-[#5B6B73]">Carregando...</p>
        ) : fila.length > 0 && filaFiltrada.length === 0 ? (
          <p className="text-center py-10 text-sm text-[#5B6B73]">Nada encontrado para “{busca}”.</p>
        ) : fila.length === 0 ? (
          <p className="text-center py-10 text-sm text-[#5B6B73]">
            {apenasProblemas ? 'Nenhum problema hoje.' : 'Nada impresso hoje ainda.'}
          </p>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Hora</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Impressora</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Situação</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6ECEF]">
              {filaFiltrada.map((i) => (
                <tr key={i.id} className="hover:bg-[#F8FAFB] align-top">
                  <td className="px-4 py-3 text-sm text-[#2B3C44] whitespace-nowrap">{hora(i.criado_em)}</td>
                  <td className="px-4 py-3 text-sm">
                    <p className="font-medium text-[#16252B]">{i.titulo}</p>
                    <p className="text-xs text-[#5B6B73]">
                      {NOME_DOCUMENTO[i.documento]}
                      {i.via > 1 && ' · ' + i.via + 'ª via'}
                      {i.solicitado_por && ' · ' + i.solicitado_por}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#2B3C44]">{nomeImpressora(i.impressora_id)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                        (parada(i) ? ROTULO_STATUS.falha.cor : ROTULO_STATUS[i.status].cor)
                      }
                    >
                      {parada(i) ? 'Parada na fila' : ROTULO_STATUS[i.status].rotulo}
                    </span>
                    {i.erro && <p className="text-xs text-[#B3261E] mt-1">{i.erro}</p>}
                    {i.status === 'sem_impressora' && (
                      <p className="text-xs text-[#B3261E] mt-1">Nenhuma impressora para este setor/terminal.</p>
                    )}
                    {i.tentativas > 1 && <p className="text-xs text-[#8FA0A8] mt-1">{i.tentativas} tentativas</p>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                    <button onClick={() => setPrevia(i)} className={BTN_LINK}>
                      Ver
                    </button>
                    {(i.status === 'falha' || i.status === 'sem_impressora') && (
                      <button onClick={() => acao(() => tentarNovamente(supabase, i.id))} className={BTN_LINK}>
                        Tentar de novo
                      </button>
                    )}
                    <button onClick={() => pedirReimpressao(i)} className={BTN_LINK}>
                      Reimprimir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {previa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPrevia(null)}>
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-[#16252B]">{previa.titulo}</h2>
              <button onClick={() => setPrevia(null)} className="text-xl text-[#8FA0A8] hover:text-[#16252B]" aria-label="Fechar">
                ✕
              </button>
            </div>
            <iframe
              title="Prévia do ticket"
              className="w-full h-[60vh] border border-[#DCE3E7] rounded-lg bg-white"
              srcDoc={htmlDoTicket(previa.documento, previa.conteudo, {
                largura_mm: impressoraPrevia?.largura_mm || 80,
                copias: 1,
                fonte: impressoraPrevia?.fonte || 'normal',
              })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
