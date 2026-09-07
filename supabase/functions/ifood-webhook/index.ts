// supabase/functions/ifood-webhook/index.ts
//
// Recebe o webhook de novo pedido do iFood, registra o payload bruto em
// webhook_logs (auditoria) e cria o pedido correspondente no sistema —
// de forma idempotente: se o mesmo pedido do iFood chegar de novo
// (reenvio comum em webhooks), não duplica.
//
// Deploy: supabase functions deploy ifood-webhook
// Configure a URL resultante no painel de integrações do iFood.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// service_role key: necessária porque a função escreve em várias tabelas
// como um processo de sistema, ignorando RLS (o próprio schema não dá
// policy de insert de webhook para nenhum papel de usuário comum).
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const payload = await req.json();

  // 1. valida a assinatura do webhook (cada provedor tem seu próprio esquema —
  //    o iFood usa um header de assinatura HMAC; confira a doc do parceiro)
  const assinaturaValida = validarAssinatura(req, payload);
  if (!assinaturaValida) {
    return new Response("assinatura inválida", { status: 401 });
  }

  // 2. identifica a unidade a partir do merchant_id configurado em integracoes.config
  const { data: integracao } = await supabase
    .from("integracoes")
    .select("unidade_id, config")
    .eq("tipo", "ifood")
    .contains("config", { merchant_id: payload.merchantId })
    .single();

  if (!integracao) {
    return new Response("unidade não encontrada para este merchant_id", { status: 404 });
  }

  // 3. log de auditoria (sempre grava, mesmo que o processamento falhe depois)
  const { data: log } = await supabase
    .from("webhook_logs")
    .insert({
      unidade_id: integracao.unidade_id,
      tipo: "ifood",
      evento: payload.eventType ?? "pedido",
      payload,
    })
    .select()
    .single();

  try {
    if (payload.eventType !== "PLACED") {
      // outros eventos (cancelamento, confirmação) tratados à parte
      await marcarLogProcessado(log.id);
      return new Response("ok", { status: 200 });
    }

    // 4. idempotência: se esse pedido do iFood já existe, não recria
    const { data: existente } = await supabase
      .from("pedidos")
      .select("id")
      .eq("unidade_id", integracao.unidade_id)
      .eq("canal_externo_tipo", "ifood")
      .eq("canal_externo_id", payload.orderId)
      .maybeSingle();

    if (existente) {
      await marcarLogProcessado(log.id);
      return new Response("pedido já existente", { status: 200 });
    }

    // 5. resolve os produtos pelo código (SKU) — pedidos com item não mapeado
    //    ficam registrados no log de erro para conferência manual
    const itensResolvidos = [];
    for (const item of payload.items) {
      const { data: produto } = await supabase
        .from("produtos")
        .select("id, preco_venda")
        .eq("unidade_id", integracao.unidade_id)
        .eq("codigo", item.externalCode)
        .maybeSingle();

      if (!produto) {
        throw new Error(`Produto não mapeado: código ${item.externalCode}`);
      }
      itensResolvidos.push({
        produto_id: produto.id,
        quantidade: item.quantity,
        preco_unitario: item.unitPrice,
      });
    }

    // 6. cria o pedido, os itens e o registro de delivery numa chamada RPC
    //    transacional (evita pedido "pela metade" se algo falhar no meio)
    const { data: pedidoId, error } = await supabase.rpc("criar_pedido_delivery", {
      p_unidade_id: integracao.unidade_id,
      p_canal_externo_id: payload.orderId,
      p_canal_externo_tipo: "ifood",
      p_endereco_entrega: payload.delivery?.deliveryAddress?.formattedAddress ?? "",
      p_itens: itensResolvidos,
    });

    if (error) throw error;

    await marcarLogProcessado(log.id);
    return new Response(JSON.stringify({ pedido_id: pedidoId }), { status: 201 });
  } catch (err) {
    await supabase
      .from("webhook_logs")
      .update({ status: "erro", erro_detalhe: String(err) })
      .eq("id", log.id);
    return new Response(String(err), { status: 500 });
  }

  async function marcarLogProcessado(logId: string) {
    await supabase.from("webhook_logs").update({ status: "processado" }).eq("id", logId);
  }
});

function validarAssinatura(_req: Request, _payload: unknown): boolean {
  // TODO: implementar conforme a doc de segurança do iFood (HMAC do corpo
  // da requisição com o client_secret configurado em integracoes.config)
  return true;
}
