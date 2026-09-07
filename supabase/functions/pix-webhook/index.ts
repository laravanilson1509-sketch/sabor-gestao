// supabase/functions/pix-webhook/index.ts
//
// Recebe a confirmação de pagamento do provedor PIX (PSP — ex.: Mercado Pago,
// PagSeguro, Efí) e marca o pagamento como pago. O trigger trg_pagamentos_pix_bu
// já quita a conta a receber correspondente automaticamente.
//
// Deploy: supabase functions deploy pix-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const payload = await req.json();

  const assinaturaValida = validarAssinaturaPsp(req, payload);
  if (!assinaturaValida) {
    return new Response("assinatura inválida", { status: 401 });
  }

  const { data: log } = await supabase
    .from("webhook_logs")
    .insert({ tipo: "pix", evento: payload.status, payload })
    .select()
    .single();

  try {
    // cada PSP nomeia os campos de um jeito — ajuste conforme o provedor escolhido
    const txid: string = payload.txid ?? payload.transaction_id;
    const statusPago = ["CONCLUIDA", "paid", "approved"].includes(payload.status);

    if (!statusPago) {
      await supabase.from("webhook_logs").update({ status: "processado" }).eq("id", log.id);
      return new Response("evento ignorado (não é confirmação de pagamento)", { status: 200 });
    }

    const { error } = await supabase
      .from("pagamentos_pix")
      .update({ status: "pago" })
      .eq("txid", txid);

    if (error) throw error;

    await supabase.from("webhook_logs").update({ status: "processado" }).eq("id", log.id);
    return new Response("ok", { status: 200 });
  } catch (err) {
    await supabase
      .from("webhook_logs")
      .update({ status: "erro", erro_detalhe: String(err) })
      .eq("id", log.id);
    return new Response(String(err), { status: 500 });
  }
});

function validarAssinaturaPsp(_req: Request, _payload: unknown): boolean {
  // TODO: cada PSP tem seu próprio esquema de assinatura (ex.: header
  // X-Signature no Mercado Pago) — implemente conforme o provedor escolhido
  return true;
}
