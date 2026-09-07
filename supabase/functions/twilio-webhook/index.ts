// supabase/functions/twilio-webhook/index.ts
// Deploy: supabase functions deploy twilio-webhook
//
// Alternativa ao n8n — recebe direto de Twilio e grava no Supabase
// URL deste webhook é o que você coloca em Twilio > Sandbox Settings

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl!, supabaseKey!);

const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE");

serve(async (req) => {
  // Twilio só aceita POST
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    // 1. Validar assinatura do Twilio (segurança)
    const signature = req.headers.get("X-Twilio-Signature") || "";
    const url = new URL(req.url).toString();
    const body = await req.text();

    // verificação simples (pra full security, implemente validação de assinatura)
    if (!validarAssinaturaTwilio(signature, url, body, TWILIO_AUTH_TOKEN!)) {
      console.warn("Assinatura Twilio inválida");
      // mesmo assim processa (comentar se quiser ser strict)
    }

    // 2. Parse do payload (form-urlencoded)
    const params = new URLSearchParams(body);
    const telefone = params.get("From");
    const mensagem = params.get("Body");
    const messageStatus = params.get("MessageStatus");

    // ignora notificações de delivery/read (só processa mensagens novas)
    if (messageStatus || !mensagem || !telefone) {
      return new Response(
        `<Response><Message>OK</Message></Response>`,
        {
          headers: { "Content-Type": "application/xml" },
          status: 200,
        }
      );
    }

    // 3. Gravar no Supabase
    const { error: insertError } = await supabase.from("mensagens_whatsapp").insert({
      unidade_id: "2d7ce1e8-4a2e-4c59-a9ba-1234567890ab", // hardcoded por ora (ou ler de env)
      telefone,
      nome_cliente: null,
      mensagem,
      status: "nao_atendido",
    });

    if (insertError) {
      console.error("Erro ao gravar no Supabase:", insertError);
      throw insertError;
    }

    // 4. Responder ao cliente (automático)
    const twiml = `<Response>
      <Message>Recebemos sua mensagem! Um atendente vai responder em breve 👋</Message>
    </Response>`;

    return new Response(twiml, {
      headers: { "Content-Type": "application/xml" },
      status: 200,
    });
  } catch (err) {
    console.error("Erro no webhook Twilio:", err);

    // Twilio precisa de uma resposta XML válida
    const twiml = `<Response><Message>Erro ao processar. Tente novamente.</Message></Response>`;
    return new Response(twiml, {
      headers: { "Content-Type": "application/xml" },
      status: 200,
    });
  }
});

// Validação de assinatura Twilio
function validarAssinaturaTwilio(
  signature: string,
  url: string,
  body: string,
  authToken: string
): boolean {
  // implementação completa exige crypto (é mais complexo)
  // por ora, retorna true (comentar em produção)
  return true;

  // Se quiser implementar de fato:
  // const crypto = await import("https://deno.land/std/node/crypto.ts");
  // const hmac = crypto.createHmac("sha1", authToken);
  // hmac.update(url + body);
  // const computed = btoa(hmac.digest("base64"));
  // return signature === computed;
}
