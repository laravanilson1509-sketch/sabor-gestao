'use client';

// Fechamento de conta: conferência, divisão, pagamentos, troco e fechamento.
//
// A conta só fecha quando o que foi pago cobre o total (o banco confere).
// Cada pagamento leva uma "chave" única: se a internet falhar e o botão for
// clicado de novo, o banco reconhece a chave e não cobra duas vezes.

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aplicarDesconto,
  definirCortesia,
  definirTaxaServico,
  estornarPagamento,
  fecharComPendencia,
  fecharConta,
  imprimirPreConta,
  listarPagamentos,
  registrarPagamento,
  type Pagamento,
} from '@/lib/queries/conta';
import { carregarConfig, type ConfigPdv } from '@/lib/queries/impressao';
import { valorItem, type ItemPdv, type PedidoPdv } from '@/lib/queries/salao';
import { rotuloForma } from '@/lib/queries/caixa';
import { novaChave, terminalId } from '@/lib/impressao/terminal';
import ModalPin from './ModalPin';
import {
  BTN_LINK,
  BTN_PERIGO,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARTAO,
  INPUT,
  LABEL,
  lerValor,
  moeda,
  qtd,
} from './estilos';

const FORMAS = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'cartao_credito', rotulo: 'Crédito' },
  { valor: 'cartao_debito', rotulo: 'Débito' },
  { valor: 'vale_refeicao', rotulo: 'Vale' },
  { valor: 'outro', rotulo: 'Outro' },
];

type ModoDivisao = 'inteira' | 'igual' | 'pessoa' | 'item' | 'valor';

const MODOS: { valor: ModoDivisao; rotulo: string }[] = [
  { valor: 'inteira', rotulo: 'Conta inteira' },
  { valor: 'igual', rotulo: 'Igual' },
  { valor: 'pessoa', rotulo: 'Por pessoa' },
  { valor: 'item', rotulo: 'Por item' },
  { valor: 'valor', rotulo: 'Por valor' },
];

const centavos = (v: number) => Math.round(v * 100) / 100;
const valorTexto = (v: number) => (v > 0 ? v.toFixed(2).replace('.', ',') : '');
const nomePessoa = (n: number) => 'Pessoa ' + n;

// divide um total em partes que somam exatamente o total (a última leva a sobra)
function dividirIgual(total: number, partes: number) {
  const base = Math.floor((total / partes) * 100) / 100;
  return Array.from({ length: partes }, (_, i) => (i === partes - 1 ? centavos(total - base * (partes - 1)) : base));
}

type Modal =
  | { tipo: 'desconto' }
  | { tipo: 'taxa' }
  | { tipo: 'cortesia'; item: ItemPdv }
  | { tipo: 'estorno'; pagamento: Pagamento }
  | { tipo: 'pendencia' }
  | null;

type Props = {
  supabase: SupabaseClient;
  unidadeId: string;
  pedido: PedidoPdv;
  itens: ItemPdv[];
  titulo: string;
  onAtualizar: () => Promise<void>;
  onFechada: () => void;
  onVoltar: () => void;
};

