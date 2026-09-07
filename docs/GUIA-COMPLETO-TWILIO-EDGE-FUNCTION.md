# Setup completo — Twilio Sandbox + Edge Function Supabase (Zero custo)

## Fluxo final
```
Cliente envia msg WhatsApp
    ↓
Twilio Sandbox recebe
    ↓
Webhook POST → Supabase Edge Function
    ↓
Edge Function valida + grava em mensagens_whatsapp
    ↓
Aparece no quadro da tela React em tempo real
    ↓
Você marca como "atendido" → clica "converter em pedido"
    ↓
Pedido nasce no PDV com fila de cozinha
```

---

# PARTE 1 — TWILIO SANDBOX (10 min)

## 1.1 Criar conta Twilio

1. Acesse **twilio.com**
2. Clique em **"Sign Up"** (canto superior direito)
3. Preencha:
   - **Email:** seu email
   - **Senha:** qualquer uma
   - **Nome completo:** seu nome
4. Clique **"Create account"**
5. Vai chegar um email — clique no link de confirmação
6. Pronto, você tá logado no Console

Você já ganha **R$ 50 de crédito grátis** pra usar.

---

## 1.2 Ativar WhatsApp Sandbox

1. No Console, procure a seção **"Messaging"** (menu esquerdo)
2. Clique em **"Try it out"** → **"Send a WhatsApp message"**
3. Clique em **"Get Started"**

Vai abrir um wizard:
- Passo 1: "Connect WhatsApp Business Account" — deixe como padrão, clique "Next"
- Passo 2: Vai pedir pra escanear um QR code com seu WhatsApp pessoal
  - Abra WhatsApp no seu celular
  - Vá em Mais > Configurações > Conectados a apps
  - Escaneie o QR da tela do Twilio
  - Sua conta pessoal ficará linkada ao Sandbox

Depois que escanear:
- Vai receber uma mensagem de confirmação no WhatsApp
  - Responda **"join magic-word"** (exatamente como aparecer na mensagem)
- Pronto! Seu número agora recebe mensagens do Twilio Sandbox

---

## 1.3 Pegar as credenciais

Você precisa de 3 coisas:

### a) TWILIO_ACCOUNT_SID
1. No Console, vá para **"Account"** (menu esquerdo)
2. Procure **"Account SID"** — é uma string tipo `ACxxxxxxxxxxxxxx`
3. Copie (vou chamar de `SEU_ACCOUNT_SID`)

### b) TWILIO_AUTH_TOKEN
1. Na mesma página, logo abaixo do Account SID, tem **"Auth Token"**
   - Pode estar escondido (clique no ícone de olho)
2. Copie (vou chamar de `SEU_AUTH_TOKEN`)

### c) TWILIO_PHONE
1. Vá em **"Messaging"** → **"Services"** (ou procure "Phone Numbers")
2. Você deve ter um número tipo **+55xxxxxxxxxxxx** gerado automaticamente
3. Copie (vou chamar de `SEU_NUMERO_TWILIO`)

**Importante:** Guarde esses 3 valores em um arquivo `.txt` temporário, você vai precisar em 5 min.

---

# PARTE 2 — SUPABASE SETUP (5 min)

## 2.1 Confirmar que você tem um projeto Supabase

Se não tem:
1. Acesse **supabase.com**
2. Sign up com GitHub (ou email)
3. Clique em **"New project"**
4. Preencha nome e senha
5. Espera criar (~2 min)

Se já tem, só abra o projeto.

## 2.2 Pegar as URLs/credenciais do Supabase

1. Abra seu projeto Supabase
2. Vá em **"Project Settings"** (canto inferior esquerdo)
3. Abra a aba **"API"**
4. Copie:
   - **SUPABASE_URL** (tipo `https://seu-projeto.supabase.co`)
   - **SUPABASE_ANON_KEY** (chave pública, tipo `eyJhbGc...`)
   - **SUPABASE_SERVICE_ROLE_KEY** (chave privada, tipo `eyJhbGc...` mas mais longa)

Guarde também em um `.txt`.

---

# PARTE 3 — RODAR O SCHEMA WHATSAPP (3 min)

