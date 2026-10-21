'use client';

// Estação de impressão: este computador fica com a página aberta e imprime
// sozinho tudo o que chega na fila para as impressoras escolhidas.
// Recebe aviso na hora pelo "tempo real" do Supabase e, por garantia,
// também consulta a fila a cada 5 segundos.

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  confirmarImpressao,
  pegarImpressoes,
  impressoraOnline,
  erroImpressao,
  type Impressora,
} from '@/lib/queries/impressao';
import { htmlDoTicket, imprimirHtml } from '@/lib/impressao/navegador';
import { NOME_DOCUMENTO } from '@/lib/impressao/layout';
import { impressorasDaEstacao, salvarImpressorasDaEstacao, terminalAtual } from '@/lib/impressao/terminal';
import { BTN_PRIMARY, BTN_SECONDARY, CARTAO, hora } from '@/components/pdv/estilos';

type Registro = { quando: string; texto: string; ok: boolean };

type Props = {
  supabase: SupabaseClient;
  unidadeId: string;
  impressoras: Impressora[];
};

const TICKET_TESTE = {
  setor: 'TESTE',
  identificacao: { modo: 'mesa', rotulo: 'MESA 99', pedido: 0 },
  acrescimo: false,
  emitido_em: new Date().toISOString(),
  operador: 'teste de impressão',
  itens: [
    {
      quantidade: 2,
      nome: 'X-Burger',
      observacao: 'sem cebola',
      restricao: 'alergia a camarão',
      adicionais: [{ nome: 'Bacon', valor: 5 }],
    },
    { quantidade: 1, nome: 'Suco de laranja' },
  ],
};

