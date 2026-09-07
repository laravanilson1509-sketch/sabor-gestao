"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageCircle, Phone, Ban, Send, ShoppingCart, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getMensagensInbox,
  responderMensagem,
  descartarMensagem,
  converterEmPedido,
} from "@/lib/queries/whatsapp";
import { c } from "@/lib/theme";

type Mensagem = {
  id: string;
  unidade_id: string;
  telefone: string;
  nome_cliente: string | null;
  mensagem: string;
  status: "nao_atendido" | "atendido" | "convertido" | "descartado";
  observacoes: string | null;
  pedido_id: string | null;
  recebido_em: string;
};

type Produto = { id: string; nome: string; preco_venda: number };

const COLUNAS = [
  { key: "nao_atendido" as const, label: "Não atendido", tone: c.danger },
  { key: "atendido" as const, label: "Atendido", tone: c.accent },
  { key: "convertido" as const, label: "Convertido em pedido", tone: c.success },
];

export default function InboxBoard({ unidadeId }: { unidadeId: string }) {
  const supabase = createClient();

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // texto de resposta em edição, por mensagem
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);

  // conversão em pedido
  const [conversaoAberta, setConversaoAberta] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<Produto[]>([]);
  const [convertendo, setConvertendo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const data = await getMensagensInbox(supabase, unidadeId);
      setMensagens(data as Mensagem[]);
      setErro(null);
    } catch (e: any) {
      setErro(e.message ?? "Erro ao carregar mensagens");
    } finally {
      setCarregando(false);
    }
  }, [supabase, unidadeId]);

  // carga inicial + Realtime — qualquer INSERT/UPDATE na tabela desta unidade
  // recarrega o quadro sozinho (mensagem nova chegando do webhook aparece na hora)
  useEffect(() => {
    carregar();

    const canal = supabase
      .channel(`mensagens_whatsapp-${unidadeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mensagens_whatsapp",
          filter: `unidade_id=eq.${unidadeId}`,
        },
        () => carregar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar, supabase, unidadeId]);

  async function enviarResposta(m: Mensagem) {
    const texto = (respostas[m.id] ?? "").trim();
    if (!texto) return;
    setEnviando(m.id);
    try {
      await responderMensagem(supabase, { mensagemId: m.id, telefone: m.telefone, texto });
      setRespostas((prev) => ({ ...prev, [m.id]: "" }));
      // não precisa recarregar manualmente — o UPDATE na tabela dispara o Realtime acima
    } catch (e: any) {
      setErro(e.message ?? "Erro ao enviar resposta");
    } finally {
      setEnviando(null);
    }
  }

  async function descartar(id: string) {
    try {
      await descartarMensagem(supabase, id, "Descartado manualmente");
    } catch (e: any) {
      setErro(e.message ?? "Erro ao descartar");
    }
  }

  async function abrirConversao(id: string) {
    setConversaoAberta(id);
    setItensSelecionados([]);
    if (produtos.length === 0) {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda")
        .eq("unidade_id", unidadeId)
        .order("nome")
        .limit(100);
      if (!error && data) setProdutos(data as Produto[]);
    }
  }

  function alternarProduto(p: Produto) {
    setItensSelecionados((prev) =>
      prev.some((i) => i.id === p.id) ? prev.filter((i) => i.id !== p.id) : [...prev, p]
    );
  }

  async function confirmarConversao() {
    if (!conversaoAberta || itensSelecionados.length === 0) return;
    setConvertendo(true);
    try {
      await converterEmPedido(supabase, {
        mensagemId: conversaoAberta,
        unidadeId,
        itens: itensSelecionados.map((p) => ({
          produtoId: p.id,
          quantidade: 1,
          precoUnitario: p.preco_venda,
        })),
      });
      setConversaoAberta(null);
    } catch (e: any) {
      setErro(e.message ?? "Erro ao converter em pedido");
    } finally {
      setConvertendo(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-24 justify-center">
        <Loader2 size={18} className="animate-spin" style={{ color: c.faint }} />
        <span className="font-body text-sm" style={{ color: c.faint }}>Carregando mensagens...</span>
      </div>
    );
  }

  const naoAtendidos = mensagens.filter((m) => m.status === "nao_atendido").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold flex items-center gap-2" style={{ color: c.text }}>
            <MessageCircle size={22} style={{ color: c.whats }} /> WhatsApp
          </h1>
          <p className="font-body text-sm mt-1" style={{ color: c.muted }}>
            Responda direto por aqui — a mensagem sai pelo seu número Twilio
          </p>
        </div>
        {naoAtendidos > 0 && (
          <span
            className="font-body text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: c.dangerSoft, color: c.danger }}
          >
            {naoAtendidos} pendente{naoAtendidos > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {erro && (
        <div className="rounded-lg p-3 font-body text-sm" style={{ backgroundColor: c.dangerSoft, color: c.danger }}>
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {COLUNAS.map((col) => {
          const itensColuna = mensagens.filter((m) => m.status === col.key);
          return (
            <div key={col.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.tone }} />
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide" style={{ color: c.muted }}>
                  {col.label}
                </h2>
                <span className="font-mono text-xs" style={{ color: c.faint }}>{itensColuna.length}</span>
              </div>

              <div className="flex flex-col gap-3">
                {itensColuna.map((m) => (
                  <div key={m.id} className="rounded-lg p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-body text-sm font-semibold truncate" style={{ color: c.text }}>
                        {m.nome_cliente ?? "Sem nome salvo"}
                      </span>
                      <span className="font-mono text-xs shrink-0" style={{ color: c.faint }}>
                        {new Date(m.recebido_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="font-body text-xs flex items-center gap-1 mb-2" style={{ color: c.faint }}>
                      <Phone size={11} /> {m.telefone}
                    </p>
                    <p className="font-body text-sm mb-3" style={{ color: c.muted }}>{m.mensagem}</p>

                    {m.status === "convertido" && (
                      <div className="flex items-center gap-1.5 font-body text-xs font-medium" style={{ color: c.success }}>
                        <CheckCircle2 size={13} /> Virou um pedido
                      </div>
                    )}
                    {m.observacoes && m.status !== "convertido" && (
                      <p className="font-body text-xs italic mb-2" style={{ color: c.faint }}>{m.observacoes}</p>
                    )}

                    {m.status === "nao_atendido" && (
                      <div className="flex flex-col gap-2 mt-1">
                        <textarea
                          value={respostas[m.id] ?? ""}
                          onChange={(e) => setRespostas((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          placeholder="Digite a resposta..."
                          rows={2}
                          className="w-full font-body text-sm rounded-md p-2 outline-none resize-none"
                          style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => enviarResposta(m)}
                            disabled={enviando === m.id || !(respostas[m.id] ?? "").trim()}
                            className="flex-1 font-body text-xs font-medium rounded-md py-2 flex items-center justify-center gap-1 disabled:opacity-40"
                            style={{ backgroundColor: c.accentSoft, color: c.accent }}
                          >
                            {enviando === m.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            Enviar resposta
                          </button>
                          <button
                            onClick={() => descartar(m.id)}
                            className="rounded-md py-2 px-2.5"
                            style={{ backgroundColor: c.panelAlt, border: `1px solid ${c.border}` }}
                          >
                            <Ban size={13} style={{ color: c.faint }} />
                          </button>
                        </div>
                      </div>
                    )}

                    {m.status === "atendido" && (
                      <button
                        onClick={() => abrirConversao(m.id)}
                        className="w-full font-body text-xs font-medium rounded-md py-2 flex items-center justify-center gap-1 mt-1"
                        style={{ backgroundColor: c.successSoft, color: c.success }}
                      >
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

      {conversaoAberta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConversaoAberta(null)} />
          <div className="relative w-full max-w-sm rounded-xl p-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}` }}>
            <h3 className="font-display text-lg font-semibold mb-1" style={{ color: c.text }}>Montar pedido</h3>
            <p className="font-body text-xs mb-4" style={{ color: c.muted }}>
              Selecione os produtos combinados na conversa
            </p>
            <div className="flex flex-col gap-2 mb-4 max-h-64 overflow-y-auto">
              {produtos.map((p) => {
                const marcado = itensSelecionados.some((i) => i.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => alternarProduto(p)}
                    className="flex items-center justify-between rounded-lg p-3 text-left"
                    style={{
                      backgroundColor: marcado ? c.accentSoft : c.panelAlt,
                      border: `1px solid ${marcado ? c.accent + "55" : c.border}`,
                    }}
                  >
                    <span className="font-body text-sm" style={{ color: c.text }}>{p.nome}</span>
                    <span className="font-mono text-xs" style={{ color: c.muted }}>
                      {p.preco_venda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </button>
                );
              })}
              {produtos.length === 0 && (
                <p className="font-body text-xs text-center py-4" style={{ color: c.faint }}>Carregando produtos...</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConversaoAberta(null)}
                className="flex-1 font-body text-sm font-medium rounded-lg py-2.5"
                style={{ backgroundColor: c.panelAlt, color: c.muted, border: `1px solid ${c.border}` }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarConversao}
                disabled={itensSelecionados.length === 0 || convertendo}
                className="flex-1 font-body text-sm font-medium rounded-lg py-2.5 disabled:opacity-40 flex items-center justify-center gap-1"
                style={{ backgroundColor: c.accent, color: "#1A1305" }}
              >
                {convertendo && <Loader2 size={13} className="animate-spin" />}
                Criar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