## 3.1 No Supabase, criar a tabela

1. Abra seu projeto Supabase
2. Vá em **"SQL Editor"** (menu esquerdo)
3. Clique em **"New query"**
4. Cole o conteúdo de **`schema-whatsapp-triagem.sql`** (o arquivo que mandei)
5. Clique em **"Run"** (play azul)

Pronto, a tabela `mensagens_whatsapp` foi criada.

---

# PARTE 4 — DEPLOY DA EDGE FUNCTION (10 min)

## 4.1 Instalar Supabase CLI

No seu terminal/cmd:

```bash
# No Mac/Linux:
brew install supabase

# No Windows:
# Baixe em: https://github.com/supabase/cli/releases (escolha a versão Windows)
# Ou use PowerShell:
iwr https://api.github.com/repos/supabase/cli/releases/latest | select -ExpandProperty Content | ConvertFrom-Json | select -ExpandProperty assets | where name -like "*windows*" | select browser_download_url
```

Verifique se instalou:
```bash
supabase --version
```

## 4.2 Autenticar no Supabase

```bash
supabase login
```

Vai abrir uma página no navegador pedindo pra confirmar. Clique em "Confirm".

## 4.3 Criar a pasta da Edge Function

```bash
# No terminal, em qualquer pasta:
mkdir -p supabase/functions/twilio-webhook

cd supabase/functions/twilio-webhook
```

## 4.4 Copiar o código da Edge Function

Crie um arquivo chamado `index.ts`:

```bash
# Mac/Linux:
touch index.ts

# Windows (no PowerShell):
New-Item -Name "index.ts" -ItemType File
```

Abra o arquivo `index.ts` com um editor (VSCode, Notepad++, qualquer um) e **cole o conteúdo completo de `edge-functions/twilio-webhook.ts`** (o arquivo que mandei).

Salve.

## 4.5 Deploy

De volta no terminal, na pasta `supabase/functions/twilio-webhook/`, rode:

```bash
supabase functions deploy twilio-webhook --project-id SEU-PROJECT-ID
```

Onde `SEU-PROJECT-ID` é o ID do seu projeto Supabase. Você acha em:
- Supabase > Project Settings > General > Project ID

Exemplo:
```bash
supabase functions deploy twilio-webhook --project-id abc123def456
```

Se tudo deu certo, vai aparecer:
```
✓ Deployed successfully: https://seu-projeto.supabase.co/functions/v1/twilio-webhook
```

**Guarde essa URL**, você vai usar em 2 minutos.

## 4.6 Configurar variáveis de ambiente da Edge Function

```bash
supabase secrets set --project-id SEU-PROJECT-ID \
  TWILIO_AUTH_TOKEN="SEU_AUTH_TOKEN" \
  TWILIO_PHONE="SEU_NUMERO_TWILIO"
```

Substitua pelos valores que você guardou na PARTE 1.

Exemplo:
```bash
supabase secrets set --project-id abc123def456 \
  TWILIO_AUTH_TOKEN="8f1234567890abcdef1234567890abcd" \
  TWILIO_PHONE="+554499999999"
```

---

# PARTE 5 — CONFIGURAR TWILIO PRA CHAMAR A EDGE FUNCTION (2 min)

## 5.1 Pegar a URL do webhook

Você já tem:
```
https://seu-projeto.supabase.co/functions/v1/twilio-webhook
```

Copie essa URL (vou chamar de `SEU_WEBHOOK_URL`).

## 5.2 Configurar em Twilio

1. No Console Twilio, vá em **"Messaging"** → **"Settings"** → **"WhatsApp"**
2. Procure a seção **"Sandbox Settings"**
3. Tem um campo chamado **"When a message comes in"** (tipo de uma URL)
4. Clique nele e cole: `SEU_WEBHOOK_URL`
5. Clique em **"Save"**

Pronto! Agora toda mensagem que chegar vai ser enviada pro seu webhook.

---

# PARTE 6 — TESTAR TUDO (5 min)

## 6.1 Do seu celular

1. Abra WhatsApp
2. Procure o contato "Twilio Sandbox"
3. Envie uma mensagem qualquer, tipo **"teste"**