export default function EstacaoImpressao({ supabase, unidadeId, impressoras }: Props) {
  const daEstacao = impressoras.filter((i) => i.conexao === 'navegador' && i.ativo);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [ligada, setLigada] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const ocupada = useRef(false);
  const pendente = useRef(false);

  // volta ligada sozinha se este computador já era estação (ex.: depois de reiniciar)
  useEffect(() => {
    const salvas = impressorasDaEstacao().filter((id) => daEstacao.some((i) => i.id === id));
    setEscolhidas(salvas);
    if (salvas.length > 0) setLigada(true);
  }, [impressoras.length]);

  function anotar(texto: string, ok = true) {
    setRegistros((r) => [{ quando: new Date().toISOString(), texto, ok }, ...r].slice(0, 50));
  }

  async function processarFila() {
    if (ocupada.current) {
      pendente.current = true; // chegou aviso no meio: roda de novo no fim
      return;
    }
    ocupada.current = true;
    try {
      do {
        pendente.current = false;
        const nome = terminalAtual()?.nome || 'Estação do navegador';
        const trabalhos = await pegarImpressoes(supabase, escolhidas, nome);
        setErro(null);
        for (const t of trabalhos) {
          const imp = impressoras.find((i) => i.id === t.impressora_id);
          try {
            if (!imp) throw new Error('Impressora não encontrada');
            await imprimirHtml(htmlDoTicket(t.documento, t.conteudo, imp));
            await confirmarImpressao(supabase, t.id, true);
            anotar(`${NOME_DOCUMENTO[t.documento]} · ${t.titulo} → ${imp.nome}${t.via > 1 ? ` (${t.via}ª via)` : ''}`);
          } catch (e: any) {
            await confirmarImpressao(supabase, t.id, false, e?.message).catch(() => null);
            anotar(`Falhou: ${t.titulo} · ${e?.message || 'erro'}`, false);
          }
        }
        if (trabalhos.length === 10) pendente.current = true; // ainda pode ter mais na fila
      } while (pendente.current);
    } catch (e: any) {
      setErro(erroImpressao(e, 'Sem conexão com a fila de impressão'));
    }
    ocupada.current = false;
  }

  useEffect(() => {
    if (!ligada || escolhidas.length === 0) return;
    processarFila();
    const intervalo = setInterval(processarFila, 5000);
    const canal = supabase
      .channel('estacao-impressao')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pdv_impressoes', filter: `unidade_id=eq.${unidadeId}` },
        (payload: any) => {
          const novo = payload.new;
          if (novo?.status === 'pendente' && escolhidas.includes(novo.impressora_id)) processarFila();
        }
      )
      .subscribe();
    return () => {
      clearInterval(intervalo);
      supabase.removeChannel(canal);
    };
  }, [ligada, escolhidas.join(',')]);

  function alternar(id: string) {
    const nova = escolhidas.includes(id) ? escolhidas.filter((x) => x !== id) : [...escolhidas, id];
    setEscolhidas(nova);
    salvarImpressorasDaEstacao(ligada ? nova : []);
    if (nova.length === 0) setLigada(false);
  }

  function ligarDesligar() {
    const novo = !ligada;
    setLigada(novo);
    salvarImpressorasDaEstacao(novo ? escolhidas : []);
    anotar(novo ? 'Estação ligada' : 'Estação desligada');
  }

  async function imprimirTeste(imp: Impressora) {
    try {
      await imprimirHtml(htmlDoTicket('producao', { ...TICKET_TESTE, emitido_em: new Date().toISOString() }, imp));
      anotar('Teste enviado para ' + imp.nome);
    } catch (e: any) {
      anotar('Teste falhou: ' + (e?.message || 'erro'), false);
    }
  }

  return (
    <div className="space-y-6">
      <div className={CARTAO + ' p-4 space-y-4'}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[14rem]">
            <h2 className="text-base font-semibold text-[#16252B]">Este computador imprime</h2>
            <p className="text-sm text-[#5B6B73]">
              Deixe esta página aberta no computador ligado à impressora. Os tickets saem sozinhos.
            </p>
          </div>
          <span
            className={
              'rounded-full px-3 py-1 text-xs font-semibold ' +
              (ligada ? 'bg-[#D9F0E3] text-[#1E6B3F]' : 'bg-[#F1F5F7] text-[#5B6B73]')
            }
          >
            {ligada ? '● Ligada' : 'Desligada'}
          </span>
          <button
            onClick={ligarDesligar}
            disabled={escolhidas.length === 0}
            className={ligada ? BTN_SECONDARY : BTN_PRIMARY}
          >
            {ligada ? 'Desligar' : 'Ligar estação'}
          </button>
        </div>

        {erro && (
          <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        {daEstacao.length === 0 ? (
          <p className="text-sm text-[#5B6B73]">
            Cadastre uma impressora do tipo “Navegador” na aba Impressoras e setores.
          </p>
        ) : (
          <ul className="divide-y divide-[#E6ECEF] border border-[#E6ECEF] rounded-lg">
            {daEstacao.map((i) => (
              <li key={i.id} className="px-3 py-2.5 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 flex-1 min-w-[12rem] text-sm text-[#16252B]">
                  <input type="checkbox" checked={escolhidas.includes(i.id)} onChange={() => alternar(i.id)} />
                  <span className="font-medium">{i.nome}</span>
                  <span className="text-xs text-[#8FA0A8]">
                    {i.largura_mm} mm · {i.copias} {i.copias === 1 ? 'via' : 'vias'}
                  </span>
                </label>
                <span className={'text-xs ' + (impressoraOnline(i) ? 'text-[#1E6B3F]' : 'text-[#8FA0A8]')}>
                  {impressoraOnline(i) ? 'atendida por uma estação' : 'sem estação'}
                </span>
                <button onClick={() => imprimirTeste(i)} className="text-xs font-medium text-[#0E6B7E] hover:underline">
                  Imprimir teste
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={CARTAO + ' p-4'}>
        <h3 className="text-sm font-semibold text-[#16252B] mb-2">Como deixar a impressão automática</h3>
        <ol className="list-decimal pl-5 text-sm text-[#2B3C44] space-y-1.5">
          <li>Instale a impressora térmica no Windows e defina-a como <b>impressora padrão</b> desse computador.</li>
          <li>
            Crie um atalho do Chrome com o final{' '}
            <code className="bg-[#F1F5F7] rounded px-1 text-xs">--kiosk-printing</code> (clique direito no atalho →
            Propriedades → Destino). Assim o Chrome imprime direto, sem perguntar.
          </li>
          <li>Abra o sistema por esse atalho, entre nesta página, marque as impressoras e ligue a estação.</li>
          <li>
            O navegador só imprime na impressora padrão. Para cozinha e bar em impressoras diferentes, use um
            computador (ou perfil do Chrome) por impressora, ou o agente ESC/POS, quando ele estiver pronto.
          </li>
          <li>Não minimize a janela por muito tempo: alguns navegadores atrasam páginas escondidas.</li>
        </ol>
      </div>

      <div className={CARTAO + ' p-4'}>
        <h3 className="text-sm font-semibold text-[#16252B] mb-2">O que esta estação imprimiu</h3>
        {registros.length === 0 ? (
          <p className="text-sm text-[#5B6B73]">Nada ainda nesta sessão.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {registros.map((r, k) => (
              <li key={k} className={r.ok ? 'text-[#2B3C44]' : 'text-[#B3261E]'}>
                <span className="text-[#8FA0A8]">{hora(r.quando)}</span> · {r.texto}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
