# Payloads — Twilio → n8n → Supabase

## 1. Webhook POST do Twilio pro n8n

Quando um cliente envia uma mensagem, Twilio faz um POST assim pra URL do webhook n8n:

```http
POST https://xxxx.n8n.cloud/webhook/seu-webhook-id HTTP/1.1
Content-Type: application/x-www-form-urlencoded

MessageSid=SMxxxxxxxxxxxxxxxxxxxx
&AccountSid=ACxxxxxxxxxxxxxxxxxxxxxxxx
&MessagingServiceSid=MGxxxxxxxxxxxxxxxxxxxxxxxx
&From=%2B5544998812233
&To=%2B55449999999999
&Body=Oi%2C+queria+fazer+um+pedido
&NumMedia=0
```

**Parsed (o que n8n vê):**
```json
{
  "MessageSid": "SMxxxxxxxxxxxxxxxxxxxx",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxx",
  "From": "+5544998812233",
  "To": "+55449999999999",
  "Body": "Oi, queria fazer um pedido",
  "NumMedia": "0"
}
```

---

## 2. O que n8n extrai (nó "Parse - Extrai dados")

```json
{
  "telefone": "+5544998812233",
  "mensagem": "Oi, queria fazer um pedido",
  "unidade_id": "2d7ce1e8-4a2e-4c59-a9ba-1234567890ab"
}
```

---

## 3. POST que n8n envia pro Supabase (REST API)

```http
POST https://meurestaurante.supabase.co/rest/v1/mensagens_whatsapp HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Prefer: return=representation

{
  "unidade_id": "2d7ce1e8-4a2e-4c59-a9ba-1234567890ab",
  "telefone": "+5544998812233",
  "nome_cliente": null,
  "mensagem": "Oi, queria fazer um pedido",
  "status": "nao_atendido"
}
```

**Response do Supabase:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "unidade_id": "2d7ce1e8-4a2e-4c59-a9ba-1234567890ab",
    "telefone": "+5544998812233",
    "nome_cliente": null,
    "mensagem": "Oi, queria fazer um pedido",
    "status": "nao_atendido",
    "atendido_por": null,
    "atendido_em": null,
    "pedido_id": null,
    "observacoes": null,
    "recebido_em": "2024-08-29T20:41:32.123456+00:00"
  }
]
```

---

## 4. POST que n8n envia pra Edge Function (resposta automática)

```http
POST https://meurestaurante.supabase.co/functions/v1/twilio-resposta HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "phone": "+5544998812233",
  "message": "Recebemos sua mensagem! Um atendente vai responder em breve 👋"
}
```

**Response da Edge Function:**
```json
{
  "ok": true,
  "messageSid": "SMxxxxxxxxx"
}
```

---

## 5. Twilio recebe a resposta e envia de volta pro cliente

Twilio faz outro POST pro webhook do n8n (pra registrar que foi entregue), mas dessa vez com:

```json
{
  "MessageSid": "SMxxxxxxxxx",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxx",
  "From": "+55449999999999",
  "To": "+5544998812233",
  "Body": "Recebemos sua mensagem! Um atendente vai responder em breve 👋",
  "MessageStatus": "sent"
}
```

O n8n pode ignorar essas (ou logar pra auditoria).

---

## 6. Cliente recebe a mensagem

```
Cliente vê no WhatsApp:
┌─────────────────────────────────┐
│ Sabor Gestão                    │
│ Recebemos sua mensagem! Um      │
│ atendente vai responder em      │
│ breve 👋                         │
│ 20:41 ✓✓                        │
└─────────────────────────────────┘
```

---

## Fluxo completo em um diagrama

```
[Cliente WhatsApp]
      ↓ envia msg
[Twilio recebe]
      ↓ webhook POST
[n8n Parse]
      ↓ extrai dados
[n8n HTTP Insert]
      ↓ POST /rest/v1/mensagens_whatsapp
[Supabase] ✅ grava em mensagens_whatsapp
      ↓ resposta com dados
[n8n HTTP Resposta]
      ↓ POST /functions/v1/twilio-resposta
[Edge Function]
      ↓ envia via Twilio API
[Twilio]
      ↓ envia msg ao cliente
[Cliente WhatsApp] ✅ recebe resposta automática
      ↓ 
[Supabase Realtime]
      ↓ notifica subscribers
[App React] ✅ atualiza quadro de mensagens
```

---

## Exemplo: atendente responde manualmente

(Pra depois, quando você quiser que a resposta não seja automática)

Quando alguém clica em "Responder" na tela React:

```javascript
// frontend/lib/queries/whatsapp.ts
export async function responderMensagem(
  supabase: SupabaseClient,
  mensagemId: string,
  texto: string
) {
  // chama uma RPC function do Supabase
  const { error } = await supabase.rpc("responder_whatsapp", {
    p_mensagem_id: mensagemId,
    p_texto: texto,
  });
  if (error) throw error;
}
```

A RPC function no Supabase:
```sql
create or replace function public.responder_whatsapp(
  p_mensagem_id uuid,
  p_texto text
) returns void language plpgsql as $$
begin
  -- 1. marca a mensagem como atendida
  update mensagens_whatsapp
  set status = 'atendido', atendido_por = auth.uid(), atendido_em = now()
  where id = p_mensagem_id;

  -- 2. chama a Edge Function pra enviar via Twilio
  select http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/twilio-resposta',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_jwt_secret'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'phone', (select telefone from mensagens_whatsapp where id = p_mensagem_id),
      'message', p_texto
    )
  );
end;
$$;
```

Assim a resposta sai "como se fosse" do seu número no Twilio, não do cliente.