## 6.2 Verificar que foi gravado

1. Abra seu Supabase
2. Vá em **"Table Editor"** (menu esquerdo)
3. Procure a tabela **"mensagens_whatsapp"**
4. Deve ter um novo registro com sua mensagem

## 6.3 Verificar a resposta automática

1. De volta no WhatsApp, você deve receber uma mensagem do Twilio:
   ```
   "Recebemos sua mensagem! Um atendente vai responder em breve 👋"
   ```

Se chegou até aqui, **está tudo funcionando!** 🎉

---

# PARTE 7 — CONECTAR A TELA REACT (5 min)

## 7.1 Copiar as queries

Você vai usar as funções em `lib/queries/whatsapp.ts`. Se já tem o projeto Next.js:

1. Copie o arquivo `lib/queries/whatsapp.ts` pra sua pasta do projeto
2. Instale a dependência Supabase (se não tiver):
   ```bash
   npm install @supabase/supabase-js
   ```

## 7.2 Atualizar .env.local

Adicione no seu `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

## 7.3 Usar a prévia na tela React

Se quiser usar a prévia que mandei (`preview-whatsapp-inbox.jsx`):

1. Copie pra uma rota tipo `/app/whatsapp/page.jsx` (ou ajusta pro seu setup)
2. Troque os dados mockados pelas queries reais:

```javascript
import { getMensagensPorStatus } from "@/lib/queries/whatsapp";
import { useEffect, useState } from "react";

export default function WhatsAppPage() {
  const [mensagensNaoAtendidas, setMensagensNaoAtendidas] = useState([]);
  
  useEffect(() => {
    getMensagensPorStatus(supabase, unidadeId, "nao_atendido")
      .then(setMensagensNaoAtendidas)
      .catch(console.error);
  }, []);
  
  // ... resto do código
}
```

---

# TROUBLESHOOTING

## "Não recebi a confirmação de 'join' no WhatsApp"

- Verifique se o QR code foi escaneado corretamente
- Tente novamente: abra WhatsApp > Mais > Configurações > Conectados a apps > Remova a conexão Twilio > Escaneie o QR novamente

## "Mensagem não apareceu no Supabase"

- Verifique se a Edge Function foi deployada:
  ```bash
  supabase functions list --project-id SEU-PROJECT-ID
  ```
  Deve aparecer `twilio-webhook`

- Verifique se as secrets foram setadas:
  ```bash
  supabase secrets list --project-id SEU-PROJECT-ID
  ```
  Deve aparecer `TWILIO_AUTH_TOKEN` e `TWILIO_PHONE`

- Veja os logs da Edge Function:
  ```bash
  supabase functions logs twilio-webhook --project-id SEU-PROJECT-ID
  ```

## "Erro ao deployar a Edge Function"

- Verifique se tem Supabase CLI instalada:
  ```bash
  supabase --version
  ```

- Verifique se tá na pasta correta:
  ```bash
  ls index.ts  # deve existir
  ```

- Verifique o PROJECT_ID:
  ```bash
  supabase projects list
  ```

---

# RESUMO DAS URLS/CREDENCIAIS (preencha aqui)

Salve em um documento:

```
=== TWILIO ===
Account SID: ________________
Auth Token: ________________
Phone (Sandbox): ________________

=== SUPABASE ===
Project ID: ________________
URL: ________________
Anon Key: ________________
Service Role Key: ________________
Webhook URL: https://seu-projeto.supabase.co/functions/v1/twilio-webhook

=== STATUS ===
[ ] Schema WhatsApp rodado
[ ] Edge Function deployada
[ ] Secrets setadas no Supabase
[ ] Webhook configurado em Twilio
[ ] Teste enviado e recebido
[ ] Resposta automática funcionou
```

---

# PRÓXIMOS PASSOS (depois que tudo funcionar)

1. **Responder manualmente** — alguém clica em "Atender" e envia mensagem pro cliente
2. **Converter em pedido** — clica "Converter" e o pedido nasce no PDV
3. **Notificar cliente** — quando pedido fica pronto, envia aviso automático

Quer que eu monte essas funcionalidades depois que confirmar que tá tudo rodando?
