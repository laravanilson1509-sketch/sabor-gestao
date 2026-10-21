'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  listarMesas,
  criarMesa,
  excluirMesa,
  listarCardapioPdv,
  listarPedidosAbertos,
  abrirPedido,
  listarItens,
  adicionarItem,
  alterarQuantidade,
  buscarPedido,
  definirParaViagem,
  valorItem,
  listarReservasAtivas,
  criarReserva,
  atualizarStatusReserva,
  type Mesa,
  type PedidoPdv,
  type ItemPdv,
  type ProdutoCardapio,
  type Reserva,
} from '@/lib/queries/salao';
import {
  listarProdutosSemEstoque,
  verificarEstoqueEnvio,
  type FaltaEstoque,
} from '@/lib/queries/estoqueVenda';
import { registrarPendenciasEnvio, EVENTO_PENDENCIAS } from '@/lib/queries/pendenciasEstoque';
import {
  enviarProducao,
  cancelarItem,
  cancelarPedidoAutorizado,
  imprimirPreConta,
  listarFechadasHoje,
  reabrirConta,
  type ContaFechada,
} from '@/lib/queries/conta';
import { contarProblemasFila, erroImpressao } from '@/lib/queries/impressao';
import { rotuloForma } from '@/lib/queries/caixa';
import { terminalId } from '@/lib/impressao/terminal';
import ModalPin from '@/components/pdv/ModalPin';
import EditarItem from '@/components/pdv/EditarItem';
import FechamentoConta from '@/components/pdv/FechamentoConta';
import HistoricoPedido from '@/components/pdv/HistoricoPedido';

const INPUT =
  'border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]';
const BTN_PRIMARY =
  'bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition';
const BTN_SECONDARY =
  'px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition';

// etiqueta mostrada nos itens da comanda que já foram para a cozinha
const SELO_COZINHA = {
  novo: { rotulo: 'Na cozinha', cor: 'bg-[#FFF0C7] text-[#7A5A0A]' },
  preparando: { rotulo: 'Preparando', cor: 'bg-[#DCEEF2] text-[#0B4F5E]' },
  pronto: { rotulo: 'Pronto', cor: 'bg-[#D9F0E3] text-[#1E6B3F]' },
};

const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const moeda = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const ehHoje = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

const dataHoraCurta = (iso: string) =>
  ehHoje(iso)
    ? 'Hoje, ' + hora(iso)
    : new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
      ', ' +
      hora(iso);

// valor padrão do campo de data/hora: daqui a 1 hora, minutos zerados
function dataHoraPadrao() {
  const d = new Date(Date.now() + 3600000);
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes())
  );
}

type Categoria = 'todos' | 'prato' | 'acabado';

const FILTROS_CARDAPIO: { valor: Categoria; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'prato', rotulo: 'Pratos' },
  { valor: 'acabado', rotulo: 'Produtos acabados' },
];

