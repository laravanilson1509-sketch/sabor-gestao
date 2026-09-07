// supabase/functions/twilio-resposta/index.ts
// Deploy: supabase functions deploy twilio-resposta

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE"); // número do Twilio (ex: +5544998765432)

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Só POST" }), { status: 405 });
  }

  try {
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone e message são obrigatórios" }), { status: 400 });
    }

    // monta o request pro Twilio
    const params = new URLSearchParams({
      From: TWILIO_PHONE!,
      To: phone,
      Body: message,
    });

    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Twilio:", data);
      return new Response(JSON.stringify({ error: "Twilio error", details: data }), { status: 400 });
    }

    return new Response(JSON.stringify({ ok: true, messageSid: data.sid }), { status: 200 });
  } catch (err) {
    console.error("Erro ao enviar resposta:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
