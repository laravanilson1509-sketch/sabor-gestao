# WhatsApp via Twilio + n8n + Supabase — Guia Completo

## Fluxo resumido
```
Cliente envia msg no WhatsApp
    ↓
Twilio recebe
    ↓
Twilio envia webhook pro n8n
    ↓
n8n valida + grava no Supabase
    ↓
n8n chama Edge Function do Supabase
    ↓
Supabase envia resposta automática via Twilio
    ↓
Msg aparece na tela da sua app em tempo real
```

---

## PASSO 1 — Configurar Twilio

### 1.1 Criar conta
- Acesse `twilio.com`
- Sign up (cartão de crédito obrigatório)
- Você ganha R$50 de crédito inicial (rende ~250 mensagens)

### 1.2 Ativar WhatsApp no Twilio
- Vá em `Console > Messaging > Settings > WhatsApp`
- Clique em "Get Started"
- Siga o wizard (vincula sua conta pessoal de WhatsApp)
- Você receberá:
  - **TWILIO_ACCOUNT_SID** (copie e guarde)
  - **TWILIO_AUTH_TOKEN** (copie e guarde)
  - **TWILIO_PHONE** (número temporário tipo +55999999999, usado pra testar)

### 1.3 Configurar Webhook
- Ainda em `Console > Messaging > Settings > WhatsApp > Sandbox Settings`
- Procure "When a message comes in"
- Cole a URL do seu webhook n8n (vira algo como `https://xxxx.n8n.cloud/webhook/seuid`)
- Salve

---

## PASSO 2 — Configurar n8n

### 2.1 Criar conta
- `n8n.cloud` (free tier dá 1.000 execuções/mês)
- Sign up / login

### 2.2 Importar o workflow
1. Clique em "New Workflow"
2. Menu (3 pontos) → "Import from JSON"
3. Cole o conteúdo de `n8n-workflow-twilio-supabase.json`
4. Clique "Import"

### 2.3 Configurar credenciais
No workflow importado, você vai ter nós que parecem "em branco" ou com aviso vermelho — precisa preencher:

#### Nó "HTTP - Grava no Supabase"
- Clique nele
- Em "URL", substitua `SEU-PROJETO` pela slug do seu Supabase (ex: `meurestaurante-abc123`)
- Em "Headers" > "Authorization", substitua `SEU-ANON-KEY-SUPABASE` pela sua chave anon do Supabase
  - Onde pegar: `Supabase > Project Settings > API > anon key`

#### Nó "HTTP - Envia confirmação"
- Mesma coisa (URL e Authorization)

### 2.4 Copiar URL do webhook
- Clique no nó "Webhook - Recebe Twilio"
- Abaixo, vai ter um botão azul "Copy Webhook URL"
- Guarde essa URL

### 2.5 Testar localmente (opcional)
- Clique em "Test Workflow"
- Ele vai esperar uma requisição POST

---

## PASSO 3 — Vincular Twilio → n8n

De volta ao Twilio:
1. `Console > Messaging > Settings > WhatsApp > Sandbox Settings`
2. "When a message comes in" → cole a URL do webhook n8n (da 2.4)
3. Salve

---

## PASSO 4 — Deploy da Edge Function (resposta automática)

No seu terminal, com Supabase CLI instalado:

```bash
# se não tem, instale primeiro:
npm install -g supabase

# autentique
supabase login

# deploya função
supabase functions deploy twilio-resposta \
  --project-id SEU-PROJECT-ID

# configure as variáveis de ambiente
supabase secrets set --project-id SEU-PROJECT-ID \
  TWILIO_ACCOUNT_SID="ac1234567890abcdef" \
  TWILIO_AUTH_TOKEN="token_aqui" \
  TWILIO_PHONE="+55449999999999"
```

Você encontra os valores em `Twilio > Console > Account > API Keys`.

---

## PASSO 5 — Testar tudo

### 5.1 Do seu celular (usando a conta do Twilio)
- Abra WhatsApp
- Procure o contato "Twilio Sandbox"
- Envie uma mensagem (ex: "teste")

### 5.2 Verificar
- Abra seu dashboard do Supabase
- Vá em `SQL Editor > mensagens_whatsapp`
- Procure pela sua mensagem (deve estar lá como "não_atendido")
- Você recebeu uma resposta automática no WhatsApp? ✅ Tudo funcionando!

### 5.3 Na sua app
- Abra a tela de WhatsApp da prévia
- Se o Realtime estiver ativo, a mensagem aparece em tempo real no quadro

---

## PASSO 6 — Colocar em produção

### 6.1 Migrar de Sandbox pra numero real
- Twilio sandbox é só pra testes, e seu cliente precisa primeiro enviar "join" pra ativar
- Pra produção, você precisa:
  1. Validar seu negócio no Meta (aprox. 2-5 dias)
  2. Comprar um número real na Twilio (R$ 20-50/mês)
  3. Trocar o `TWILIO_PHONE` na Edge Function

---

## TROUBLESHOOTING

### "Webhook não recebe nada"
- Verifique se a URL do n8n está certa (copiar/colar sem typos)
- Teste o webhook do n8n em modo "Testing" (botão no topo do workflow)

### "Erro ao gravar no Supabase"
- A chave anon está correta?
- A tabela `mensagens_whatsapp` existe e tem RLS ativado?
- Você tem uma policy de insert? (checá `SQL Editor > Policies`)

### "Resposta automática não chega"
- A Edge Function foi deployada? (`supabase functions list`)
- As variáveis de ambiente estão setadas? (`supabase secrets list`)
- O `TWILIO_PHONE` corresponde ao número que você usa?

### Custos
- Twilio: ~R$ 0,20 por mensagem (entrada + saída)
- n8n: Free tier OK pra começar, depois é por volume
- Supabase: Free tier sempre (até chegar em limites generosos)

---

## Resumo das credenciais que você vai precisar

| Plataforma | O que usar | Onde achar |
|-----------|-----------|-----------|
| Twilio | ACCOUNT_SID | Console > Account Settings |
| Twilio | AUTH_TOKEN | Console > Account Settings |
| Twilio | PHONE | Console > Messaging > Phone Numbers |
| Supabase | URL da API | Project Settings > API > URL |
| Supabase | ANON_KEY | Project Settings > API > anon key |
| Supabase | PROJECT_ID | Project Settings > General > Project ID |
| n8n | Webhook URL | Clique no nó Webhook > Copy |

---

## Próximos passos (depois de tudo funcionando)

1. **Responder manualmente**: alguém clica em "Atender" na tela — envia uma resposta via Twilio
   - Precisa de outra Edge Function (`twilio-enviar-manual.ts`)

2. **Enviar lista de produtos no WhatsApp**: quando cliente pede cardápio, n8n manda uma imagem do menu
   - Requer n8n com nó "Supabase" pra buscar produtos + formatar

3. **Atualizar status de pedido via WhatsApp**: cliente recebe "pedido preparado!" automaticamente
   - Trigger: pedido muda pro status "pronto" → n8n notifica via Twilio

