# ✅ CHECKLIST EXECUTIVO — Twilio Sandbox + Edge Function

**Tempo total estimado: 40 minutos**

---

## FASE 1 — TWILIO (10 min)

- [ ] **Passo 1:** Acesse twilio.com
- [ ] **Passo 2:** Sign up (email + senha + nome completo)
- [ ] **Passo 3:** Confirme email (link no email)
- [ ] **Passo 4:** Vá em "Messaging" > "Try it out" > "Send WhatsApp"
- [ ] **Passo 5:** Clique "Get Started" e siga o wizard do QR code
- [ ] **Passo 6:** No seu celular, escaneie o QR code com WhatsApp > Configurações > Conectados a apps
- [ ] **Passo 7:** Responda "join magic-word" na mensagem que receber
- [ ] **Passo 8:** Copie **Account SID** (Settings > Account Settings)
- [ ] **Passo 9:** Copie **Auth Token** (mesmo lugar, clique no olho se tiver escondido)
- [ ] **Passo 10:** Copie **Phone Number** (tipo +55xxxxxxxxxxxx)

**Salve esses 3 valores em um arquivo .txt:**
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=8f...
TWILIO_PHONE=+55...
```

---

## FASE 2 — SUPABASE PREP (5 min)

- [ ] **Passo 1:** Abra supabase.com e log in (ou crie um projeto novo)
- [ ] **Passo 2:** Vá em "Project Settings" > "API"
- [ ] **Passo 3:** Copie a URL (tipo https://seu-projeto.supabase.co)
- [ ] **Passo 4:** Copie ANON_KEY (chave pública)
- [ ] **Passo 5:** Copie SERVICE_ROLE_KEY (chave privada)

**Salve também:**
```
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_PROJECT_ID=abc123def456
```

---

## FASE 3 — RODAR SCHEMA WHATSAPP (3 min)

- [ ] **Passo 1:** No Supabase, vá em "SQL Editor"
- [ ] **Passo 2:** Clique "New query"
- [ ] **Passo 3:** Cole o conteúdo de **`schema-whatsapp-triagem.sql`**
- [ ] **Passo 4:** Clique "Run" (play azul)
- [ ] **Passo 5:** Confirme que apareceu a tabela em "Table Editor" > "mensagens_whatsapp"

---

## FASE 4 — INSTALAR FERRAMENTAS (5 min)

**Terminal — role 1 dessas opções:**

### Mac/Linux:
```bash
brew install supabase
```

### Windows:
- Baixe em: https://github.com/supabase/cli/releases (escolha a versão .exe)
- Ou use PowerShell (mais chato, prefiro a primeira)

**Depois, qualquer SO:**
```bash
supabase --version  # verifica se instalou
supabase login      # abre navegador pra autenticar
```

---

## FASE 5 — DEPLOY DA EDGE FUNCTION (10 min)

### 5.1 Criar pasta

No terminal:
```bash
mkdir -p supabase/functions/twilio-webhook
cd supabase/functions/twilio-webhook
```

### 5.2 Criar arquivo

```bash
# Mac/Linux:
touch index.ts

# Windows (PowerShell):
New-Item -Name "index.ts" -ItemType File
```

### 5.3 Copiar código

Abra o arquivo `index.ts` (com VSCode, Notepad, qualquer editor de texto).

Cole o **conteúdo completo** de `edge-functions/twilio-webhook.ts` (que mandei).

Salve.

### 5.4 Deploy

De volta no terminal (na pasta `supabase/functions/twilio-webhook/`):

```bash
supabase functions deploy twilio-webhook --project-id SEU_PROJECT_ID
```

Substitua `SEU_PROJECT_ID` pelo seu ID (acha em Supabase > Project Settings > General).

Exemplo:
```bash
supabase functions deploy twilio-webhook --project-id abc123def456
```

**✅ Se saiu verde com "Deployed successfully", funcionou!**

Copie a URL que aparecer (tipo `https://seu-projeto.supabase.co/functions/v1/twilio-webhook`).

### 5.5 Setaр secrets

```bash
supabase secrets set --project-id SEU_PROJECT_ID \
  TWILIO_AUTH_TOKEN="SEU_AUTH_TOKEN" \
  TWILIO_PHONE="SEU_NUMERO_TWILIO"
```

Substitua pelos valores que guardou na FASE 1.

- [ ] **Fase 5 completa**

---

## FASE 6 — VINCULAR TWILIO À EDGE FUNCTION (2 min)

- [ ] **Passo 1:** Copie a URL da Edge Function (da fase 5.4)
- [ ] **Passo 2:** Abra Twilio Console
- [ ] **Passo 3:** Vá em "Messaging" > "Settings" > "WhatsApp" > "Sandbox Settings"
- [ ] **Passo 4:** Procure "When a message comes in"
- [ ] **Passo 5:** Cole a URL da Edge Function
- [ ] **Passo 6:** Clique "Save"

---

## FASE 7 — TESTE (5 min)

- [ ] **Passo 1:** Abra WhatsApp no seu celular
- [ ] **Passo 2:** Procure "Twilio Sandbox"
- [ ] **Passo 3:** Envie uma mensagem (ex: "teste")
- [ ] **Passo 4:** Abra Supabase > "Table Editor" > "mensagens_whatsapp"
- [ ] **Passo 5:** Confirme que a mensagem apareceu lá
- [ ] **Passo 6:** Volte ao WhatsApp e veja se recebeu a resposta automática:
   ```
   "Recebemos sua mensagem! Um atendente vai responder em breve 👋"
   ```

**Se tudo apareceu, está 100% funcionando! 🎉**

---

## FASE 8 — CONECTAR À TELA REACT (opcional, 5 min)

Se você quer ver as mensagens na tela do React:

- [ ] **Passo 1:** Copie `lib/queries/whatsapp.ts` pra sua pasta do projeto
- [ ] **Passo 2:** Instale Supabase (se não tiver): `npm install @supabase/supabase-js`
- [ ] **Passo 3:** Adicione ao `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
```
- [ ] **Passo 4:** Use a prévia `preview-whatsapp-inbox.jsx` conectada ao banco real

---

## TROUBLESHOOTING RÁPIDO

| Problema | Solução |
|----------|---------|
| Não recebi "join magic-word" | Tenta escanear o QR de novo |
| Mensagem não apareceu no banco | Roda `supabase functions logs twilio-webhook --project-id SEU_ID` |
| Erro ao deployar | Verifica se `index.ts` existe: `ls index.ts` |
| Não recebo resposta automática | Confirma que o Twilio recebeu (vai em Twilio > Logs) |

---

## ✅ PRONTO?

Quando tiver completado tudo:

1. **Envie uma mensagem de teste** no WhatsApp
2. **Confirme que apareceu** no Supabase
3. **Me mande print** do quadro de mensagens (só pra validar)
4. **Avisou** e a gente vai pra próxima fase (responder manualmente + converter em pedido)

---

## DEPOIS (próximas fases)

- [ ] Responder manualmente pelo WhatsApp (via botão da tela React)
- [ ] Converter em pedido (criar pedido no PDV a partir da mensagem)
- [ ] Notificar cliente quando pedido ficar pronto

**Só ativa isso depois que confirmar que a parte 1-7 está 100% funcionando.**

---

**Dúvidas?** É de esperada ter problemas pequenos. Manda print do erro que eu ajudo 👍
