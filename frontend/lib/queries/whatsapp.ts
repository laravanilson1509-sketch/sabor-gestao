// lib/queries/whatsapp.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMensagensPorStatus(
  supabase: SupabaseClient,
  unidadeId: string,
  status: "nao_atendido" | "atendido" | "convertido" | "descartado"
) {
  const { data, error } = await supabase
    .from("mensagens_whatsapp")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("status", status)
    .order("recebido_em", { ascending: true });

  if (error) throw error;
  return data;
}

// busca tudo de uma vez (exceto descartadas) pra montar o quadro completo —
// mais simples que 3 chamadas separadas, e o componente agrupa por status
export async function getMensagensInbox(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("mensagens_whatsapp")
    .select("*")
    .eq("unidade_id", unidadeId)
    .neq("status", "descartado")
    .order("recebido_em", { ascending: false });

  if (error) throw error;
  return data;
}

// responde direto pelo app: envia via Twilio (reaproveita a Edge Function
// twilio-resposta) e já marca a mensagem como atendida com o texto enviado
export async function responderMensagem(
  supabase: SupabaseClient,
  params: { mensagemId: string; telefone: string; texto: string }
) {
  const { error: erroEnvio } = await supabase.functions.invoke("twilio-resposta", {
    body: { phone: params.telefone, message: params.texto },
  });
  if (erroEnvio) throw erroEnvio;

  const { error: erroUpdate } = await supabase
    .from("mensagens_whatsapp")
    .update({ status: "atendido", observacoes: `Resposta enviada: "${params.texto}"` })
    .eq("id", params.mensagemId);
  if (erroUpdate) throw erroUpdate;
}

export async function getPendencias(supabase: SupabaseClient, unidadeId: string) {
  const { data, error } = await supabase
    .from("vw_whatsapp_pendencias")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// registro manual de uma mensagem recebida (copiar/colar do WhatsApp, por ora)
export async function registrarMensagem(
  supabase: SupabaseClient,
  params: { unidadeId: string; telefone: string; nomeCliente?: string; mensagem: string }
) {
  const { data, error } = await supabase
    .from("mensagens_whatsapp")
    .insert({
      unidade_id: params.unidadeId,
      telefone: params.telefone,
      nome_cliente: params.nomeCliente ?? null,
      mensagem: params.mensagem,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function marcarAtendido(supabase: SupabaseClient, mensagemId: string, observacoes?: string) {
  const { error } = await supabase
    .from("mensagens_whatsapp")
    .update({ status: "atendido", observacoes: observacoes ?? null })
    .eq("id", mensagemId);

  if (error) throw error;
}

export async function descartarMensagem(supabase: SupabaseClient, mensagemId: string, motivo?: string) {
  const { error } = await supabase
    .from("mensagens_whatsapp")
    .update({ status: "descartado", observacoes: motivo ?? null })
    .eq("id", mensagemId);

  if (error) throw error;
}

// converte a mensagem num pedido de verdade: cria o pedido (canal delivery,
// já 'confirmado' pra ir direto pra fila da cozinha) e vincula a mensagem
export async function converterEmPedido(
  supabase: SupabaseClient,
  params: {
    mensagemId: string;
    unidadeId: string;
    itens: { produtoId: string; quantidade: number; precoUnitario: number }[];
  }
) {
  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos")
    .insert({ unidade_id: params.unidadeId, canal: "delivery", status: "confirmado" })
    .select()
    .single();
  if (erroPedido) throw erroPedido;

  const { error: erroItens } = await supabase.from("pedido_itens").insert(
    params.itens.map((i) => ({
      pedido_id: pedido.id,
      produto_id: i.produtoId,
      quantidade: i.quantidade,
      preco_unitario: i.precoUnitario,
    }))
  );
  if (erroItens) throw erroItens;

  const { error: erroMensagem } = await supabase
    .from("mensagens_whatsapp")
    .update({ status: "convertido", pedido_id: pedido.id })
    .eq("id", params.mensagemId);
  if (erroMensagem) throw erroMensagem;

  return pedido;
}