export default function PdvPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const unidadeId = process.env.NEXT_PUBLIC_UNIDADE_ID!;

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [abertos, setAbertos] = useState<PedidoPdv[]>([]);
  const [cardapio, setCardapio] = useState<ProdutoCardapio[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // nova mesa
  const [mostrarNovaMesa, setMostrarNovaMesa] = useState(false);
  const [numeroMesa, setNumeroMesa] = useState('');
  const [capacidadeMesa, setCapacidadeMesa] = useState('4');

  // reserva
  const [mesaReserva, setMesaReserva] = useState<Mesa | null>(null);
  const [rNome, setRNome] = useState('');
  const [rTelefone, setRTelefone] = useState('');
  const [rPessoas, setRPessoas] = useState('2');
  const [rDataHora, setRDataHora] = useState('');
  const [rObs, setRObs] = useState('');
  const [rErro, setRErro] = useState<string | null>(null);
  const [rSalvando, setRSalvando] = useState(false);

  // comanda
  const [pedido, setPedido] = useState<PedidoPdv | null>(null);
  const [itens, setItens] = useState<ItemPdv[]>([]);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('todos');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // janelas da comanda
  const [editando, setEditando] = useState<ItemPdv | null>(null);
  const [cancelandoItem, setCancelandoItem] = useState<ItemPdv | null>(null);
  const [qtdCancelar, setQtdCancelar] = useState(1);
  const [devolverEstoque, setDevolverEstoque] = useState(true);
  const [cancelandoPedido, setCancelandoPedido] = useState(false);
  const [mostrarFechamento, setMostrarFechamento] = useState(false);
  const [historico, setHistorico] = useState<{ id: string; titulo: string } | null>(null);
  // salão
  const [fechadasHoje, setFechadasHoje] = useState<ContaFechada[]>([]);
  const [reabrindo, setReabrindo] = useState<ContaFechada | null>(null);
  const [problemasFila, setProblemasFila] = useState(0);
  // estoque: pratos sem estoque no cardápio e aviso antes de enviar para a cozinha
  const [semEstoque, setSemEstoque] = useState<Set<string>>(new Set());
  const [faltas, setFaltas] = useState<FaltaEstoque[] | null>(null);

  function atualizarSemEstoque() {
    listarProdutosSemEstoque(supabase, unidadeId)
      .then(setSemEstoque)
      .catch(() => setSemEstoque(new Set()));
  }

  async function carregarInicio() {
    setLoading(true);
    setErro(null);
    try {
      const [m, p, c] = await Promise.all([
        listarMesas(supabase, unidadeId),
        listarPedidosAbertos(supabase, unidadeId),
        listarCardapioPdv(supabase),
      ]);
      setMesas(m);
      setAbertos(p);
      setCardapio(c);
    } catch (e: any) {
      setErro(
        e?.message?.includes('pdv_')
          ? 'As tabelas do PDV ainda não existem. Rode o SQL do PDV no Supabase.'
          : e?.message || 'Erro ao carregar'
      );
    }
    atualizarSemEstoque();
    listarFechadasHoje(supabase, unidadeId)
      .then(setFechadasHoje)
      .catch(() => setFechadasHoje([]));
    contarProblemasFila(supabase, unidadeId)
      .then(setProblemasFila)
      .catch(() => setProblemasFila(0));
    try {
      setReservas(await listarReservasAtivas(supabase, unidadeId));
    } catch (e: any) {
      setReservas([]);
      setErro(
        'Não foi possível carregar as reservas. Rode o SQL da tabela pdv_reservas no Supabase.'
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    carregarInicio();
  }, []);

  async function recarregarComanda(p: PedidoPdv) {
    // total, desconto e taxa são calculados no banco
    const [lista, atual] = await Promise.all([listarItens(supabase, p.id), buscarPedido(supabase, p.id)]);
    setItens(lista);
    setPedido(atual);
    setAbertos((todos) => todos.map((x) => (x.id === atual.id ? atual : x)));
  }

  async function abrirComanda(p: PedidoPdv) {
    setErro(null);
    setAviso(null);
    setPedido(p);
    setBusca('');
    setCategoria('todos');
    try {
      setItens(await listarItens(supabase, p.id));
    } catch (e: any) {
      setErro(e.message || 'Erro ao abrir a comanda');
    }
  }

  async function clicarMesa(m: Mesa) {
    const existente = abertos.find((p) => p.mesa_id === m.id);
    if (existente) return abrirComanda(existente);

    // reserva de hoje nesta mesa: confirma a chegada do cliente
    const reservaHoje = reservas.find((r) => r.mesa_id === m.id && ehHoje(r.data_hora));
    if (reservaHoje) {
      const chegou = window.confirm(
        'Mesa reservada para ' +
          reservaHoje.nome_cliente +
          ' às ' +
          hora(reservaHoje.data_hora) +
          '.\n\nO cliente chegou? OK abre a mesa e conclui a reserva.'
      );
      if (!chegou) return;
      try {
        await atualizarStatusReserva(supabase, reservaHoje.id, 'concluida');
        setReservas((prev) => prev.filter((r) => r.id !== reservaHoje.id));
      } catch (e: any) {
        setErro(e.message || 'Erro ao concluir a reserva');
        return;
      }
    }

    try {
      const novo = await abrirPedido(supabase, { unidadeId, canal: 'mesa', mesaId: m.id });
      setAbertos((prev) => [...prev, novo]);
      await abrirComanda(novo);
    } catch (e: any) {
      setErro(e.message || 'Erro ao abrir a mesa');
    }
  }

  async function novaVendaBalcao() {
    try {
      const novo = await abrirPedido(supabase, { unidadeId, canal: 'balcao' });
      setAbertos((prev) => [...prev, novo]);
      await abrirComanda(novo);
    } catch (e: any) {
      setErro(e.message || 'Erro ao abrir a venda');
    }
  }

  async function handleNovaMesa(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const n = parseInt(numeroMesa, 10);
    const cap = parseInt(capacidadeMesa, 10) || 4;
    if (!n || n <= 0) {
      setErro('Informe o número da mesa.');
      return;
    }
    try {
      await criarMesa(supabase, unidadeId, n, cap);
      setNumeroMesa('');
      setMostrarNovaMesa(false);
      setMesas(await listarMesas(supabase, unidadeId));
    } catch (e: any) {
      setErro(e.message || 'Erro ao criar a mesa');
    }
  }

  async function handleExcluirMesa(m: Mesa) {
    if (abertos.some((p) => p.mesa_id === m.id)) {
      setErro('Feche ou cancele o pedido da mesa antes de excluí-la.');
      return;
    }
    if (reservas.some((r) => r.mesa_id === m.id)) {
      setErro('Cancele as reservas da mesa antes de excluí-la.');
      return;
    }
    if (!window.confirm('Excluir a mesa ' + m.numero + '?')) return;
    try {
      await excluirMesa(supabase, m.id);
      setMesas(await listarMesas(supabase, unidadeId));
    } catch (e: any) {
      setErro(e.message || 'Erro ao excluir a mesa');
    }
  }

  // ---------- reservas ----------

  function abrirReserva(m: Mesa) {
    setMesaReserva(m);
    setRNome('');
    setRTelefone('');
    setRPessoas(String(Math.min(2, m.capacidade) || 2));
    setRDataHora(dataHoraPadrao());
    setRObs('');
    setRErro(null);
  }

  async function salvarReserva(e: React.FormEvent) {
    e.preventDefault();
    if (!mesaReserva) return;
    setRErro(null);
    const pessoas = parseInt(rPessoas, 10);
    if (!rNome.trim()) {
      setRErro('Informe o nome do cliente.');
      return;
    }
    if (!rDataHora) {
      setRErro('Informe a data e a hora.');
      return;
    }
    if (new Date(rDataHora).getTime() < Date.now() - 15 * 60000) {
      setRErro('A data e hora da reserva já passaram.');
      return;
    }
    if (!pessoas || pessoas <= 0) {
      setRErro('Informe o número de pessoas.');
      return;
    }
    setRSalvando(true);
    try {
      await criarReserva(supabase, {
        unidadeId,
        mesaId: mesaReserva.id,
        nomeCliente: rNome.trim(),
        telefone: rTelefone.trim(),
        pessoas,
        dataHora: new Date(rDataHora).toISOString(),
        observacao: rObs.trim(),
      });
      setMesaReserva(null);
      setReservas(await listarReservasAtivas(supabase, unidadeId));
    } catch (err: any) {
      setRErro(err.message || 'Erro ao salvar a reserva');
    }
    setRSalvando(false);
  }

  async function cancelarReserva(r: Reserva) {
    if (!window.confirm('Cancelar a reserva de ' + r.nome_cliente + '?')) return;
    try {
      await atualizarStatusReserva(supabase, r.id, 'cancelada');
      setReservas((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e: any) {
      setErro(e.message || 'Erro ao cancelar a reserva');
    }
  }

  // ---------- comanda ----------

  async function addProduto(prod: ProdutoCardapio) {
    if (!pedido || ocupado) return;
    setOcupado(true);
    try {
      await adicionarItem(supabase, { pedidoId: pedido.id, produto: prod });
      await recarregarComanda(pedido);
    } catch (e: any) {
      setErro(e.message || 'Erro ao adicionar item');
    }
    setOcupado(false);
  }

  async function mudarQtd(item: ItemPdv, delta: number) {
    if (!pedido || ocupado) return;
    setOcupado(true);
    try {
      await alterarQuantidade(supabase, item.id, item.quantidade + delta);
      await recarregarComanda(pedido);
    } catch (e: any) {
      setErro(e.message || 'Erro ao alterar a quantidade');
    }
    setOcupado(false);
  }

  async function enviarCozinha() {
    if (!pedido || ocupado) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      // só avisa: se faltar estoque, o atendente decide se envia mesmo assim
      const falta = await verificarEstoqueEnvio(supabase, unidadeId, pedido.id);
      if (falta.length > 0) {
        setFaltas(falta);
      } else {
        const n = await enviarProducao(supabase, pedido.id, [], terminalId());
        avisarEnvio(n);
        await recarregarComanda(pedido);
        atualizarSemEstoque();
      }
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao enviar para a produção'));
    }
    setOcupado(false);
  }

  function avisarEnvio(n: number) {
    setAviso(
      n === 1 ? '1 item enviado. O ticket foi para a impressora do setor.' : n + ' itens enviados. Os tickets foram para as impressoras dos setores.'
    );
  }

  async function enviarMesmoAssim() {
    if (!pedido || !faltas || ocupado) return;
    setOcupado(true);
    try {
      const itensSemEstoque = [...new Set(faltas.flatMap((f) => f.itemIds))];
      const n = await enviarProducao(supabase, pedido.id, itensSemEstoque, terminalId());
      await registrarPendenciasEnvio(supabase, { unidadeId, origem: tituloComanda, faltas });
      window.dispatchEvent(new Event(EVENTO_PENDENCIAS));
      setFaltas(null);
      avisarEnvio(n);
      await recarregarComanda(pedido);
      atualizarSemEstoque();
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao enviar para a produção'));
      setFaltas(null);
    }
    setOcupado(false);
  }

  function abrirFechamento() {
    if (!pedido) return;
    if (itensValidos.length === 0) {
      setErro('Adicione pelo menos um item antes de fechar a conta.');
      return;
    }
    if (naoEnviados > 0 && !window.confirm('Há ' + naoEnviados + ' item(ns) que não foram enviados para a produção. Fechar a conta mesmo assim?')) {
      return;
    }
    setErro(null);
    setMostrarFechamento(true);
  }

  async function preConta() {
    if (!pedido) return;
    const resposta = window.prompt('Pré-conta de ' + tituloComanda + '.\nDividir por quantas pessoas?', String(pedido.pessoas || 1));
    if (resposta === null) return;
    const pessoas = Math.max(parseInt(resposta, 10) || 1, 1);
    setOcupado(true);
    setErro(null);
    try {
      await imprimirPreConta(supabase, pedido.id, pessoas, terminalId());
      setAviso('Pré-conta enviada para impressão.');
      await recarregarComanda(pedido);
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao imprimir a pré-conta'));
    }
    setOcupado(false);
  }

  async function cancelar() {
    if (!pedido) return;
    // com itens na produção precisa de gerente; sem nada enviado é só confirmar
    if (itensValidos.some((i) => i.status_cozinha)) {
      setCancelandoPedido(true);
      return;
    }
    if (!window.confirm('Cancelar este pedido? Os itens serão descartados.')) return;
    setOcupado(true);
    try {
      await cancelarPedidoAutorizado(supabase, { pedidoId: pedido.id, motivo: '', pin: '', terminalId: terminalId() });
      voltar();
    } catch (e: any) {
      setErro(erroImpressao(e, 'Erro ao cancelar'));
    }
    setOcupado(false);
  }

  async function mudarParaViagem(valor: boolean) {
    if (!pedido) return;
    try {
      await definirParaViagem(supabase, pedido.id, valor);
      await recarregarComanda(pedido);
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar');
    }
  }

  function abrirCancelarItem(i: ItemPdv) {
    setQtdCancelar(i.quantidade);
    setDevolverEstoque(i.status_cozinha !== 'pronto');
    setCancelandoItem(i);
  }

  function voltar() {
    setPedido(null);
    setItens([]);
    setErro(null);
    setAviso(null);
    setMostrarFechamento(false);
    carregarInicio();
  }

  async function confirmarReabertura(c: ContaFechada, pin: string, motivo: string) {
    await reabrirConta(supabase, { pedidoId: c.id, motivo, pin, terminalId: terminalId() });
    setReabrindo(null);
    await carregarInicio();
    await abrirComanda(await buscarPedido(supabase, c.id));
  }

  const itensValidos = itens.filter((i) => !i.cancelado);
  const filtrado = cardapio.filter(
    (p) =>
      (categoria === 'todos' || p.tipo_produto === categoria) &&
      p.nome.toLowerCase().includes(busca.trim().toLowerCase())
  );
  const mesaDoPedido = pedido?.mesa_id ? mesas.find((m) => m.id === pedido.mesa_id) : null;
  const tituloComanda = pedido
    ? pedido.canal === 'mesa'
      ? 'Mesa ' + (mesaDoPedido?.numero ?? '')
      : 'Balcão #' + pedido.numero
    : '';

  const naoEnviados = itensValidos.filter((i) => !i.status_cozinha).length;
  const tituloConta = (c: { canal: string; mesa_id: string | null; numero: number }) =>
    c.canal === 'mesa' ? 'Mesa ' + (mesas.find((m) => m.id === c.mesa_id)?.numero ?? '') : 'Balcão #' + c.numero;

  const avisoErro = (
    <>
      {erro && (
        <div role="alert" className="mb-4 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
          {erro}
        </div>
      )}
      {aviso && <div className="mb-4 text-sm text-[#1E6B3F] bg-[#D9F0E3] rounded-lg px-3 py-2">{aviso}</div>}
    </>
  );

  // ---------------- COMANDA ----------------
  if (pedido) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={voltar}
              className="h-10 w-10 rounded-lg text-xl text-[#5B6B73] hover:bg-white hover:text-[#16252B] transition"
              aria-label="Voltar para o salão"
            >
              ←
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#16252B]">
                {tituloComanda}
                {pedido.reaberturas > 0 && (
                  <span className="ml-2 align-middle rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#FADBD6] text-[#B3261E]">
                    Reaberta
                  </span>
                )}
              </h1>
              <p className="text-sm text-[#5B6B73]">Toque em um item do cardápio para adicionar</p>
            </div>
            {pedido.canal === 'balcao' && (
              <label className="flex items-center gap-2 text-sm font-medium text-[#2B3C44] bg-white border border-[#DCE3E7] rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={pedido.para_viagem}
                  onChange={(e) => mudarParaViagem(e.target.checked)}
                />
                Para levar (retirada)
              </label>
            )}
          </div>

          {avisoErro}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* Cardápio */}
            <div className="bg-white border border-[#DCE3E7] rounded-xl p-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {FILTROS_CARDAPIO.map((f) => (
                  <button
                    key={f.valor}
                    onClick={() => setCategoria(f.valor)}
                    className={
                      'text-sm px-3 py-1.5 rounded-lg font-medium transition border ' +
                      (categoria === f.valor
                        ? 'bg-[#0E6B7E] text-white border-[#0E6B7E]'
                        : 'bg-white text-[#2B3C44] border-[#DCE3E7] hover:bg-[#F1F5F7]')
                    }
                  >
                    {f.rotulo}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no cardápio..."
                className={INPUT + ' w-full mb-4'}
              />
              {cardapio.length === 0 ? (
                <p className="text-sm text-[#5B6B73] py-8 text-center">
                  Nenhum item com preço de venda. Defina o preço dos pratos na ficha técnica.
                </p>
              ) : filtrado.length === 0 ? (
                <p className="text-sm text-[#5B6B73] py-8 text-center">Nada encontrado.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filtrado.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProduto(p)}
                      disabled={ocupado}
                      className="text-left border border-[#DCE3E7] rounded-lg p-3 hover:border-[#0E6B7E] hover:bg-[#F1F8FA] disabled:opacity-60 transition"
                    >
                      <span className="block text-sm font-medium text-[#16252B]">{p.nome}</span>
                      <span className="block text-xs text-[#8FA0A8] mt-0.5">
                        {p.tipo_produto === 'acabado' ? 'Produto acabado' : 'Prato'}
                      </span>
                      <span className="block text-sm font-semibold text-[#0E6B7E] mt-1">
                        {moeda(p.preco_venda)}
                      </span>
                      {semEstoque.has(p.id) && (
                        <span className="inline-block mt-1.5 rounded-full px-2 py-0.5 text-xs font-semibold bg-[#FADBD6] text-[#B3261E]">
                          Sem estoque
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comanda */}
            <div className="bg-white border border-[#DCE3E7] rounded-xl p-4 h-fit lg:sticky lg:top-6">
              <h2 className="text-base font-semibold text-[#16252B] mb-3">Comanda</h2>

              {itens.length === 0 ? (
                <p className="text-sm text-[#5B6B73] py-6 text-center">Nenhum item ainda.</p>
              ) : (
                <ul className="divide-y divide-[#E6ECEF] mb-4">
                  {itens.map((i) =>
                    i.cancelado ? (
                      <li key={i.id} className="py-2.5">
                        <p className="text-sm text-[#8FA0A8] line-through">
                          {i.quantidade}× {i.nome}
                        </p>
                        <p className="text-xs text-[#B3261E]">
                          Cancelado · {i.cancelado_motivo} · {i.cancelado_por}
                        </p>
                      </li>
                    ) : (
                      <li key={i.id} className="py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setEditando(i)}
                            className="flex-1 min-w-0 text-left group"
                            title="Observação, restrição e adicionais"
                          >
                            <p className="text-sm font-medium text-[#16252B] truncate group-hover:text-[#0E6B7E]">
                              {i.nome}
                            </p>
                            <p className="text-xs text-[#5B6B73]">
                              {moeda(i.preco_unitario)} cada · <span className="text-[#0E6B7E]">obs.</span>
                            </p>
                          </button>
                          {i.status_cozinha ? (
                            <span className="flex items-center gap-2">
                              <span className="w-7 text-center text-sm font-semibold text-[#16252B]">
                                {i.quantidade}
                              </span>
                              <span className={'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + SELO_COZINHA[i.status_cozinha].cor}>
                                {SELO_COZINHA[i.status_cozinha].rotulo}
                              </span>
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => mudarQtd(i, -1)}
                                disabled={ocupado}
                                className="h-8 w-8 rounded-lg border border-[#DCE3E7] text-[#2B3C44] hover:bg-[#F1F5F7]"
                                aria-label="Diminuir"
                              >
                                −
                              </button>
                              <span className="w-7 text-center text-sm font-semibold text-[#16252B]">
                                {i.quantidade}
                              </span>
                              <button
                                onClick={() => mudarQtd(i, 1)}
                                disabled={ocupado}
                                className="h-8 w-8 rounded-lg border border-[#DCE3E7] text-[#2B3C44] hover:bg-[#F1F5F7]"
                                aria-label="Aumentar"
                              >
                                +
                              </button>
                            </div>
                          )}
                          <span className="w-20 text-right text-sm font-semibold text-[#16252B]">
                            {i.cortesia ? 'Cortesia' : moeda(valorItem(i))}
                          </span>
                        </div>
                        {i.restricao && (
                          <p className="mt-1 text-xs font-semibold text-[#B3261E] bg-[#FADBD6] rounded px-2 py-0.5">
                            ⚠ {i.restricao}
                          </p>
                        )}
                        {(i.adicionais || []).map((a, k) => (
                          <p key={k} className="text-xs text-[#2B3C44] mt-0.5">
                            + {a.nome} {Number(a.valor) > 0 && '(' + moeda(a.valor) + ')'}
                          </p>
                        ))}
                        {i.observacao && (
                          <p className="mt-1 text-xs text-[#7A5A0A] bg-[#FFF0C7] rounded px-2 py-0.5">{i.observacao}</p>
                        )}
                        {i.status_cozinha && (
                          <button
                            onClick={() => abrirCancelarItem(i)}
                            className="mt-1 text-xs text-[#8FA0A8] hover:text-[#B3261E]"
                          >
                            Cancelar item
                          </button>
                        )}
                      </li>
                    )
                  )}
                </ul>
              )}

              <div className="border-t border-[#DCE3E7] pt-3 mb-4 space-y-1 text-sm">
                {(Number(pedido.desconto) > 0 || Number(pedido.taxa_servico) > 0) && (
                  <div className="flex justify-between text-[#5B6B73]">
                    <span>Itens</span>
                    <span>{moeda(pedido.subtotal)}</span>
                  </div>
                )}
                {Number(pedido.desconto) > 0 && (
                  <div className="flex justify-between text-[#5B6B73]">
                    <span>Desconto</span>
                    <span>- {moeda(pedido.desconto)}</span>
                  </div>
                )}
                {Number(pedido.taxa_servico) > 0 && (
                  <div className="flex justify-between text-[#5B6B73]">
                    <span>Taxa de serviço {Number(pedido.taxa_servico_pct)}%</span>
                    <span>{moeda(pedido.taxa_servico)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[#5B6B73]">Total</span>
                  <span className="text-xl font-bold text-[#16252B]">{moeda(pedido.total)}</span>
                </div>
              </div>

              <button
                onClick={enviarCozinha}
                disabled={ocupado || naoEnviados === 0}
                className={BTN_PRIMARY + ' w-full mb-2'}
              >
                {naoEnviados > 0
                  ? 'Enviar para a produção (' + naoEnviados + (naoEnviados === 1 ? ' item)' : ' itens)')
                  : 'Tudo enviado para a produção'}
              </button>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={preConta} disabled={ocupado || itensValidos.length === 0} className={BTN_SECONDARY}>
                  Pré-conta
                </button>
                <button onClick={abrirFechamento} disabled={ocupado || itensValidos.length === 0} className={BTN_SECONDARY}>
                  Fechar conta
                </button>
              </div>
              <button
                onClick={() => setHistorico({ id: pedido.id, titulo: tituloComanda })}
                className={BTN_SECONDARY + ' w-full mb-2'}
              >
                Impressões e histórico
              </button>
              <button
                onClick={cancelar}
                disabled={ocupado}
                className="w-full px-4 py-2.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] text-sm font-medium hover:bg-[#FADBD6] transition"
              >
                Cancelar pedido
              </button>
            </div>
          </div>
        </div>

        {editando && (
          <EditarItem
            supabase={supabase}
            item={editando}
            onFechar={() => setEditando(null)}
            onSalvo={async () => {
              setEditando(null);
              await recarregarComanda(pedido);
            }}
          />
        )}

        {cancelandoItem && (
          <ModalPin
            titulo={'Cancelar ' + cancelandoItem.nome}
            descricao="O item já foi para a produção: o setor recebe um ticket de CANCELAMENTO. Precisa de gerente."
            perigo
            textoConfirmar="Cancelar item"
            sugestoesMotivo={['Cliente desistiu', 'Lançado errado', 'Demora', 'Item com problema']}
            onFechar={() => setCancelandoItem(null)}
            onConfirmar={async ({ pin, motivo }) => {
              await cancelarItem(supabase, {
                itemId: cancelandoItem.id,
                quantidade: qtdCancelar,
                motivo,
                devolverEstoque,
                pin,
                terminalId: terminalId(),
              });
              setCancelandoItem(null);
              setAviso('Item cancelado. O setor recebeu o aviso de cancelamento.');
              await recarregarComanda(pedido);
            }}
          >
            {cancelandoItem.quantidade > 1 && (
              <div>
                <label className="block text-sm font-medium text-[#2B3C44] mb-1">Quantas unidades cancelar?</label>
                <select
                  value={qtdCancelar}
                  onChange={(e) => setQtdCancelar(Number(e.target.value))}
                  className={INPUT + ' w-full'}
                >
                  {Array.from({ length: Math.floor(cancelandoItem.quantidade) }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} de {cancelandoItem.quantidade}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {cancelandoItem.status_cozinha === 'pronto' && (
              <label className="flex items-start gap-2 text-sm text-[#2B3C44]">
                <input
                  type="checkbox"
                  checked={devolverEstoque}
                  onChange={(e) => setDevolverEstoque(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Devolver ao estoque (o prato não foi consumido nem descartado)</span>
              </label>
            )}
          </ModalPin>
        )}

        {cancelandoPedido && (
          <ModalPin
            titulo={'Cancelar o pedido · ' + tituloComanda}
            descricao="Há itens na produção: cada setor recebe um ticket de cancelamento. Precisa de gerente."
            perigo
            textoConfirmar="Cancelar pedido"
            sugestoesMotivo={['Cliente foi embora', 'Pedido em duplicidade', 'Lançado errado']}
            onFechar={() => setCancelandoPedido(false)}
            onConfirmar={async ({ pin, motivo }) => {
              await cancelarPedidoAutorizado(supabase, { pedidoId: pedido.id, motivo, pin, terminalId: terminalId() });
              setCancelandoPedido(false);
              voltar();
            }}
          />
        )}

        {mostrarFechamento && (
          <FechamentoConta
            supabase={supabase}
            unidadeId={unidadeId}
            pedido={pedido}
            itens={itens}
            titulo={tituloComanda}
            onAtualizar={() => recarregarComanda(pedido)}
            onFechada={voltar}
            onVoltar={() => {
              setMostrarFechamento(false);
              recarregarComanda(pedido).catch(() => null);
            }}
          />
        )}

        {historico && (
          <HistoricoPedido
            supabase={supabase}
            unidadeId={unidadeId}
            pedidoId={historico.id}
            titulo={historico.titulo}
            onFechar={() => setHistorico(null)}
          />
        )}

        {faltas && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div role="alertdialog" className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#16252B]">Falta estoque no sistema</h2>
                <p className="text-sm text-[#5B6B73]">
                  Confira com a cozinha antes de enviar. Se o ingrediente existe e só não foi lançado,
                  dá para enviar mesmo assim, e o gerente confere depois.
                </p>
              </div>
              <ul className="divide-y divide-[#E6ECEF] border-y border-[#E6ECEF]">
                {faltas.map((f) => (
                  <li key={f.ingrediente_id} className="py-2.5 text-sm">
                    <p className="font-medium text-[#16252B]">
                      {f.ingrediente_nome}
                      <span className="font-normal text-[#5B6B73]"> · {f.produtos.join(', ')}</span>
                    </p>
                    <p className="text-[#B3261E]">
                      Precisa de {qtd(f.necessario)} {f.unidade}, o sistema tem {qtd(f.disponivel)} {f.unidade}
                    </p>
                    {f.naFila > 0 && (
                      <p className="text-xs text-[#8FA0A8]">
                        {qtd(f.naFila)} {f.unidade} já estão reservados para pedidos na cozinha
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button onClick={() => setFaltas(null)} disabled={ocupado} className={BTN_PRIMARY + ' flex-1'}>
                  Não enviar
                </button>
                <button
                  onClick={enviarMesmoAssim}
                  disabled={ocupado}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] text-sm font-medium hover:bg-[#FADBD6] disabled:opacity-50 transition"
                >
                  {ocupado ? 'Enviando...' : 'Enviar mesmo assim'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- SALÃO ----------------
  const balcaoAbertos = abertos.filter((p) => p.canal === 'balcao');

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#16252B]">PDV</h1>
            <p className="text-sm text-[#5B6B73]">Mesas, reservas e vendas no balcão</p>
          </div>
          <Link href="/impressao" className={BTN_SECONDARY}>
            Impressão
          </Link>
          <button onClick={novaVendaBalcao} className={BTN_PRIMARY}>
            Venda no balcão
          </button>
          <button onClick={() => setMostrarNovaMesa((v) => !v)} className={BTN_SECONDARY}>
            {mostrarNovaMesa ? 'Cancelar' : '+ Nova mesa'}
          </button>
        </div>

        {avisoErro}

        {problemasFila > 0 && (
          <Link
            href="/impressao"
            className="mb-4 flex items-center justify-between gap-3 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2 hover:underline"
          >
            <span>
              {problemasFila === 1 ? '1 impressão com problema' : problemasFila + ' impressões com problema'} (falha, sem
              impressora ou parada na fila).
            </span>
            <span className="font-semibold whitespace-nowrap">Ver fila →</span>
          </Link>
        )}

        {mostrarNovaMesa && (
          <form
            onSubmit={handleNovaMesa}
            className="bg-white border border-[#DCE3E7] rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-[#5B6B73] mb-1">Número</label>
              <input
                type="number"
                min="1"
                value={numeroMesa}
                onChange={(e) => setNumeroMesa(e.target.value)}
                className={INPUT + ' w-28'}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5B6B73] mb-1">Lugares</label>
              <input
                type="number"
                min="1"
                value={capacidadeMesa}
                onChange={(e) => setCapacidadeMesa(e.target.value)}
                className={INPUT + ' w-28'}
              />
            </div>
            <button type="submit" className={BTN_PRIMARY}>
              Adicionar mesa
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-center py-12 text-[#5B6B73]">Carregando...</p>
        ) : (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5B6B73] mb-3">
              Mesas
            </h2>
            {mesas.length === 0 ? (
              <div className="bg-white border border-[#DCE3E7] rounded-xl p-8 text-center mb-8">
                <p className="text-[#16252B]">Nenhuma mesa cadastrada</p>
                <p className="text-sm text-[#5B6B73] mt-2">Clique em + Nova mesa para começar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
                {mesas.map((m) => {
                  const p = abertos.find((x) => x.mesa_id === m.id);
                  const reservaHoje = reservas.find((r) => r.mesa_id === m.id && ehHoje(r.data_hora));
                  const reservada = !p && !!reservaHoje;
                  return (
                    <div
                      key={m.id}
                      className={
                        'rounded-xl border p-4 transition ' +
                        (p?.pre_conta_em
                          ? 'bg-[#DCEEF2] border-[#9CCBD6]'
                          : p
                          ? 'bg-[#FFF0C7] border-[#E8D28A]'
                          : reservada
                          ? 'bg-[#FADBD6] border-[#F2C2BB]'
                          : 'bg-white border-[#DCE3E7] hover:border-[#0E6B7E]')
                      }
                    >
                      <button onClick={() => clicarMesa(m)} className="w-full text-left">
                        <span className="block text-lg font-bold text-[#16252B]">
                          Mesa {m.numero}
                        </span>
                        <span className="block text-xs text-[#5B6B73]">{m.capacidade} lugares</span>
                        <span
                          className={
                            'inline-block mt-2 rounded-full px-3 py-1 text-xs font-semibold ' +
                            (p
                              ? 'bg-white text-[#7A5A0A]'
                              : reservada
                              ? 'bg-white text-[#B3261E]'
                              : 'bg-[#D9F0E3] text-[#1E6B3F]')
                          }
                        >
                          {p
                            ? (p.pre_conta_em ? 'Conta pedida · ' : 'Ocupada · ') + moeda(p.total)
                            : reservada
                            ? 'Reservada · ' + hora(reservaHoje!.data_hora)
                            : 'Livre'}
                        </span>
                        {reservada && (
                          <span className="block text-xs text-[#5B6B73] mt-1 truncate">
                            {reservaHoje!.nome_cliente}
                          </span>
                        )}
                      </button>
                      {!p && (
                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={() => abrirReserva(m)}
                            className="text-xs font-medium text-[#0E6B7E] hover:underline"
                          >
                            Reservar
                          </button>
                          <button
                            onClick={() => handleExcluirMesa(m)}
                            className="text-xs text-[#8FA0A8] hover:text-[#B3261E]"
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

            {/* Lista de reservas */}
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5B6B73] mb-3">
              Reservas
            </h2>
            {reservas.length === 0 ? (
              <div className="bg-white border border-[#DCE3E7] rounded-xl p-6 text-center mb-8">
                <p className="text-sm text-[#5B6B73]">
                  Nenhuma reserva. Use o botão Reservar no card da mesa.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-[#DCE3E7] rounded-xl overflow-x-auto mb-8">
                <table className="w-full">
                  <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Quando</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Mesa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Cliente</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Pessoas</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6ECEF]">
                    {reservas.map((r) => {
                      const mesa = mesas.find((m) => m.id === r.mesa_id);
                      return (
                        <tr key={r.id} className="hover:bg-[#F8FAFB]">
                          <td className="px-4 py-3 text-sm font-medium text-[#16252B]">
                            {dataHoraCurta(r.data_hora)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#2B3C44]">
                            Mesa {mesa?.numero ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#2B3C44]">
                            {r.nome_cliente}
                            {r.telefone && (
                              <span className="block text-xs text-[#5B6B73]">{r.telefone}</span>
                            )}
                            {r.observacao && (
                              <span className="block text-xs text-[#8FA0A8]">{r.observacao}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-[#2B3C44]">{r.pessoas}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => cancelarReserva(r)}
                              className="text-sm px-3 py-1.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] hover:bg-[#FADBD6] transition"
                            >
                              Cancelar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {balcaoAbertos.length > 0 && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5B6B73] mb-3">
                  Vendas no balcão em aberto
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {balcaoAbertos.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => abrirComanda(p)}
                      className="text-left rounded-xl border border-[#DCE3E7] bg-white p-4 hover:border-[#0E6B7E] transition"
                    >
                      <span className="block text-base font-bold text-[#16252B]">
                        Balcão #{p.numero}
                      </span>
                      <span className="block text-sm text-[#0E6B7E] font-semibold mt-1">
                        {moeda(p.total)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {fechadasHoje.length > 0 && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5B6B73] mb-3 mt-8">
                  Contas fechadas hoje
                </h2>
                <div className="bg-white border border-[#DCE3E7] rounded-xl overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F4F7F8] border-b border-[#DCE3E7]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Conta</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Pagamento</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#5B6B73]">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6ECEF]">
                      {fechadasHoje.map((c) => (
                        <tr key={c.id} className="hover:bg-[#F8FAFB]">
                          <td className="px-4 py-3 text-sm text-[#2B3C44]">{hora(c.fechado_em)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-[#16252B]">
                            {tituloConta(c)}
                            {c.reaberturas > 0 && (
                              <span className="ml-2 text-xs font-normal text-[#B3261E]">reaberta {c.reaberturas}×</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#2B3C44]">{rotuloForma(c.forma_pagamento)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-[#16252B]">{moeda(c.total)}</td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => setHistorico({ id: c.id, titulo: tituloConta(c) })}
                              className="text-sm px-3 py-1.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] hover:bg-[#F1F5F7] transition mr-2"
                            >
                              Comprovante e histórico
                            </button>
                            <button
                              onClick={() => setReabrindo(c)}
                              className="text-sm px-3 py-1.5 rounded-lg border border-[#F2C2BB] bg-white text-[#B3261E] hover:bg-[#FADBD6] transition"
                            >
                              Reabrir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {reabrindo && (
        <ModalPin
          titulo={'Reabrir ' + tituloConta(reabrindo) + ' (' + moeda(reabrindo.total) + ')'}
          descricao="O fechamento anterior continua guardado. Os pagamentos seguem valendo; estorne se precisar. Precisa de gerente."
          perigo
          textoConfirmar="Reabrir conta"
          sugestoesMotivo={['Pagamento lançado errado', 'Cliente pediu mais itens', 'Item cobrado errado']}
          onFechar={() => setReabrindo(null)}
          onConfirmar={({ pin, motivo }) => confirmarReabertura(reabrindo, pin, motivo)}
        />
      )}

      {historico && (
        <HistoricoPedido
          supabase={supabase}
          unidadeId={unidadeId}
          pedidoId={historico.id}
          titulo={historico.titulo}
          onFechar={() => setHistorico(null)}
        />
      )}

      {/* Modal: nova reserva */}
      {mesaReserva && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={salvarReserva}
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#16252B]">
                Reservar mesa {mesaReserva.numero}
              </h2>
              <button
                type="button"
                onClick={() => setMesaReserva(null)}
                className="text-xl text-[#8FA0A8] hover:text-[#16252B]"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2B3C44] mb-1">
                Nome do cliente <span className="text-[#B3261E]">*</span>
              </label>
              <input
                type="text"
                value={rNome}
                onChange={(e) => setRNome(e.target.value)}
                className={INPUT + ' w-full'}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#2B3C44] mb-1">Telefone</label>
                <input
                  type="tel"
                  value={rTelefone}
                  onChange={(e) => setRTelefone(e.target.value)}
                  placeholder="(44) 99999-9999"
                  className={INPUT + ' w-full'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2B3C44] mb-1">
                  Pessoas <span className="text-[#B3261E]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={rPessoas}
                  onChange={(e) => setRPessoas(e.target.value)}
                  className={INPUT + ' w-full'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2B3C44] mb-1">
                Data e hora <span className="text-[#B3261E]">*</span>
              </label>
              <input
                type="datetime-local"
                value={rDataHora}
                onChange={(e) => setRDataHora(e.target.value)}
                className={INPUT + ' w-full'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2B3C44] mb-1">Observação</label>
              <input
                type="text"
                value={rObs}
                onChange={(e) => setRObs(e.target.value)}
                placeholder="Ex: aniversário, cadeirinha de bebê"
                className={INPUT + ' w-full'}
              />
            </div>

            {rErro && (
              <div role="alert" className="text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
                {rErro}
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={rSalvando} className={BTN_PRIMARY + ' flex-1'}>
                {rSalvando ? 'Salvando...' : 'Salvar reserva'}
              </button>
              <button
                type="button"
                onClick={() => setMesaReserva(null)}
                className={BTN_SECONDARY + ' flex-1'}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}