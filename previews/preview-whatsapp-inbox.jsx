import React, { useState, useMemo } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  ChefHat,
  Package,
  ClipboardList,
  MessageCircle,
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
  Phone,
  CheckCircle2,
  Ban,
  ArrowRight,
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
  accentSoft: "#3A2E17",
  success: "#5FBF77",
  successSoft: "#1E2B20",
  danger: "#E5606A",
  dangerSoft: "#2E1C1F",
  info: "#5B9DF2",
  infoSoft: "#1B2530",
  whats: "#3FBF5E",
  whatsSoft: "#152A1B",
  text: "#F2F3F5",
  muted: "#9AA1AC",
  faint: "#6B7178",
};

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
.font-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.01em; }
.font-body { font-family: 'Inter', sans-serif; }
.font-mono { font-family: 'JetBrains Mono', monospace; }
`;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const NAV = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard, active: true },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, active: true },
  { id: "pdv", label: "PDV", icon: ShoppingCart, active: true },
  { id: "fichas", label: "Fichas Técnicas", icon: ClipboardList, active: true },
  { id: "mesas", label: "Mesas", icon: UtensilsCrossed, active: true },
  { id: "cozinha", label: "Cozinha", icon: ChefHat, active: true },
  { id: "estoque", label: "Estoque", icon: Package, active: true },
  { id: "clientes", label: "Clientes", icon: Users, active: false },
  { id: "financeiro", label: "Financeiro", icon: DollarSign, active: false },
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
];

const ESTOQUE = [
  { id: 1, nome: "Carne bovina (kg)", atual: 8, min: 15, max: 60, unidade: "kg" },
  { id: 2, nome: "Pão artesanal (un)", atual: 120, min: 40, max: 200, unidade: "un" },
  { id: 4, nome: "Batata (kg)", atual: 6, min: 20, max: 80, unidade: "kg" },
];

const VENDAS_SEMANA = [
  { dia: "Seg", valor: 3120 }, { dia: "Ter", valor: 2840 }, { dia: "Qua", valor: 3560 },
  { dia: "Qui", valor: 3910 }, { dia: "Sex", valor: 5230 }, { dia: "Sáb", valor: 6480 }, { dia: "Dom", valor: 5010 },
];

const PRODUTOS_RAPIDOS = [
  { id: 1, nome: "X-Burger Artesanal", preco: 28.9 },
  { id: 2, nome: "Batata Frita G", preco: 18.0 },
  { id: 3, nome: "Refrigerante Lata", preco: 7.0 },
  { id: 4, nome: "Garrafa de Açaí 500ml", preco: 18.0 },
];

const MENSAGENS_INICIAL = [
  {
    id: "m1",
    telefone: "(44) 99811-2233",
    nome: "Renata Souza",
    mensagem: "Oi, boa noite! Vcs entregam na Vila Operária? Queria 2 x-burger e 1 batata grande",
    recebidoEm: "20:41",
    status: "nao_atendido",
  },
  {
    id: "m2",
    telefone: "(44) 99700-4410",
    nome: null,
    mensagem: "Ainda estão abertos? Vou querer fazer um pedido",
    recebidoEm: "20:38",
    status: "nao_atendido",
  },
  {
    id: "m3",
    telefone: "(44) 98811-0099",
    nome: "João Pedro",
    mensagem: "Quero 1 garrafa de açaí 500ml, endereço: Rua das Acácias, 210",
    recebidoEm: "20:22",
    status: "atendido",
    observacoes: "Confirmando forma de pagamento com o cliente",
  },
  {
    id: "m4",
    telefone: "(44) 99655-7788",
    nome: "Camila",
    mensagem: "Bom dia, vocês fazem entrega no condomínio Bosque Verde?",
    recebidoEm: "09:15",
    status: "descartado",
    observacoes: "Cliente só tirou dúvida, não fechou pedido",
  },
  {
    id: "m5",
    telefone: "(44) 99244-1120",
    nome: "Marcos",
    mensagem: "2 refrigerante lata e 1 x-burger pra retirar",
    recebidoEm: "19:50",
    status: "convertido",
    pedidoNumero: 452,
  },
];

const money = (v) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
    whats: { bg: c.whatsSoft, fg: c.whats, bd: c.whats },
  };
  const t = tones[tone];
  return (
    <span className="font-body text-xs font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1"
      style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.bd + "55" }}>
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

// ---------------------------------------------------------------------------
// NOVO — Caixa de entrada WhatsApp
// ---------------------------------------------------------------------------
function WhatsAppInbox() {
  const [mensagens, setMensagens] = useState(MENSAGENS_INICIAL);
  const [conversaoAberta, setConversaoAberta] = useState(null); // id da mensagem sendo convertida
  const [itensConversao, setItensConversao] = useState([]);

  const colunas = [
    { key: "nao_atendido", label: "Não atendido", tone: "danger" },
    { key: "atendido", label: "Atendido", tone: "accent" },
    { key: "convertido", label: "Convertido em pedido", tone: "success" },
  ];

  function marcarAtendido(id) {
    setMensagens((prev) => prev.map((m) => (m.id === id ? { ...m, status: "atendido" } : m)));
  }
  function descartar(id) {
    setMensagens((prev) => prev.map((m) => (m.id === id ? { ...m, status: "descartado", observacoes: "Descartado manualmente" } : m)));
  }
  function abrirConversao(id) {
    setConversaoAberta(id);
    setItensConversao([]);
  }
  function alternarProdutoConversao(produto) {
    setItensConversao((prev) => {
      const existe = prev.find((i) => i.id === produto.id);
      if (existe) return prev.filter((i) => i.id !== produto.id);
      return [...prev, { ...produto, qtd: 1 }];
    });
  }
  function confirmarConversao() {
    const numero = Math.floor(400 + Math.random() * 100);
    setMensagens((prev) => prev.map((m) => (m.id === conversaoAberta ? { ...m, status: "convertido", pedidoNumero: numero } : m)));
    setConversaoAberta(null);
  }

  const naoAtendidos = mensagens.filter((m) => m.status === "nao_atendido").length;

  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold flex items-center gap-2" style={{ color: c.text }}>
            <MessageCircle size={22} style={{ color: c.whats }} /> WhatsApp
          </h1>
          <p className="font-body text-sm mt-1" style={{ color: c.muted }}>
            Mensagens copiadas do WhatsApp — triagem manual até conectar a API oficial
          </p>
        </div>
        {naoAtendidos > 0 && <Badge tone="danger">{naoAtendidos} pendente{naoAtendidos > 1 ? "s" : ""}</Badge>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {colunas.map((col) => {
          const itensColuna = mensagens.filter((m) => m.status === col.key);
          const toneColor = col.tone === "danger" ? c.danger : col.tone === "accent" ? c.accent : c.success;
          return (
            <div key={col.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: toneColor }} />
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide" style={{ color: c.muted }}>{col.label}</h2>
                <span className="font-mono text-xs" style={{ color: c.faint }}>{itensColuna.length}</span>
              </div>

              <div className="flex flex-col gap-3">
                {itensColuna.map((m) => (
                  <div key={m.id} className="rounded-lg p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-body text-sm font-semibold truncate" style={{ color: c.text }}>
                        {m.nome ?? "Sem nome salvo"}
                      </span>
                      <span className="font-mono text-xs shrink-0" style={{ color: c.faint }}>{m.recebidoEm}</span>
                    </div>
                    <p className="font-body text-xs flex items-center gap-1 mb-2" style={{ color: c.faint }}>
                      <Phone size={11} /> {m.telefone}
                    </p>
                    <p className="font-body text-sm mb-3" style={{ color: c.muted }}>{m.mensagem}</p>

                    {m.status === "convertido" && (
                      <div className="flex items-center gap-1.5 font-body text-xs font-medium" style={{ color: c.success }}>
                        <CheckCircle2 size={13} /> Virou o pedido #{m.pedidoNumero}
                      </div>
                    )}
                    {m.observacoes && m.status !== "convertido" && (
                      <p className="font-body text-xs italic" style={{ color: c.faint }}>{m.observacoes}</p>
                    )}

                    {m.status === "nao_atendido" && (
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => marcarAtendido(m.id)}
                          className="flex-1 font-body text-xs font-medium rounded-md py-2 flex items-center justify-center gap-1"
                          style={{ backgroundColor: c.accentSoft, color: c.accent }}>
                          <ArrowRight size={12} /> Atender
                        </button>
                        <button onClick={() => descartar(m.id)}
                          className="rounded-md py-2 px-2.5"
                          style={{ backgroundColor: c.panelAlt, border: `1px solid ${c.border}` }}>
                          <Ban size={13} style={{ color: c.faint }} />
                        </button>
                      </div>
                    )}
                    {m.status === "atendido" && (
                      <button onClick={() => abrirConversao(m.id)}
                        className="w-full font-body text-xs font-medium rounded-md py-2 flex items-center justify-center gap-1 mt-1"
                        style={{ backgroundColor: c.successSoft, color: c.success }}>
                        <ShoppingCart size={12} /> Converter em pedido
                      </button>
                    )}
                  </div>
                ))}
                {itensColuna.length === 0 && (
                  <div className="rounded-lg p-4 text-center font-body text-xs" style={{ color: c.faint, border: `1px dashed ${c.border}` }}>
                    Nada aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* modal simplificado de conversão */}
      {conversaoAberta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConversaoAberta(null)} />
          <div className="relative w-full max-w-sm rounded-xl p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
            <h3 className="font-display text-lg font-semibold mb-1" style={{ color: c.text }}>Montar pedido</h3>
            <p className="font-body text-xs mb-4" style={{ color: c.muted }}>
              Selecione os produtos combinados na conversa
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {PRODUTOS_RAPIDOS.map((p) => {
                const marcado = itensConversao.some((i) => i.id === p.id);
                return (
                  <button key={p.id} onClick={() => alternarProdutoConversao(p)}
                    className="flex items-center justify-between rounded-lg p-3 text-left"
                    style={{
                      backgroundColor: marcado ? c.accentSoft : c.panelAlt,
                      border: `1px solid ${marcado ? c.accent + "55" : c.border}`,
                    }}>
                    <span className="font-body text-sm" style={{ color: c.text }}>{p.nome}</span>
                    <span className="font-mono text-xs" style={{ color: c.muted }}>{money(p.preco)}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConversaoAberta(null)}
                className="flex-1 font-body text-sm font-medium rounded-lg py-2.5"
                style={{ backgroundColor: c.panelAlt, color: c.muted, border: `1px solid ${c.border}` }}>
                Cancelar
              </button>
              <button onClick={confirmarConversao} disabled={itensConversao.length === 0}
                className="flex-1 font-body text-sm font-medium rounded-lg py-2.5 disabled:opacity-40"
                style={{ backgroundColor: c.accent, color: "#1A1305" }}>
                Criar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demais módulos (versões enxutas, mesmo padrão das prévias anteriores)
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
        <KpiCard icon={MessageCircle} label="WhatsApp pendente" value="2" sub="mais antigo há 12 min" tone="danger" />
        <KpiCard icon={AlertTriangle} label="Alertas de estoque" value="2" tone="danger" />
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
    </div>
  );
}

function Pdv() {
  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-6">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>PDV</h1>
      <p className="font-body text-sm" style={{ color: c.muted }}>Mesmo PDV das prévias anteriores — sem mudanças aqui.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PRODUTOS_RAPIDOS.map((p) => (
          <div key={p.id} className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
            <div className="w-full aspect-[4/3] rounded-lg flex items-center justify-center" style={{ backgroundColor: c.panelAlt }}>
              <UtensilsCrossed size={20} style={{ color: c.faint }} />
            </div>
            <p className="font-body text-sm" style={{ color: c.text }}>{p.nome}</p>
            <p className="font-mono text-sm" style={{ color: c.accent }}>{money(p.preco)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mesas() {
  const [mesas, setMesas] = useState(MESAS_INICIAL);
  function ciclo(id) {
    setMesas((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      const ordem = ["livre", "ocupada", "aguardando"];
      const next = ordem[(ordem.indexOf(m.status) + 1) % ordem.length];
      return { ...m, status: next, pessoas: next === "livre" ? 0 : m.pessoas || 2 };
    }));
  }
  const info = { livre: c.success, ocupada: c.accent, aguardando: c.info };
  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-6">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>Mesas</h1>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {mesas.map((m) => (
          <button key={m.id} onClick={() => ciclo(m.id)} className="aspect-square rounded-xl flex items-center justify-center font-display text-lg font-semibold"
            style={{ backgroundColor: c.panel, border: `1.5px solid ${info[m.status]}55`, color: c.text }}>
            {m.id}
          </button>
        ))}
      </div>
    </div>
  );
}

function Cozinha() {
  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-6">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>Cozinha · KDS</h1>
      <div className="grid sm:grid-cols-3 gap-3">
        {KDS_INICIAL.map((p) => (
          <div key={p.id} className="rounded-lg p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
            <div className="flex justify-between mb-2">
              <span className="font-mono text-sm" style={{ color: c.accent }}>#{p.id}</span>
              <span className="font-mono text-xs flex items-center gap-1" style={{ color: c.muted }}><Clock size={11} /> {p.minutos} min</span>
            </div>
            <p className="font-body text-xs font-semibold mb-1" style={{ color: c.text }}>{p.mesa}</p>
            {p.itens.map((it, i) => <p key={i} className="font-body text-xs" style={{ color: c.muted }}>{it}</p>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Estoque() {
  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-6">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: c.text }}>Estoque</h1>
      {ESTOQUE.map((i) => (
        <div key={i.id} className="rounded-lg p-3 flex justify-between" style={{ backgroundColor: c.panel, border: `1px solid ${c.danger}55` }}>
          <span className="font-body text-sm" style={{ color: c.text }}>{i.nome}</span>
          <span className="font-mono text-sm" style={{ color: c.danger }}>{i.atual} {i.unidade}</span>
        </div>
      ))}
    </div>
  );
}

function EmBreve({ label }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24 text-center">
      <Lock size={26} style={{ color: c.faint }} />
      <h1 className="font-display text-xl font-semibold" style={{ color: c.text }}>{label}</h1>
      <p className="font-body text-sm max-w-xs" style={{ color: c.muted }}>Módulo previsto no roteiro completo.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
export default function App() {
  const [view, setView] = useState("whatsapp");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeItem = useMemo(() => NAV.find((n) => n.id === view), [view]);

  function go(id) { setView(id); setDrawerOpen(false); }
  function renderView() {
    switch (view) {
      case "dashboard": return <Dashboard />;
      case "whatsapp": return <WhatsAppInbox />;
      case "pdv": return <Pdv />;
      case "fichas": return <EmBreve label="Fichas Técnicas (ver prévia anterior)" />;
      case "mesas": return <Mesas />;
      case "cozinha": return <Cozinha />;
      case "estoque": return <Estoque />;
      default: return <EmBreve label={activeItem?.label ?? ""} />;
    }
  }
  const bottomTabs = [NAV[0], NAV[1], NAV[2], NAV[5], NAV[6]];

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
            const pendencia = item.id === "whatsapp";
            return (
              <button key={item.id} onClick={() => item.active && go(item.id)} disabled={!item.active}
                className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg transition-colors disabled:opacity-40 relative"
                style={{ backgroundColor: isActive ? c.accentSoft : "transparent", color: isActive ? c.accent : c.muted }}>
                <Icon size={18} className="shrink-0" />
                <span className="hidden lg:block font-body text-sm font-medium truncate">{item.label}</span>
                {pendencia && <span className="w-1.5 h-1.5 rounded-full absolute top-2 left-6 lg:hidden" style={{ backgroundColor: c.danger }} />}
                {pendencia && <span className="hidden lg:flex ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: c.dangerSoft, color: c.danger }}>2</span>}
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
                  <button key={item.id} onClick={() => item.active && go(item.id)} disabled={!item.active}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg disabled:opacity-40"
                    style={{ backgroundColor: isActive ? c.accentSoft : "transparent", color: isActive ? c.accent : c.muted }}>
                    <Icon size={18} />
                    <span className="font-body text-sm font-medium">{item.label}</span>
                    {item.id === "whatsapp" && <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: c.dangerSoft, color: c.danger }}>2</span>}
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
            <button key={item.id} onClick={() => go(item.id)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative" style={{ color: isActive ? c.accent : c.faint }}>
              <Icon size={19} />
              <span className="font-body text-[10px] font-medium">{item.label}</span>
              {item.id === "whatsapp" && <span className="absolute top-1.5 right-[30%] w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.danger }} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
