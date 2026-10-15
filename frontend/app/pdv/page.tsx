'use client';

import { useEffect, useMemo, useState } from 'react';
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
  fecharPedido,
  cancelarPedido,
  FORMAS_PAGAMENTO,
  type Mesa,
  type PedidoPdv,
  type ItemPdv,
  type ProdutoCardapio,
} from '@/lib/queries/salao';

const INPUT =
  'border border-[#C9D3D8] rounded-lg px-3 py-2.5 text-sm text-[#16252B] bg-white placeholder:text-[#8FA0A8] focus:outline-none focus:ring-2 focus:ring-[#0E6B7E]';
const BTN_PRIMARY =
  'bg-[#0E6B7E] hover:bg-[#0B5A6A] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition';
const BTN_SECONDARY =
  'px-4 py-2.5 rounded-lg border border-[#DCE3E7] bg-white text-[#2B3C44] text-sm font-medium hover:bg-[#F1F5F7] transition';

const moeda = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

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
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // nova mesa
  const [mostrarNovaMesa, setMostrarNovaMesa] = useState(false);
  const [numeroMesa, setNumeroMesa] = useState('');
  const [capacidadeMesa, setCapacidadeMesa] = useState('4');

  // comanda
  const [pedido, setPedido] = useState<PedidoPdv | null>(null);
  const [itens, setItens] = useState<ItemPdv[]>([]);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('todos');
  const [forma, setForma] = useState('dinheiro');
  const [ocupado, setOcupado] = useState(false);

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
          ? 'As tabelas do PDV ainda não existem. Rode o SQL schema-pdv-simples.sql no Supabase.'
          : e?.message || 'Erro ao carregar'
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    carregarInicio();
  }, []);

  async function recarregarComanda(p: PedidoPdv) {
    const lista = await listarItens(supabase, p.id);
    setItens(lista);
    // atualiza o total do pedido atual
    const todos = await listarPedidosAbertos(supabase, unidadeId);
    setAbertos(todos);
    const atual = todos.find((x) => x.id === p.id);
    if (atual) setPedido(atual);
  }

  async function abrirComanda(p: PedidoPdv) {
    setErro(null);
    setPedido(p);
    setBusca('');
    setCategoria('todos');
    setForma('dinheiro');
    try {
      setItens(await listarItens(supabase, p.id));
    } catch (e: any) {
      setErro(e.message || 'Erro ao abrir a comanda');
    }
  }

  async function clicarMesa(m: Mesa) {
    const existente = abertos.find((p) => p.mesa_id === m.id);
    if (existente) return abrirComanda(existente);
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
    if (!window.confirm('Excluir a mesa ' + m.numero + '?')) return;
    try {
      await excluirMesa(supabase, m.id);
      setMesas(await listarMesas(supabase, unidadeId));
    } catch (e: any) {
      setErro(e.message || 'Erro ao excluir a mesa');
    }
  }

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

  async function fechar() {
    if (!pedido) return;
    if (itens.length === 0) {
      setErro('Adicione pelo menos um item antes de fechar a conta.');
      return;
    }
    setOcupado(true);
    try {
      await fecharPedido(supabase, pedido.id, forma);
      voltar();
    } catch (e: any) {
      setErro(e.message || 'Erro ao fechar a conta');
    }
    setOcupado(false);
  }

  async function cancelar() {
    if (!pedido) return;
    if (!window.confirm('Cancelar este pedido? Os itens serão descartados.')) return;
    setOcupado(true);
    try {
      await cancelarPedido(supabase, pedido.id);
      voltar();
    } catch (e: any) {
      setErro(e.message || 'Erro ao cancelar');
    }
    setOcupado(false);
  }

  function voltar() {
    setPedido(null);
    setItens([]);
    setErro(null);
    carregarInicio();
  }

  const totalPedido = itens.reduce((s, i) => s + i.quantidade * Number(i.preco_unitario), 0);
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

  const avisoErro = erro && (
    <div role="alert" className="mb-4 text-sm text-[#B3261E] bg-[#FADBD6] rounded-lg px-3 py-2">
      {erro}
    </div>
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
            <div>
              <h1 className="text-2xl font-bold text-[#16252B]">{tituloComanda}</h1>
              <p className="text-sm text-[#5B6B73]">Toque em um item do cardápio para adicionar</p>
            </div>
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
                  {itens.map((i) => (
                    <li key={i.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#16252B] truncate">{i.nome}</p>
                        <p className="text-xs text-[#5B6B73]">
                          {moeda(i.preco_unitario)} cada
                        </p>
                      </div>
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
                      <span className="w-20 text-right text-sm font-semibold text-[#16252B]">
                        {moeda(i.quantidade * Number(i.preco_unitario))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-between items-center border-t border-[#DCE3E7] pt-3 mb-4">
                <span className="text-sm font-medium text-[#5B6B73]">Total</span>
                <span className="text-xl font-bold text-[#16252B]">{moeda(totalPedido)}</span>
              </div>

              <label className="block text-sm font-medium text-[#2B3C44] mb-1">
                Forma de pagamento
              </label>
              <select
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                className={INPUT + ' w-full mb-4'}
              >
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </select>

              <button
                onClick={fechar}
                disabled={ocupado || itens.length === 0}
                className={BTN_PRIMARY + ' w-full mb-2'}
              >
                Fechar conta
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
            <p className="text-sm text-[#5B6B73]">Mesas e vendas no balcão</p>
          </div>
          <button onClick={novaVendaBalcao} className={BTN_PRIMARY}>
            Venda no balcão
          </button>
          <button onClick={() => setMostrarNovaMesa((v) => !v)} className={BTN_SECONDARY}>
            {mostrarNovaMesa ? 'Cancelar' : '+ Nova mesa'}
          </button>
        </div>

        {avisoErro}

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
                  return (
                    <div
                      key={m.id}
                      className={
                        'rounded-xl border p-4 transition ' +
                        (p
                          ? 'bg-[#FFF0C7] border-[#E8D28A]'
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
                            (p ? 'bg-white text-[#7A5A0A]' : 'bg-[#D9F0E3] text-[#1E6B3F]')
                          }
                        >
                          {p ? 'Ocupada · ' + moeda(p.total) : 'Livre'}
                        </span>
                      </button>
                      {!p && (
                        <button
                          onClick={() => handleExcluirMesa(m)}
                          className="block mt-2 text-xs text-[#8FA0A8] hover:text-[#B3261E]"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  );
                })}
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
          </>
        )}
      </div>
    </div>
  );
}