export default function FechamentoConta({
  supabase,
  unidadeId,
  pedido,
  itens,
  titulo,
  onAtualizar,
  onFechada,
  onVoltar,
}: Props) {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [config, setConfig] = useState<ConfigPdv | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [fechada, setFechada] = useState<{ troco: number } | null>(null);

  // divisão
  const [modo, setModo] = useState<ModoDivisao>('inteira');
  const [pessoas, setPessoas] = useState(Math.max(pedido.pessoas || 1, 2));
  const [donoItem, setDonoItem] = useState<Record<string, number>>({}); // 0 = dividido entre todos
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // formulário de pagamento
  const [forma, setForma] = useState('dinheiro');
  const [valorTxt, setValorTxt] = useState('');
  const [recebidoTxt, setRecebidoTxt] = useState('');
  const [pagador, setPagador] = useState('');
  const [transacao, setTransacao] = useState('');
  const [itensDoPagamento, setItensDoPagamento] = useState<string[] | null>(null);
  const [chave, setChave] = useState(novaChave);
  const [ultimoTroco, setUltimoTroco] = useState(0);

  // desconto
  const [descTipo, setDescTipo] = useState<'pct' | 'valor'>('pct');
  const [descTxt, setDescTxt] = useState('');
  // pendência
  const [devedor, setDevedor] = useState('');
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date(Date.now() + 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [chavePendencia] = useState(novaChave);

  const confirmados = pagamentos.filter((p) => p.status === 'confirmado');
  const pago = centavos(confirmados.reduce((s, p) => s + Number(p.valor), 0));
  const total = Number(pedido.total);
  const restante = centavos(Math.max(total - pago, 0));
  const subtotal = Number(pedido.subtotal);
  // desconto e taxa entram na mesma proporção em cada item
  const fator = subtotal > 0 ? total / subtotal : 1;
  const validos = itens.filter((i) => !i.cancelado);
  const cancelados = itens.filter((i) => i.cancelado);
  const temPagamento = confirmados.length > 0;

  async function carregarPagamentos() {
    setPagamentos(await listarPagamentos(supabase, pedido.id));
  }

  useEffect(() => {
    carregarPagamentos().catch((e) => setErro(e.message));
    carregarConfig(supabase, unidadeId)
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [pedido.id]);

  // mexeu no formulário = nova tentativa = nova chave
  function mudar<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setChave(novaChave());
    };
  }

  function prepararPagamento(valor: number, quem: string, ids: string[] | null = null) {
    setValorTxt(valorTexto(Math.min(valor, restante)));
    setRecebidoTxt('');
    setPagador(quem);
    setItensDoPagamento(ids);
    setChave(novaChave());
    setAviso(null);
  }

  // ---------- divisão ----------

  const pagoPor = (quem: string) =>
    confirmados.filter((p) => p.pagador === quem).reduce((s, p) => s + Number(p.valor), 0);

  const cotasIguais = useMemo(() => dividirIgual(total, pessoas), [total, pessoas]);

  const cotasPorPessoa = useMemo(() => {
    const brutos = Array.from({ length: pessoas }, () => 0);
    for (const i of validos) {
      const dono = donoItem[i.id] ?? 0;
      const v = valorItem(i);
      if (dono === 0 || dono > pessoas) brutos.forEach((_, k) => (brutos[k] += v / pessoas));
      else brutos[dono - 1] += v;
    }
    const cotas = brutos.map((b) => centavos(b * fator));
    // acerta os centavos na última pessoa para a soma bater com o total
    const diferenca = centavos(total - cotas.reduce((s, c) => s + c, 0));
    cotas[cotas.length - 1] = centavos(cotas[cotas.length - 1] + diferenca);
    return cotas;
  }, [validos, donoItem, pessoas, fator, total]);

  const itensPagos = new Set(confirmados.flatMap((p) => p.itens || []));
  const valorSelecionado = centavos(
    validos.filter((i) => selecionados.has(i.id)).reduce((s, i) => s + valorItem(i), 0) * fator
  );

  // ---------- ações ----------

  async function executar(acao: () => Promise<void>, sucesso?: string) {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    try {
      await acao();
      if (sucesso) setAviso(sucesso);
    } catch (e: any) {
      setErro(e.message || 'Não foi possível concluir.');
    }
    setOcupado(false);
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    const valor = lerValor(valorTxt);
    if (!valor || Number.isNaN(valor) || valor <= 0) {
      setErro('Informe o valor do pagamento.');
      return;
    }
    let recebido: number | null = null;
    if (forma === 'dinheiro') {
      recebido = recebidoTxt.trim() ? lerValor(recebidoTxt) : valor;
      if (Number.isNaN(recebido) || recebido < valor) {
        setErro('O valor recebido em dinheiro não pode ser menor que o valor do pagamento.');
        return;
      }
    } else if (valor > restante + 0.005) {
      setErro('No ' + rotuloForma(forma) + ' o valor não pode passar do que falta (' + moeda(restante) + ').');
      return;
    }

    await executar(async () => {
      const g = await registrarPagamento(supabase, {
        pedidoId: pedido.id,
        forma,
        valor,
        valorRecebido: recebido,
        pagador,
        transacao,
        itens: itensDoPagamento,
        chave,
        terminalId: terminalId(),
      });
      setUltimoTroco(Number(g.troco) || 0);
      setChave(novaChave());
      setValorTxt('');
      setRecebidoTxt('');
      setPagador('');
      setTransacao('');
      setItensDoPagamento(null);
      setSelecionados(new Set());
      await carregarPagamentos();
    });
  }

  async function fechar() {
    await executar(async () => {
      await fecharConta(supabase, pedido.id, terminalId());
      setFechada({ troco: confirmados.reduce((s, p) => s + Number(p.troco || 0), 0) });
    });
  }

  async function preConta() {
    await executar(
      () => imprimirPreConta(supabase, pedido.id, modo === 'igual' || modo === 'pessoa' ? pessoas : 1, terminalId()),
      'Pré-conta enviada para impressão.'
    );
  }

  // "conta inteira" já deixa o valor que falta preenchido
  useEffect(() => {
    if (modo === 'inteira' && restante > 0) prepararPagamento(restante, '');
  }, [modo, restante]);

  // ---------- conta fechada ----------

  if (fechada) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md text-center space-y-4">
          <p className="text-4xl">✓</p>
          <h2 className="text-xl font-bold text-[#16252B]">Conta fechada · {titulo}</h2>
          {fechada.troco > 0 && (
            <div className="bg-[#FFF0C7] rounded-xl py-4">
              <p className="text-sm font-medium text-[#7A5A0A]">Troco</p>
              <p className="text-3xl font-bold text-[#16252B]">{moeda(fechada.troco)}</p>
            </div>
          )}
          <p className="text-sm text-[#5B6B73]">
            {config?.imprimir_comprovante_auto === false
              ? 'O comprovante não é impresso automaticamente (veja em Impressão > Conta e equipe).'
              : 'O comprovante foi para a fila de impressão.'}{' '}
            {pedido.canal === 'mesa' && 'A mesa está livre.'}
          </p>
          <button onClick={onFechada} className={BTN_PRIMARY + ' w-full'}>
            Voltar ao salão
          </button>
        </div>
      </div>
    );
  }

  const valorDigitado = lerValor(valorTxt);
  const recebidoDigitado = recebidoTxt.trim() ? lerValor(recebidoTxt) : NaN;
  const trocoPrevisto =
    forma === 'dinheiro' && !Number.isNaN(recebidoDigitado) && !Number.isNaN(valorDigitado)
      ? centavos(recebidoDigitado - Math.min(valorDigitado, restante))
      : 0;

  return (
    <div className="fixed inset-0 bg-[#EEF2F4] z-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onVoltar}
            className="h-10 w-10 rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition"
            aria-label="Voltar para a comanda"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#16252B]">Fechar conta · {titulo}</h1>
            <p className="text-sm text-[#5B6B73]">Confira os itens, divida e receba</p>
          </div>
          <button onClick={preConta} disabled={ocupado} className={BTN_SECONDARY}>
            Imprimir pré-conta
          </button>
        </div>

        {erro && (
          <div role="alert" className="mb-4 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
            {erro}
          </div>
        )}
        {aviso && <div className="mb-4 text-sm text-[#1E6B3F] bg-[#D9F0E3] rounded-lg px-3 py-2">{aviso}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* ---------------- CONFERÊNCIA ---------------- */}
          <div className={CARTAO + ' p-4 h-fit'}>
            <h2 className="text-base font-semibold text-[#16252B] mb-3">Conferência</h2>
            <ul className="divide-y divide-[#E6ECEF]">
              {validos.map((i) => (
                <li key={i.id} className="py-2.5 flex items-start gap-3">
                  {modo === 'item' && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={itensPagos.has(i.id) || restante <= 0}
                      checked={selecionados.has(i.id)}
                      onChange={(e) => {
                        const s = new Set(selecionados);
                        e.target.checked ? s.add(i.id) : s.delete(i.id);
                        setSelecionados(s);
                      }}
                      aria-label={'Pagar ' + i.nome}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#16252B]">
                      {qtd(i.quantidade)}× {i.nome}
                      {itensPagos.has(i.id) && (
                        <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold bg-[#D9F0E3] text-[#1E6B3F]">
                          pago
                        </span>
                      )}
                    </p>
                    {(i.adicionais || []).map((a, k) => (
                      <p key={k} className="text-xs text-[#5B6B73]">
                        + {a.nome} {a.valor > 0 && '(' + moeda(a.valor) + ')'}
                      </p>
                    ))}
                    {modo === 'pessoa' && (
                      <select
                        value={donoItem[i.id] ?? 0}
                        onChange={(e) => setDonoItem((d) => ({ ...d, [i.id]: Number(e.target.value) }))}
                        className={INPUT + ' py-1 mt-1 text-xs'}
                      >
                        <option value={0}>Dividido entre todos</option>
                        {Array.from({ length: pessoas }, (_, k) => (
                          <option key={k} value={k + 1}>
                            {nomePessoa(k + 1)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={'text-sm font-semibold ' + (i.cortesia ? 'text-[#1E6B3F]' : 'text-[#16252B]')}>
                      {i.cortesia ? 'Cortesia' : moeda(valorItem(i))}
                    </p>
                    {!temPagamento && (
                      <button onClick={() => setModal({ tipo: 'cortesia', item: i })} className={BTN_LINK}>
                        {i.cortesia ? 'Tirar cortesia' : 'Cortesia'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {cancelados.length > 0 && (
              <div className="mt-3 border-t border-dashed border-[#DCE3E7] pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA0A8] mb-1">Cancelados</p>
                {cancelados.map((i) => (
                  <p key={i.id} className="text-xs text-[#8FA0A8]">
                    <span className="line-through">
                      {qtd(i.quantidade)}× {i.nome}
                    </span>{' '}
                    · {i.cancelado_motivo} · {i.cancelado_por}
                  </p>
                ))}
              </div>
            )}

            <div className="border-t border-[#DCE3E7] mt-3 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-[#2B3C44]">
                <span>Subtotal</span>
                <span>{moeda(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-[#2B3C44]">
                <span>
                  Desconto
                  {pedido.desconto_pct ? ' ' + qtd(pedido.desconto_pct) + '%' : ''}
                  {pedido.desconto_motivo && <span className="text-xs text-[#8FA0A8]"> · {pedido.desconto_motivo}</span>}
                  {!temPagamento && (
                    <button onClick={() => setModal({ tipo: 'desconto' })} className={BTN_LINK + ' ml-2'}>
                      {Number(pedido.desconto) > 0 ? 'Mudar' : 'Dar desconto'}
                    </button>
                  )}
                </span>
                <span>{Number(pedido.desconto) > 0 ? '- ' + moeda(pedido.desconto) : moeda(0)}</span>
              </div>
              <div className="flex justify-between items-center text-[#2B3C44]">
                <span>
                  Taxa de serviço {qtd(pedido.taxa_servico_pct)}%{' '}
                  <span className="text-xs text-[#8FA0A8]">(opcional para o cliente)</span>
                  {!temPagamento && (
                    <button
                      onClick={() =>
                        Number(pedido.taxa_servico_pct) > 0
                          ? setModal({ tipo: 'taxa' })
                          : executar(async () => {
                              await definirTaxaServico(supabase, {
                                pedidoId: pedido.id,
                                cobrar: true,
                                motivo: '',
                                pin: '',
                                terminalId: terminalId(),
                              });
                              await onAtualizar();
                            })
                      }
                      className={BTN_LINK + ' ml-2'}
                    >
                      {Number(pedido.taxa_servico_pct) > 0 ? 'Retirar' : 'Cobrar taxa'}
                    </button>
                  )}
                </span>
                <span>{moeda(pedido.taxa_servico)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-[#16252B] pt-1">
                <span>Total</span>
                <span>{moeda(total)}</span>
              </div>
              {temPagamento && (
                <p className="text-xs text-[#8FA0A8]">
                  Com pagamento lançado, desconto, cortesia e taxa ficam travados. Estorne o pagamento para mudar.
                </p>
              )}
            </div>
          </div>

          {/* ---------------- PAGAMENTO ---------------- */}
          <div className="space-y-4">
            <div className={CARTAO + ' p-4'}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-[#5B6B73]">Total</p>
                  <p className="text-base font-bold text-[#16252B]">{moeda(total)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#5B6B73]">Pago</p>
                  <p className="text-base font-bold text-[#1E6B3F]">{moeda(pago)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#5B6B73]">Falta</p>
                  <p className={'text-base font-bold ' + (restante > 0 ? 'text-[#B3261E]' : 'text-[#1E6B3F]')}>
                    {moeda(restante)}
                  </p>
                </div>
              </div>
              {ultimoTroco > 0 && (
                <div className="mt-3 bg-[#FFF0C7] rounded-lg py-2 text-center">
                  <span className="text-sm text-[#7A5A0A]">Troco a devolver: </span>
                  <span className="text-xl font-bold text-[#16252B]">{moeda(ultimoTroco)}</span>
                </div>
              )}
            </div>

            {restante > 0 && (
              <div className={CARTAO + ' p-4'}>
                <p className="text-sm font-semibold text-[#16252B] mb-2">Dividir a conta</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {MODOS.map((m) => (
                    <button
                      key={m.valor}
                      onClick={() => {
                        setModo(m.valor);
                        setSelecionados(new Set());
                      }}
                      className={
                        'text-xs px-3 py-1.5 rounded-lg font-medium border transition ' +
                        (modo === m.valor
                          ? 'bg-[#0E6B7E] text-white border-[#0E6B7E]'
                          : 'bg-white text-[#2B3C44] border-[#DCE3E7] hover:bg-[#F1F5F7]')
                      }
                    >
                      {m.rotulo}
                    </button>
                  ))}
                </div>

                {(modo === 'igual' || modo === 'pessoa') && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-[#2B3C44]">Pessoas</span>
                      <button
                        onClick={() => setPessoas((n) => Math.max(2, n - 1))}
                        className="h-8 w-8 rounded-lg border border-[#DCE3E7] text-[#2B3C44] hover:bg-[#F1F5F7]"
                        aria-label="Menos pessoas"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-semibold text-[#16252B]">{pessoas}</span>
                      <button
                        onClick={() => setPessoas((n) => Math.min(30, n + 1))}
                        className="h-8 w-8 rounded-lg border border-[#DCE3E7] text-[#2B3C44] hover:bg-[#F1F5F7]"
                        aria-label="Mais pessoas"
                      >
                        +
                      </button>
                    </div>
                    {modo === 'pessoa' && (
                      <p className="text-xs text-[#8FA0A8] mb-2">
                        Escolha de quem é cada item na lista ao lado. Itens sem dono são divididos entre todos.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {(modo === 'igual' ? cotasIguais : cotasPorPessoa).map((cota, k) => {
                        const quem = nomePessoa(k + 1);
                        const falta = centavos(Math.max(cota - pagoPor(quem), 0));
                        return (
                          <button
                            key={k}
                            disabled={falta <= 0}
                            onClick={() => prepararPagamento(falta, quem)}
                            className={
                              'text-left rounded-lg border px-3 py-2 transition ' +
                              (falta <= 0
                                ? 'border-[#B9E0C8] bg-[#D9F0E3]'
                                : pagador === quem
                                ? 'border-[#0E6B7E] bg-[#F1F8FA]'
                                : 'border-[#DCE3E7] hover:border-[#0E6B7E]')
                            }
                          >
                            <span className="block text-xs text-[#5B6B73]">{quem}</span>
                            <span className="block text-sm font-semibold text-[#16252B]">
                              {falta <= 0 ? 'Pago ✓' : moeda(falta)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {modo === 'item' && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[#2B3C44]">
                      Marque os itens na lista. Selecionado: <b>{moeda(valorSelecionado)}</b>
                      <span className="block text-xs text-[#8FA0A8]">já com desconto e taxa proporcionais</span>
                    </p>
                    <button
                      disabled={selecionados.size === 0}
                      onClick={() => prepararPagamento(valorSelecionado, '', [...selecionados])}
                      className={BTN_SECONDARY}
                    >
                      Usar
                    </button>
                  </div>
                )}

                {modo === 'valor' && (
                  <p className="text-sm text-[#5B6B73]">Digite o valor que o cliente quer pagar agora.</p>
                )}
              </div>
            )}

            {restante > 0 && (
              <form onSubmit={registrar} className={CARTAO + ' p-4 space-y-3'}>
                <p className="text-sm font-semibold text-[#16252B]">Receber</p>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAS.map((f) => (
                    <button
                      key={f.valor}
                      type="button"
                      onClick={() => mudar(setForma)(f.valor)}
                      className={
                        'text-sm px-2 py-2 rounded-lg font-medium border transition ' +
                        (forma === f.valor
                          ? 'bg-[#0E6B7E] text-white border-[#0E6B7E]'
                          : 'bg-white text-[#2B3C44] border-[#DCE3E7] hover:bg-[#F1F5F7]')
                      }
                    >
                      {f.rotulo}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>Valor</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorTxt}
                      onChange={(e) => mudar(setValorTxt)(e.target.value)}
                      placeholder={valorTexto(restante)}
                      className={INPUT + ' w-full'}
                    />
                  </div>
                  {forma === 'dinheiro' ? (
                    <div>
                      <label className={LABEL}>Recebido</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={recebidoTxt}
                        onChange={(e) => mudar(setRecebidoTxt)(e.target.value)}
                        placeholder="Ex: 100,00"
                        className={INPUT + ' w-full'}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className={LABEL}>NSU / id do Pix</label>
                      <input
                        type="text"
                        value={transacao}
                        onChange={(e) => mudar(setTransacao)(e.target.value)}
                        placeholder="Opcional"
                        className={INPUT + ' w-full'}
                      />
                    </div>
                  )}
                </div>

                {forma === 'dinheiro' && trocoPrevisto > 0 && (
                  <p className="text-sm text-[#7A5A0A] bg-[#FFF0C7] rounded-lg px-3 py-2">
                    Troco: <b>{moeda(trocoPrevisto)}</b>
                  </p>
                )}

                <div>
                  <label className={LABEL}>Quem está pagando</label>
                  <input
                    type="text"
                    value={pagador}
                    onChange={(e) => mudar(setPagador)(e.target.value)}
                    placeholder="Opcional (ex: João)"
                    className={INPUT + ' w-full'}
                  />
                </div>

                <button type="submit" disabled={ocupado} className={BTN_PRIMARY + ' w-full'}>
                  {ocupado ? 'Registrando...' : 'Registrar pagamento'}
                </button>
                {forma !== 'dinheiro' && (
                  <p className="text-xs text-[#8FA0A8]">
                    Registre só depois que a maquininha ou o Pix confirmar o pagamento.
                  </p>
                )}
              </form>
            )}

            {pagamentos.length > 0 && (
              <div className={CARTAO + ' p-4'}>
                <p className="text-sm font-semibold text-[#16252B] mb-2">Pagamentos</p>
                <ul className="divide-y divide-[#E6ECEF]">
                  {pagamentos.map((g) => (
                    <li key={g.id} className="py-2 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p
                          className={
                            'text-sm font-medium ' +
                            (g.status === 'estornado' ? 'line-through text-[#8FA0A8]' : 'text-[#16252B]')
                          }
                        >
                          {rotuloForma(g.forma)}
                          {g.pagador && <span className="text-[#5B6B73] font-normal"> · {g.pagador}</span>}
                        </p>
                        <p className="text-xs text-[#5B6B73]">
                          {g.valor_recebido && Number(g.troco) > 0
                            ? 'Recebido ' + moeda(g.valor_recebido) + ' · troco ' + moeda(g.troco)
                            : g.transacao_id
                            ? 'Transação ' + g.transacao_id
                            : g.operador_email}
                        </p>
                        {g.status === 'estornado' && (
                          <p className="text-xs text-[#B3261E]">
                            Estornado por {g.estornado_por}: {g.estorno_motivo}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#16252B]">{moeda(g.valor)}</p>
                        {g.status === 'confirmado' && (
                          <button onClick={() => setModal({ tipo: 'estorno', pagamento: g })} className={BTN_LINK}>
                            Estornar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <button onClick={fechar} disabled={ocupado || restante > 0} className={BTN_PRIMARY + ' w-full py-3 text-base'}>
                {restante > 0 ? 'Falta receber ' + moeda(restante) : 'Fechar conta e liberar'}
              </button>
              {restante > 0 && (
                <button onClick={() => setModal({ tipo: 'pendencia' })} disabled={ocupado} className={BTN_PERIGO + ' w-full'}>
                  Fechar com valor a receber (fiado)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- JANELAS DE AUTORIZAÇÃO ---------------- */}

      {modal?.tipo === 'desconto' && (
        <ModalPin
          titulo="Desconto na conta"
          descricao={'Itens: ' + moeda(subtotal) + '. O caixa tem limite; acima dele, só gerente.'}
          sugestoesMotivo={['Aniversariante', 'Cliente frequente', 'Demora no atendimento', 'Erro no pedido']}
          onFechar={() => setModal(null)}
          onConfirmar={async ({ pin, motivo }) => {
            const n = lerValor(descTxt);
            if (!n || Number.isNaN(n) || n <= 0) throw new Error('Informe o desconto.');
            await aplicarDesconto(supabase, {
              pedidoId: pedido.id,
              valor: descTipo === 'valor' ? n : null,
              pct: descTipo === 'pct' ? n : null,
              motivo,
              pin,
              terminalId: terminalId(),
            });
            setModal(null);
            setDescTxt('');
            await onAtualizar();
          }}
        >
          <div className="flex gap-2">
            <select
              value={descTipo}
              onChange={(e) => setDescTipo(e.target.value as 'pct' | 'valor')}
              className={INPUT}
            >
              <option value="pct">%</option>
              <option value="valor">R$</option>
            </select>
            <input
              type="text"
              inputMode="decimal"
              value={descTxt}
              onChange={(e) => setDescTxt(e.target.value)}
              placeholder={descTipo === 'pct' ? 'Ex: 10' : 'Ex: 15,00'}
              className={INPUT + ' flex-1'}
            />
          </div>
          {Number(pedido.desconto) > 0 && (
            <button
              type="button"
              onClick={() =>
                executar(async () => {
                  await aplicarDesconto(supabase, {
                    pedidoId: pedido.id,
                    valor: 0,
                    pct: null,
                    motivo: '',
                    pin: '',
                    terminalId: terminalId(),
                  });
                  setModal(null);
                  await onAtualizar();
                })
              }
              className={BTN_LINK}
            >
              Retirar o desconto atual ({moeda(pedido.desconto)})
            </button>
          )}
        </ModalPin>
      )}

      {modal?.tipo === 'taxa' && (
        <ModalPin
          titulo="Retirar a taxa de serviço"
          descricao={'A taxa é opcional para o cliente. Valor atual: ' + moeda(pedido.taxa_servico) + '.'}
          pedirPin={config?.remover_taxa_exige_pin !== false}
          motivoObrigatorio={false}
          sugestoesMotivo={['Cliente não quis pagar', 'Atendimento demorado', 'Política da casa']}
          textoConfirmar="Retirar taxa"
          onFechar={() => setModal(null)}
          onConfirmar={async ({ pin, motivo }) => {
            await definirTaxaServico(supabase, {
              pedidoId: pedido.id,
              cobrar: false,
              motivo,
              pin,
              terminalId: terminalId(),
            });
            setModal(null);
            await onAtualizar();
          }}
        />
      )}

      {modal?.tipo === 'cortesia' && (
        <ModalPin
          titulo={(modal.item.cortesia ? 'Tirar cortesia · ' : 'Cortesia · ') + modal.item.nome}
          descricao={
            modal.item.cortesia
              ? 'O item volta a ser cobrado.'
              : 'O item continua na conta, mas sai com valor zero. Precisa de gerente.'
          }
          motivoObrigatorio={!modal.item.cortesia}
          sugestoesMotivo={['Item com problema', 'Cortesia da casa', 'Demora']}
          onFechar={() => setModal(null)}
          onConfirmar={async ({ pin, motivo }) => {
            await definirCortesia(supabase, {
              itemId: modal.item.id,
              cortesia: !modal.item.cortesia,
              motivo,
              pin,
              terminalId: terminalId(),
            });
            setModal(null);
            await onAtualizar();
          }}
        />
      )}

      {modal?.tipo === 'estorno' && (
        <ModalPin
          titulo={'Estornar ' + rotuloForma(modal.pagamento.forma) + ' de ' + moeda(modal.pagamento.valor)}
          descricao="O pagamento continua no histórico, marcado como estornado. Devolva o valor ao cliente (ou cancele na maquininha)."
          perigo
          textoConfirmar="Estornar"
          sugestoesMotivo={['Lançado em duplicidade', 'Forma de pagamento errada', 'Valor errado']}
          onFechar={() => setModal(null)}
          onConfirmar={async ({ pin, motivo }) => {
            await estornarPagamento(supabase, {
              pagamentoId: modal.pagamento.id,
              motivo,
              pin,
              terminalId: terminalId(),
            });
            setModal(null);
            setUltimoTroco(0);
            await carregarPagamentos();
          }}
        />
      )}

      {modal?.tipo === 'pendencia' && (
        <ModalPin
          titulo={'Fechar com ' + moeda(restante) + ' a receber'}
          descricao="Vira uma conta a receber (fiado) no Financeiro e a mesa é liberada. Precisa de gerente."
          motivoObrigatorio={false}
          perigo
          textoConfirmar="Fechar com pendência"
          onFechar={() => setModal(null)}
          onConfirmar={async ({ pin, motivo }) => {
            if (!devedor.trim()) throw new Error('Informe quem vai pagar depois.');
            await fecharComPendencia(supabase, {
              pedidoId: pedido.id,
              devedor,
              vencimento,
              motivo,
              pin,
              chave: chavePendencia,
              terminalId: terminalId(),
            });
            setModal(null);
            setFechada({ troco: confirmados.reduce((s, p) => s + Number(p.troco || 0), 0) });
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className={LABEL}>Quem vai pagar</label>
              <input
                type="text"
                value={devedor}
                onChange={(e) => setDevedor(e.target.value)}
                placeholder="Nome e telefone"
                className={INPUT + ' w-full'}
              />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Vencimento</label>
              <input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className={INPUT + ' w-full'}
              />
            </div>
          </div>
        </ModalPin>
      )}
    </div>
  );
}
