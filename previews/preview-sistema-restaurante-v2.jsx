import React, { useState, useMemo } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  ChefHat,
  Package,
  ClipboardList,
  Menu,
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  ShoppingBag,
  Lock,
  Bell,
  ChevronRight,
  ChevronDown,
  Tag,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const c = {
  bg: "#111316",
  panel: "#1A1D22",
  panelAlt: "#20242A",
  border: "#2A2F37",
  borderLight: "#343A42",
  accent: "#F2A93B",
  accentDim: "#7A5A22",
  accentSoft: "#3A2E17",
  success: "#5FBF77",
  successSoft: "#1E2B20",
  danger: "#E5606A",
  dangerSoft: "#2E1C1F",
  info: "#5B9DF2",
  infoSoft: "#1B2530",
  text: "#F2F3F5",
  muted: "#9AA1AC",
  faint: "#6B7178",
};

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
.font-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.01em; }
.font-body { font-family: 'Inter', sans-serif; }
.font-mono { font-family: 'JetBrains Mono', monospace; }
input[type=number]::-webkit-inner-spin-button { opacity: 1; }
`;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const NAV = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard, active: true },
  { id: "pdv", label: "PDV", icon: ShoppingCart, active: true },
  { id: "fichas", label: "Fichas Técnicas", icon: ClipboardList, active: true },
  { id: "mesas", label: "Mesas", icon: UtensilsCrossed, active: true },
  { id: "cozinha", label: "Cozinha", icon: ChefHat, active: true },
  { id: "estoque", label: "Estoque", icon: Package, active: true },
  { id: "compras", label: "Compras", icon: ShoppingBag, active: false },
  { id: "clientes", label: "Clientes", icon: Users, active: false },
  { id: "financeiro", label: "Financeiro", icon: DollarSign, active: false },
];

const CATEGORIAS = ["Lanches", "Pratos", "Bebidas", "Sobremesas"];

const PRODUTOS = [
  { id: 1, nome: "X-Burger Artesanal", categoria: "Lanches", preco: 28.9 },
  { id: 2, nome: "X-Salada Duplo", categoria: "Lanches", preco: 32.5 },
  { id: 3, nome: "Batata Frita G", categoria: "Lanches", preco: 18.0 },
  { id: 4, nome: "Filé à Parmegiana", categoria: "Pratos", preco: 46.9 },
  { id: 5, nome: "Risoto de Camarão", categoria: "Pratos", preco: 52.0 },
  { id: 6, nome: "Frango Grelhado", categoria: "Pratos", preco: 34.5 },
  { id: 7, nome: "Refrigerante Lata", categoria: "Bebidas", preco: 7.0 },
  { id: 8, nome: "Suco Natural 500ml", categoria: "Bebidas", preco: 12.0 },
  { id: 9, nome: "Água com Gás", categoria: "Bebidas", preco: 5.5 },
  { id: 10, nome: "Petit Gâteau", categoria: "Sobremesas", preco: 19.9 },
  { id: 11, nome: "Pudim da Casa", categoria: "Sobremesas", preco: 14.0 },
];

const MESAS_INICIAL = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const status = n % 5 === 0 ? "aguardando" : n % 3 === 0 ? "ocupada" : "livre";
  return { id: n, status, pessoas: status === "livre" ? 0 : (n % 4) + 1 };
});

const KDS_INICIAL = [
  { id: "0231", mesa: "Mesa 4", itens: ["1x Filé à Parmegiana", "1x Refrigerante Lata"], minutos: 4, status: "fila" },
  { id: "0232", mesa: "Delivery", itens: ["2x X-Burger Artesanal", "1x Batata Frita G"], minutos: 9, status: "preparo" },
  { id: "0233", mesa: "Mesa 7", itens: ["1x Risoto de Camarão"], minutos: 13, status: "preparo" },
  { id: "0234", mesa: "Balcão", itens: ["1x Petit Gâteau", "1x Suco Natural 500ml"], minutos: 2, status: "fila" },
  { id: "0235", mesa: "Mesa 2", itens: ["1x Frango Grelhado", "2x Água com Gás"], minutos: 18, status: "pronto" },
];

const ESTOQUE = [
  { id: 1, nome: "Carne bovina (kg)", atual: 8, min: 15, max: 60, unidade: "kg" },
  { id: 2, nome: "Pão artesanal (un)", atual: 120, min: 40, max: 200, unidade: "un" },
  { id: 3, nome: "Queijo mussarela (kg)", atual: 22, min: 10, max: 40, unidade: "kg" },
  { id: 4, nome: "Batata (kg)", atual: 6, min: 20, max: 80, unidade: "kg" },
  { id: 5, nome: "Camarão (kg)", atual: 9, min: 5, max: 25, unidade: "kg" },
  { id: 6, nome: "Refrigerante lata", atual: 210, min: 100, max: 400, unidade: "un" },
  { id: 7, nome: "Chocolate 70% (kg)", atual: 3, min: 4, max: 15, unidade: "kg" },
  { id: 8, nome: "Frango (kg)", atual: 34, min: 15, max: 50, unidade: "kg" },
];

const VENDAS_SEMANA = [
  { dia: "Seg", valor: 3120 },
  { dia: "Ter", valor: 2840 },
  { dia: "Qua", valor: 3560 },
  { dia: "Qui", valor: 3910 },
  { dia: "Sex", valor: 5230 },
  { dia: "Sáb", valor: 6480 },
  { dia: "Dom", valor: 5010 },
];

// fichas técnicas de exemplo: um produto preparado (vários ingredientes) e
// um produto de revenda direta (item pronto, sem receita)
const FICHAS_INICIAL = {
  preparado: {
    produto: "X-Burger Artesanal",
    tipo: "preparado",
    precoVenda: 28.9,
    rendimento: 1,
    perdaPct: 5,
    ingredientes: [
      { id: "i1", nome: "Pão artesanal (un)", quantidade: 1, unidade: "un", custoUnit: 1.2 },
      { id: "i2", nome: "Carne bovina (kg)", quantidade: 0.15, unidade: "kg", custoUnit: 9.0 },
      { id: "i3", nome: "Queijo mussarela (kg)", quantidade: 0.05, unidade: "kg", custoUnit: 28.0 },
      { id: "i4", nome: "Molho da casa (kg)", quantidade: 0.02, unidade: "kg", custoUnit: 12.0 },
    ],
    adicionais: [
      { id: "a1", tipo: "embalagem", descricao: "Caixa + papel manteiga", valor: 0.8 },
      { id: "a2", tipo: "mao_de_obra", descricao: "Montagem (≈4 min)", valor: 1.5 },
    ],
  },
  revenda: {
    produto: "Garrafa de Açaí 500ml",
    tipo: "revenda",
    precoVenda: 18.0,
    ingredienteRevenda: { nome: "Açaí garrafa 500ml (fornecedor)", custoUnit: 9.5 },
  },
};

const money = (v) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function Badge({ children, tone = "muted" }) {
  const tones = {
    muted: { bg: c.panelAlt, fg: c.muted, bd: c.border },
    success: { bg: c.successSoft, fg: c.success, bd: c.success },
    danger: { bg: c.dangerSoft, fg: c.danger, bd: c.danger },
    info: { bg: c.infoSoft, fg: c.info, bd: c.info },
    accent: { bg: c.accentSoft, fg: c.accent, bd: c.accent },
  };
  const t = tones[tone];
  return (
    <span
      className="font-body text-xs font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1"
      style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.bd + "55" }}
    >
      {children}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone = "accent" }) {
  const toneColor = { accent: c.accent, success: c.success, info: c.info, danger: c.danger }[tone];
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 min-w-0" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
      <div className="flex items-center justify-between">
        <span className="font-body text-xs uppercase tracking-wide" style={{ color: c.faint }}>{label}</span>
        <Icon size={16} style={{ color: toneColor }} />
      </div>
      <div className="font-display text-2xl font-semibold" style={{ color: c.text }}>{value}</div>
      {sub && <span className="font-body text-xs" style={{ color: c.muted }}>{sub}</span>}
    </div>
  );
}

function MiniInput({ value, onChange, suffix, width = "w-20" }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`${width} font-mono text-sm rounded-md px-2 py-1 outline-none text-right`}
        style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text }}
      />
      {suffix && <span className="font-body text-xs" style={{ color: c.faint }}>{suffix}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard (inalterado)
// ---------------------------------------------------------------------------
function Dashboard() {
  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>Painel — Unidade Centro</h1>
        <p className="font-body text-sm mt-1" style={{ color: c.muted }}>Sábado, 29 de agosto · atualizado agora</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={DollarSign} label="Faturamento hoje" value={money(5230)} sub="+12% vs. sáb. passado" tone="accent" />
        <KpiCard icon={ShoppingCart} label="Pedidos hoje" value="87" sub="Ticket médio R$ 60,12" tone="info" />
        <KpiCard icon={TrendingUp} label="CMV" value="31,4%" sub="Meta: até 33%" tone="success" />
        <KpiCard icon={AlertTriangle} label="Alertas ativos" value="3" sub="2 estoque · 1 validade" tone="danger" />
      </div>
      <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold" style={{ color: c.text }}>Vendas da semana</h2>
          <Badge tone="accent">Últimos 7 dias</Badge>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={VENDAS_SEMANA} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke={c.border} />
              <XAxis dataKey="dia" stroke={c.faint} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={c.faint} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: c.panelAlt }} contentStyle={{ backgroundColor: c.panelAlt, border: `1px solid ${c.border}`, borderRadius: 8 }} labelStyle={{ color: c.text }} formatter={(v) => [money(v), "Faturamento"]} />
              <Bar dataKey="valor" fill={c.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
          <h2 className="font-display text-lg font-semibold mb-3" style={{ color: c.text }}>Alertas</h2>
          <div className="flex flex-col gap-2">
            {[
              { txt: "Batata abaixo do estoque mínimo (6kg / 20kg)", tone: "danger" },
              { txt: "Carne bovina abaixo do estoque mínimo (8kg / 15kg)", tone: "danger" },
              { txt: "Chocolate 70% vence em 3 dias", tone: "accent" },
            ].map((a, i) => (
              <div key={i} className="flex items-start gap-2 font-body text-sm" style={{ color: c.muted }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: a.tone === "danger" ? c.danger : c.accent }} />
                {a.txt}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
          <h2 className="font-display text-lg font-semibold mb-3" style={{ color: c.text }}>Fila da cozinha</h2>
          <div className="flex flex-col gap-2">
            {KDS_INICIAL.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between font-body text-sm">
                <span style={{ color: c.text }}>#{p.id} · {p.mesa}</span>
                <Badge tone={p.status === "pronto" ? "success" : p.status === "preparo" ? "accent" : "muted"}>
                  {p.status === "pronto" ? "Pronto" : p.status === "preparo" ? "Em preparo" : "Na fila"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PDV (inalterado)
// ---------------------------------------------------------------------------
function Pdv() {
  const [categoriaAtiva, setCategoriaAtiva] = useState("Lanches");
  const [carrinho, setCarrinho] = useState([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const produtosFiltrados = PRODUTOS.filter((p) => p.categoria === categoriaAtiva);
  const total = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
  const totalItens = carrinho.reduce((s, i) => s + i.qtd, 0);

  function addProduto(p) {
    setCarrinho((prev) => {
      const existe = prev.find((i) => i.id === p.id);
      if (existe) return prev.map((i) => (i.id === p.id ? { ...i, qtd: i.qtd + 1 } : i));
      return [...prev, { ...p, qtd: 1 }];
    });
  }
  function alterarQtd(id, delta) {
    setCarrinho((prev) => prev.map((i) => (i.id === id ? { ...i, qtd: i.qtd + delta } : i)).filter((i) => i.qtd > 0));
  }
  function removerItem(id) {
    setCarrinho((prev) => prev.filter((i) => i.id !== id));
  }

  const CartContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold" style={{ color: c.text }}>Pedido atual</h2>
        <button className="lg:hidden" onClick={() => setCarrinhoAberto(false)}><X size={20} style={{ color: c.muted }} /></button>
      </div>
      {carrinho.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
          <ShoppingCart size={28} style={{ color: c.faint }} />
          <p className="font-body text-sm" style={{ color: c.faint }}>Toque em um produto para adicionar ao pedido</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
          {carrinho.map((item) => (
            <div key={item.id} className="rounded-lg p-3 flex items-center justify-between gap-2" style={{ backgroundColor: c.panelAlt, border: `1px solid ${c.border}` }}>
              <div className="min-w-0">
                <p className="font-body text-sm font-medium truncate" style={{ color: c.text }}>{item.nome}</p>
                <p className="font-mono text-xs" style={{ color: c.muted }}>{money(item.preco)} un.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => alterarQtd(item.id, -1)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}><Minus size={12} style={{ color: c.text }} /></button>
                <span className="font-mono text-sm w-4 text-center" style={{ color: c.text }}>{item.qtd}</span>
                <button onClick={() => alterarQtd(item.id, 1)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}><Plus size={12} style={{ color: c.text }} /></button>
                <button onClick={() => removerItem(item.id)} className="ml-1"><Trash2 size={14} style={{ color: c.danger }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-body text-sm" style={{ color: c.muted }}>Total ({totalItens} {totalItens === 1 ? "item" : "itens"})</span>
          <span className="font-display text-xl font-semibold" style={{ color: c.accent }}>{money(total)}</span>
        </div>
        <button disabled={carrinho.length === 0} className="w-full font-body font-medium text-sm rounded-lg py-3 transition-opacity disabled:opacity-40" style={{ backgroundColor: c.accent, color: "#1A1305" }}>Finalizar pedido</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="flex-1 flex flex-col gap-4 pb-24 lg:pb-0">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>PDV</h1>
          <p className="font-body text-sm mt-1" style={{ color: c.muted }}>Selecione os produtos do pedido</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIAS.map((cat) => (
            <button key={cat} onClick={() => setCategoriaAtiva(cat)} className="font-body text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap shrink-0 transition-colors" style={categoriaAtiva === cat ? { backgroundColor: c.accent, color: "#1A1305" } : { backgroundColor: c.panel, color: c.muted, border: `1px solid ${c.border}` }}>{cat}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {produtosFiltrados.map((p) => (
            <button key={p.id} onClick={() => addProduto(p)} className="rounded-xl p-4 text-left flex flex-col gap-3 transition-colors hover:brightness-110" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
              <div className="w-full aspect-[4/3] rounded-lg flex items-center justify-center" style={{ backgroundColor: c.panelAlt }}><UtensilsCrossed size={22} style={{ color: c.faint }} /></div>
              <div>
                <p className="font-body text-sm font-medium leading-snug" style={{ color: c.text }}>{p.nome}</p>
                <p className="font-mono text-sm mt-1" style={{ color: c.accent }}>{money(p.preco)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="hidden lg:flex flex-col w-80 shrink-0 rounded-xl p-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>{CartContent}</div>
      {!carrinhoAberto && carrinho.length > 0 && (
        <button onClick={() => setCarrinhoAberto(true)} className="lg:hidden fixed bottom-20 right-4 rounded-full px-5 py-3 flex items-center gap-2 shadow-lg z-30" style={{ backgroundColor: c.accent, color: "#1A1305" }}>
          <ShoppingCart size={16} /><span className="font-body text-sm font-semibold">{totalItens} · {money(total)}</span>
        </button>
      )}
      {carrinhoAberto && (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCarrinhoAberto(false)} />
          <div className="relative w-full rounded-t-2xl p-4 max-h-[80vh] flex flex-col" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>{CartContent}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NOVO — Fichas Técnicas (custos detalhados + rateio de fixo + preço sugerido)
// ---------------------------------------------------------------------------
function FichasTecnicas() {
  const [fichaAtiva, setFichaAtiva] = useState("preparado");
  const ficha = FICHAS_INICIAL[fichaAtiva];

  const [ingredientes, setIngredientes] = useState(FICHAS_INICIAL.preparado.ingredientes);
  const [adicionais, setAdicionais] = useState(FICHAS_INICIAL.preparado.adicionais);
  const [perdaPct, setPerdaPct] = useState(FICHAS_INICIAL.preparado.perdaPct);
  const [precoVenda, setPrecoVenda] = useState(ficha.precoVenda);

  // parâmetros de precificação da unidade — mexer aqui recalcula toda ficha,
  // igual ao trigger trg_custos_fixos_change no banco
  const [custosFixos, setCustosFixos] = useState([
    { id: "c1", nome: "Aluguel", valor: 4500 },
    { id: "c2", nome: "Energia + água", valor: 1200 },
    { id: "c3", nome: "Salários administrativos", valor: 6800 },
  ]);
  const [faturamentoEstimado, setFaturamentoEstimado] = useState(85000);
  const [impostosPct, setImpostosPct] = useState(6);
  const [taxasCartaoPct, setTaxasCartaoPct] = useState(4);
  const [margemDesejadaPct, setMargemDesejadaPct] = useState(25);

  const totalCustosFixos = custosFixos.reduce((s, c2) => s + c2.valor, 0);
  const indiceFixoPct = faturamentoEstimado > 0 ? (totalCustosFixos / faturamentoEstimado) * 100 : 0;

  const calc = useMemo(() => {
    if (fichaAtiva === "revenda") {
      const custoBase = ficha.ingredienteRevenda.custoUnit;
      const custoFixoRateado = custoBase * (indiceFixoPct / 100);
      const custoTotalComFixo = custoBase + custoFixoRateado;
      const denom = 1 - (impostosPct + taxasCartaoPct + margemDesejadaPct) / 100;
      const precoSugerido = denom > 0 ? custoTotalComFixo / denom : null;
      const margemReal = precoVenda > 0 ? (1 - custoTotalComFixo / precoVenda) * 100 : null;
      return { custoIngredientes: custoBase, custoAdicional: 0, custoTotal: custoBase, custoFixoRateado, custoTotalComFixo, precoSugerido, margemReal };
    }
    const custoIngredientes = ingredientes.reduce((s, i) => s + i.quantidade * i.custoUnit, 0);
    const custoAdicional = adicionais.reduce((s, a) => s + a.valor, 0);
    const custoTotal = (custoIngredientes + custoAdicional) * (1 + perdaPct / 100);
    const custoFixoRateado = custoTotal * (indiceFixoPct / 100);
    const custoTotalComFixo = custoTotal + custoFixoRateado;
    const denom = 1 - (impostosPct + taxasCartaoPct + margemDesejadaPct) / 100;
    const precoSugerido = denom > 0 ? custoTotalComFixo / denom : null;
    const margemReal = precoVenda > 0 ? (1 - custoTotalComFixo / precoVenda) * 100 : null;
    return { custoIngredientes, custoAdicional, custoTotal, custoFixoRateado, custoTotalComFixo, precoSugerido, margemReal };
  }, [fichaAtiva, ingredientes, adicionais, perdaPct, indiceFixoPct, impostosPct, taxasCartaoPct, margemDesejadaPct, precoVenda, ficha]);

  function trocarFicha(tipo) {
    setFichaAtiva(tipo);
    setPrecoVenda(FICHAS_INICIAL[tipo].precoVenda);
  }
  function atualizarIngrediente(id, campo, valor) {
    setIngredientes((prev) => prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }
  function removerIngrediente(id) {
    setIngredientes((prev) => prev.filter((i) => i.id !== id));
  }
  function atualizarAdicional(id, valor) {
    setAdicionais((prev) => prev.map((a) => (a.id === id ? { ...a, valor } : a)));
  }
  function removerAdicional(id) {
    setAdicionais((prev) => prev.filter((a) => a.id !== id));
  }
  function atualizarCustoFixo(id, campo, valor) {
    setCustosFixos((prev) => prev.map((cf) => (cf.id === id ? { ...cf, [campo]: valor } : cf)));
  }
  function removerCustoFixo(id) {
    setCustosFixos((prev) => prev.filter((cf) => cf.id !== id));
  }

  const margemTone = calc.margemReal == null ? "muted" : calc.margemReal < 15 ? "danger" : calc.margemReal < 30 ? "accent" : "success";

  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>Fichas Técnicas</h1>
        <p className="font-body text-sm mt-1" style={{ color: c.muted }}>Custo detalhado e formação de preço, com rateio de custo fixo</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => trocarFicha("preparado")} className="font-body text-sm font-medium px-4 py-2 rounded-full transition-colors" style={fichaAtiva === "preparado" ? { backgroundColor: c.accent, color: "#1A1305" } : { backgroundColor: c.panel, color: c.muted, border: `1px solid ${c.border}` }}>
          X-Burger Artesanal
        </button>
        <button onClick={() => trocarFicha("revenda")} className="font-body text-sm font-medium px-4 py-2 rounded-full transition-colors flex items-center gap-1.5" style={fichaAtiva === "revenda" ? { backgroundColor: c.accent, color: "#1A1305" } : { backgroundColor: c.panel, color: c.muted, border: `1px solid ${c.border}` }}>
          <Tag size={12} /> Garrafa de Açaí 500ml
        </button>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-4">
        {/* Coluna principal — composição do produto */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-4 sm:p-5 flex items-center justify-between" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
            <div>
              <h2 className="font-display text-lg font-semibold" style={{ color: c.text }}>{ficha.produto}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge tone={fichaAtiva === "revenda" ? "info" : "muted"}>
                  {fichaAtiva === "revenda" ? "Revenda direta" : "Preparado"}
                </Badge>
                {fichaAtiva === "revenda" && (
                  <span className="font-body text-xs" style={{ color: c.faint }}>Sem receita — item comprado pronto</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="font-body text-xs block" style={{ color: c.faint }}>Preço praticado</span>
              <div className="flex items-center gap-1 mt-1">
                <span className="font-mono text-sm" style={{ color: c.muted }}>R$</span>
                <MiniInput value={precoVenda} onChange={setPrecoVenda} width="w-24" />
              </div>
            </div>
          </div>

          {fichaAtiva === "revenda" ? (
            <div className="rounded-xl p-4 sm:p-5 flex items-center justify-between" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.panelAlt }}>
                  <Package size={18} style={{ color: c.faint }} />
                </div>
                <div>
                  <p className="font-body text-sm font-medium" style={{ color: c.text }}>{ficha.ingredienteRevenda.nome}</p>
                  <p className="font-body text-xs mt-0.5" style={{ color: c.faint }}>1 unidade de compra = 1 unidade de venda</p>
                </div>
              </div>
              <span className="font-mono text-sm" style={{ color: c.accent }}>{money(ficha.ingredienteRevenda.custoUnit)}</span>
            </div>
          ) : (
            <>
              <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wide" style={{ color: c.muted }}>Ingredientes</h3>
                  <button className="flex items-center gap-1 font-body text-xs font-medium" style={{ color: c.accent }}>
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {ingredientes.map((ing) => (
                    <div key={ing.id} className="flex items-center gap-2 sm:gap-3 py-1.5" style={{ borderBottom: `1px solid ${c.border}` }}>
                      <span className="font-body text-sm flex-1 min-w-0 truncate" style={{ color: c.text }}>{ing.nome}</span>
                      <MiniInput value={ing.quantidade} onChange={(v) => atualizarIngrediente(ing.id, "quantidade", v)} suffix={ing.unidade} width="w-16" />
                      <span className="font-mono text-xs w-16 text-right shrink-0" style={{ color: c.muted }}>{money(ing.custoUnit)}</span>
                      <span className="font-mono text-sm w-16 text-right shrink-0" style={{ color: c.text }}>{money(ing.quantidade * ing.custoUnit)}</span>
                      <button onClick={() => removerIngrediente(ing.id)}><Trash2 size={13} style={{ color: c.faint }} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${c.border}` }}>
                  <span className="font-body text-sm" style={{ color: c.muted }}>Subtotal ingredientes</span>
                  <span className="font-mono text-sm font-medium" style={{ color: c.text }}>{money(calc.custoIngredientes)}</span>
                </div>
              </div>

              <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wide" style={{ color: c.muted }}>Custos adicionais</h3>
                  <button className="flex items-center gap-1 font-body text-xs font-medium" style={{ color: c.accent }}>
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {adicionais.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 sm:gap-3 py-1.5" style={{ borderBottom: `1px solid ${c.border}` }}>
                      <Badge tone="muted">{a.tipo === "embalagem" ? "Embalagem" : a.tipo === "mao_de_obra" ? "Mão de obra" : "Outro"}</Badge>
                      <span className="font-body text-sm flex-1 min-w-0 truncate" style={{ color: c.text }}>{a.descricao}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs" style={{ color: c.faint }}>R$</span>
                        <MiniInput value={a.valor} onChange={(v) => atualizarAdicional(a.id, v)} width="w-16" />
                      </div>
                      <button onClick={() => removerAdicional(a.id)}><Trash2 size={13} style={{ color: c.faint }} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${c.border}` }}>
                  <span className="font-body text-sm" style={{ color: c.muted }}>Subtotal adicionais</span>
                  <span className="font-mono text-sm font-medium" style={{ color: c.text }}>{money(calc.custoAdicional)}</span>
                </div>
              </div>

              <div className="rounded-xl p-4 sm:p-5 flex items-center gap-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
                <span className="font-body text-sm shrink-0" style={{ color: c.muted }}>Perda prevista no preparo</span>
                <MiniInput value={perdaPct} onChange={setPerdaPct} suffix="%" width="w-16" />
              </div>
            </>
          )}

          {/* Parâmetros de precificação da unidade */}
          <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: c.muted }}>
              Custos fixos da unidade (mensal)
            </h3>
            <div className="flex flex-col gap-2">
              {custosFixos.map((cf) => (
                <div key={cf.id} className="flex items-center gap-2 sm:gap-3 py-1.5" style={{ borderBottom: `1px solid ${c.border}` }}>
                  <span className="font-body text-sm flex-1 min-w-0 truncate" style={{ color: c.text }}>{cf.nome}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs" style={{ color: c.faint }}>R$</span>
                    <MiniInput value={cf.valor} onChange={(v) => atualizarCustoFixo(cf.id, "valor", v)} width="w-20" />
                  </div>
                  <button onClick={() => removerCustoFixo(cf.id)}><Trash2 size={13} style={{ color: c.faint }} /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${c.border}` }}>
              <span className="font-body text-sm" style={{ color: c.muted }}>Total custo fixo / mês</span>
              <span className="font-mono text-sm font-medium" style={{ color: c.text }}>{money(totalCustosFixos)}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="font-body text-sm flex items-center gap-1.5" style={{ color: c.muted }}>
                Faturamento médio mensal estimado
              </span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs" style={{ color: c.faint }}>R$</span>
                <MiniInput value={faturamentoEstimado} onChange={setFaturamentoEstimado} width="w-24" />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna lateral — resultado da formação de preço */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: c.muted }}>
              Parâmetros de margem
            </h3>
            <div className="flex flex-col gap-2.5">
              {[
                { label: "Impostos", value: impostosPct, set: setImpostosPct },
                { label: "Taxas de cartão/plataforma", value: taxasCartaoPct, set: setTaxasCartaoPct },
                { label: "Margem de lucro desejada", value: margemDesejadaPct, set: setMargemDesejadaPct },
              ].map((p) => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="font-body text-sm" style={{ color: c.muted }}>{p.label}</span>
                  <MiniInput value={p.value} onChange={p.set} suffix="%" width="w-16" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4 sm:p-5 flex flex-col gap-2.5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: c.muted }}>
              Formação de preço
            </h3>

            <Row label="Custo ingredientes" value={money(calc.custoIngredientes)} />
            {fichaAtiva === "preparado" && <Row label="Custo adicional" value={money(calc.custoAdicional)} />}
            <Row label={`Custo variável (perda ${fichaAtiva === "preparado" ? perdaPct : 0}%)`} value={money(calc.custoTotal)} strong />
            <Row
              label={`Custo fixo rateado (${indiceFixoPct.toFixed(1)}%)`}
              value={money(calc.custoFixoRateado)}
              hint="custos fixos ÷ faturamento estimado"
            />
            <div className="h-px my-1" style={{ backgroundColor: c.border }} />
            <Row label="Custo total do produto" value={money(calc.custoTotalComFixo)} strong tone={c.accent} />

            <div className="h-px my-1" style={{ backgroundColor: c.border }} />

            <Row
              label="Preço sugerido"
              value={calc.precoSugerido != null ? money(calc.precoSugerido) : "—"}
              strong
              tone={c.info}
              hint="custo total ÷ (1 − impostos − taxas − margem)"
            />
            <Row label="Preço praticado" value={money(precoVenda)} />

            <div
              className="rounded-lg p-3 mt-2 flex items-center justify-between"
              style={{
                backgroundColor: margemTone === "success" ? c.successSoft : margemTone === "danger" ? c.dangerSoft : c.accentSoft,
              }}
            >
              <span className="font-body text-sm font-medium" style={{ color: c.text }}>Margem real</span>
              <span
                className="font-display text-lg font-semibold"
                style={{ color: margemTone === "success" ? c.success : margemTone === "danger" ? c.danger : c.accent }}
              >
                {calc.margemReal != null ? `${calc.margemReal.toFixed(1)}%` : "—"}
              </span>
            </div>
            {calc.margemReal != null && calc.margemReal < 15 && (
              <p className="font-body text-xs flex items-start gap-1.5" style={{ color: c.danger }}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                Margem abaixo de 15% — mesmo alerta que o sistema geraria automaticamente no painel.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, tone, hint }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="font-body text-sm" style={{ color: strong ? c.text : c.muted }}>{label}</span>
        {hint && <p className="font-body text-[11px] mt-0.5" style={{ color: c.faint }}>{hint}</p>}
      </div>
      <span className={`font-mono text-sm shrink-0 ${strong ? "font-semibold" : ""}`} style={{ color: tone ?? (strong ? c.text : c.muted) }}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mesas / Cozinha / Estoque (inalterados)
// ---------------------------------------------------------------------------
function Mesas() {
  const [mesas, setMesas] = useState(MESAS_INICIAL);
  function cicloStatus(id) {
    setMesas((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      const ordem = ["livre", "ocupada", "aguardando"];
      const next = ordem[(ordem.indexOf(m.status) + 1) % ordem.length];
      return { ...m, status: next, pessoas: next === "livre" ? 0 : m.pessoas || 2 };
    }));
  }
  const statusInfo = {
    livre: { label: "Livre", tone: "success" },
    ocupada: { label: "Ocupada", tone: "accent" },
    aguardando: { label: "Aguard. pagto.", tone: "info" },
  };
  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>Mesas</h1>
        <p className="font-body text-sm mt-1" style={{ color: c.muted }}>Toque em uma mesa para alternar o status</p>
      </div>
      <div className="flex gap-4 font-body text-xs" style={{ color: c.muted }}>
        {Object.entries(statusInfo).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.tone === "success" ? c.success : v.tone === "accent" ? c.accent : c.info }} />
            {v.label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-3">
        {mesas.map((m) => {
          const info = statusInfo[m.status];
          const color = info.tone === "success" ? c.success : info.tone === "accent" ? c.accent : c.info;
          return (
            <button key={m.id} onClick={() => cicloStatus(m.id)} className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-transform active:scale-95" style={{ backgroundColor: c.panel, border: `1.5px solid ${color}55` }}>
              <span className="font-display text-xl font-semibold" style={{ color: c.text }}>{m.id}</span>
              <Badge tone={info.tone}>{info.label}</Badge>
              {m.pessoas > 0 && <span className="font-body text-xs flex items-center gap-1 mt-0.5" style={{ color: c.faint }}><Users size={10} /> {m.pessoas}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Cozinha() {
  const [pedidos, setPedidos] = useState(KDS_INICIAL);
  const colunas = [
    { key: "fila", label: "Na fila", tone: "muted" },
    { key: "preparo", label: "Em preparo", tone: "accent" },
    { key: "pronto", label: "Pronto", tone: "success" },
  ];
  function avancar(id) {
    setPedidos((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const ordem = ["fila", "preparo", "pronto"];
      const idx = ordem.indexOf(p.status);
      if (idx === ordem.length - 1) return p;
      return { ...p, status: ordem[idx + 1] };
    }));
  }
  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-6 h-full">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>Cozinha · KDS</h1>
        <p className="font-body text-sm mt-1" style={{ color: c.muted }}>Toque num pedido para avançar o status</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {colunas.map((col) => (
          <div key={col.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.tone === "success" ? c.success : col.tone === "accent" ? c.accent : c.faint }} />
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide" style={{ color: c.muted }}>{col.label}</h2>
              <span className="font-mono text-xs" style={{ color: c.faint }}>{pedidos.filter((p) => p.status === col.key).length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {pedidos.filter((p) => p.status === col.key).map((p) => (
                <button key={p.id} onClick={() => avancar(p.id)} disabled={p.status === "pronto"} className="text-left rounded-lg p-3 relative overflow-hidden" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}`, borderTop: `2px dashed ${c.borderLight}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-medium" style={{ color: c.accent }}>#{p.id}</span>
                    <span className="font-mono text-xs flex items-center gap-1" style={{ color: p.minutos > 12 ? c.danger : c.muted }}><Clock size={11} /> {p.minutos} min</span>
                  </div>
                  <p className="font-body text-xs font-semibold mb-1.5" style={{ color: c.text }}>{p.mesa}</p>
                  <ul className="font-body text-xs flex flex-col gap-0.5" style={{ color: c.muted }}>
                    {p.itens.map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                </button>
              ))}
              {pedidos.filter((p) => p.status === col.key).length === 0 && (
                <div className="rounded-lg p-4 text-center font-body text-xs" style={{ color: c.faint, border: `1px dashed ${c.border}` }}>Sem pedidos</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Estoque() {
  const [busca, setBusca] = useState("");
  const itens = ESTOQUE.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>Estoque</h1>
        <p className="font-body text-sm mt-1" style={{ color: c.muted }}>{ESTOQUE.filter((i) => i.atual < i.min).length} itens abaixo do estoque mínimo</p>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: c.faint }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ingrediente..." className="w-full font-body text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}`, color: c.text }} />
      </div>
      <div className="flex flex-col gap-2">
        {itens.map((i) => {
          const pct = Math.min(100, Math.round((i.atual / i.max) * 100));
          const baixo = i.atual < i.min;
          return (
            <div key={i.id} className="rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4" style={{ backgroundColor: c.panel, border: `1px solid ${baixo ? c.danger + "66" : c.border}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-body text-sm font-medium truncate" style={{ color: c.text }}>{i.nome}</p>
                  {baixo && <Badge tone="danger">Abaixo do mínimo</Badge>}
                </div>
                <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: c.panelAlt }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: baixo ? c.danger : c.accent }} />
                </div>
              </div>
              <div className="font-mono text-sm shrink-0 flex items-center justify-between sm:flex-col sm:items-end sm:text-right" style={{ color: c.muted }}>
                <span style={{ color: baixo ? c.danger : c.text }}>{i.atual} {i.unidade}</span>
                <span className="text-xs" style={{ color: c.faint }}>mín. {i.min} · máx. {i.max}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmBreve({ label }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24 text-center">
      <Lock size={26} style={{ color: c.faint }} />
      <h1 className="font-display text-xl font-semibold" style={{ color: c.text }}>{label}</h1>
      <p className="font-body text-sm max-w-xs" style={{ color: c.muted }}>Módulo previsto no roteiro completo — entra nas próximas fases de implementação.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
export default function App() {
  const [view, setView] = useState("fichas");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeItem = useMemo(() => NAV.find((n) => n.id === view), [view]);

  function go(id) {
    setView(id);
    setDrawerOpen(false);
  }
  function renderView() {
    switch (view) {
      case "dashboard": return <Dashboard />;
      case "pdv": return <Pdv />;
      case "fichas": return <FichasTecnicas />;
      case "mesas": return <Mesas />;
      case "cozinha": return <Cozinha />;
      case "estoque": return <Estoque />;
      default: return <EmBreve label={activeItem?.label ?? ""} />;
    }
  }
  const bottomTabs = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[5]];

  return (
    <div className="w-full min-h-screen font-body" style={{ backgroundColor: c.bg }}>
      <style>{fontImport}</style>
      <div className="flex w-full min-h-screen">
        <aside className="hidden md:flex flex-col w-16 lg:w-56 shrink-0 p-3 gap-1" style={{ backgroundColor: c.panel, borderRight: `1px solid ${c.border}` }}>
          <div className="flex items-center gap-2 px-2 py-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.accent }}><ChefHat size={16} color="#1A1305" /></div>
            <span className="hidden lg:block font-display text-lg font-semibold" style={{ color: c.text }}>Sabor&nbsp;Gestão</span>
          </div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.id;
            return (
              <button key={item.id} onClick={() => item.active && go(item.id)} disabled={!item.active} className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-colors disabled:opacity-40" style={{ backgroundColor: isActive ? c.accentSoft : "transparent", color: isActive ? c.accent : c.muted }}>
                <Icon size={18} className="shrink-0" />
                <span className="hidden lg:block font-body text-sm font-medium truncate">{item.label}</span>
                {!item.active && <Lock size={11} className="hidden lg:block ml-auto shrink-0" />}
              </button>
            );
          })}
        </aside>

        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <div className="relative w-64 h-full p-3 flex flex-col gap-1" style={{ backgroundColor: c.panel }}>
              <div className="flex items-center justify-between px-2 py-3 mb-2">
                <span className="font-display text-lg font-semibold" style={{ color: c.text }}>Sabor Gestão</span>
                <button onClick={() => setDrawerOpen(false)}><X size={20} style={{ color: c.muted }} /></button>
              </div>
              {NAV.map((item) => {
                const Icon = item.icon;
                const isActive = view === item.id;
                return (
                  <button key={item.id} onClick={() => item.active && go(item.id)} disabled={!item.active} className="flex items-center gap-3 px-3 py-3 rounded-lg disabled:opacity-40" style={{ backgroundColor: isActive ? c.accentSoft : "transparent", color: isActive ? c.accent : c.muted }}>
                    <Icon size={18} />
                    <span className="font-body text-sm font-medium">{item.label}</span>
                    {!item.active && <Lock size={12} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0" style={{ borderBottom: `1px solid ${c.border}`, backgroundColor: c.bg }}>
            <div className="flex items-center gap-3">
              <button className="md:hidden" onClick={() => setDrawerOpen(true)}><Menu size={20} style={{ color: c.text }} /></button>
              <div className="flex items-center gap-1.5 font-body text-sm" style={{ color: c.muted }}>
                <span style={{ color: c.text }}>Unidade Centro</span>
                <ChevronRight size={13} style={{ color: c.faint }} />
                <span>{activeItem?.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative"><Bell size={18} style={{ color: c.muted }} /><span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: c.danger }} /></button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-body text-xs font-semibold" style={{ backgroundColor: c.panelAlt, color: c.text, border: `1px solid ${c.border}` }}>VS</div>
            </div>
          </header>
          <main className="flex-1 px-4 sm:px-6 py-5 overflow-y-auto">{renderView()}</main>
        </div>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex items-stretch z-20" style={{ backgroundColor: c.panel, borderTop: `1px solid ${c.border}` }}>
        {bottomTabs.map((item) => {
          const Icon = item.icon;
          const isActive = view === item.id;
          return (
            <button key={item.id} onClick={() => go(item.id)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5" style={{ color: isActive ? c.accent : c.faint }}>
              <Icon size={19} />
              <span className="font-body text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
