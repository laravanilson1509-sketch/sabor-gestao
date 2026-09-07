# 🔧 TROUBLESHOOTING — Erros comuns e soluções

---

## ❌ "Supabase CLI não encontrado"

### Erro:
```
supabase: command not found
```

### Solução:

**Mac/Linux:**
```bash
brew install supabase
```

Se isso não funcionar:
```bash
curl -fsSL https://deb.supabase.io/supabase.key | sudo apt-key add -
echo "deb [arch=amd64] https://deb.supabase.io $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/supabase.list
sudo apt update
sudo apt install supabase
```

**Windows:**
1. Acesse https://github.com/supabase/cli/releases
2. Procure por `supabase-cli_X.X.X_windows_amd64.exe` (a versão mais recente)
3. Baixe e clique 2x pra instalar
4. Abra um **novo terminal** (PowerShell ou CMD) e tente novamente

Se ainda não funcionar, reinicie o PC.

---

## ❌ "Cannot find index.ts"

### Erro:
```
Cannot find index.ts in the function directory
```

### Solução:

Verifique que você está na pasta correta:
```bash
pwd  # mostra em qual pasta você tá
ls   # lista os arquivos
```

Deve aparecer `index.ts` na lista.

Se não tiver:
```bash
# Crie novamente:
touch index.ts
# E coloque o código da Edge Function dentro
```

---

## ❌ "Erro ao deployar: 401 Unauthorized"

### Erro:
```
401 Unauthorized - invalid token
```

### Solução:

Você não tá autenticado. Rode:
```bash
supabase login
```

Vai abrir o navegador. Clique em "Confirm" e espera uma mensagem azul.

Se mesmo assim não funcionar:
```bash
supabase logout
supabase login  # tenta novamente
```

---

## ❌ "Webhook aparece mas não recebe mensagens"

### Erro:
Você enviou mensagem no WhatsApp, mas não apareceu no Supabase.

### Solução — checklist:

1. **Confirme que a URL está correta em Twilio:**
   - Twilio Console > Messaging > Settings > WhatsApp > Sandbox Settings
   - Campo "When a message comes in" deve ter a URL que você deployou
   - Deve ser exatamente: `https://seu-projeto.supabase.co/functions/v1/twilio-webhook`
   - Sem barra no final, sem http (tem que ser https)

2. **Confirme que as secrets foram setadas:**
   ```bash
   supabase secrets list --project-id SEU_ID
   ```
   Deve aparecer:
   ```
   TWILIO_AUTH_TOKEN
   TWILIO_PHONE
   ```

3. **Veja os logs da Edge Function:**
   ```bash
   supabase functions logs twilio-webhook --project-id SEU_ID
   ```
   
   Se tiver erro, vai aparecer aqui. Copie o erro e me manda.

4. **Confirme que você tá conversando com o número Sandbox certo:**
   - Twilio > Messaging > Services > procure o número que começa com +55
   - Esse número deve aparecer em WhatsApp como "Twilio Sandbox"

5. **Confirme que linkou sua conta corretamente:**
   - No seu celular, vá em WhatsApp > Mais > Configurações > Conectados a apps
   - Deve aparecer "Twilio" listado
   - Se não tiver, tenta escanear o QR code novamente

---

## ❌ "Resposta automática não chega no WhatsApp"

### Erro:
Mensagem foi gravada no banco, mas você não recebeu a resposta "Recebemos sua mensagem...".

### Solução:

1. **Veja se tem erro nos logs:**
   ```bash
   supabase functions logs twilio-webhook --project-id SEU_ID
   ```

2. **Confirme que `TWILIO_PHONE` está certo:**
   ```bash
   supabase secrets get TWILIO_PHONE --project-id SEU_ID
   ```
   
   Deve ser um número como `+5544999999999` (com o +55, sem espaços).

3. **Verifique o crédito Twilio:**
   - Twilio Console > Home > Account Balance
   - Se tiver R$ 0, você não consegue enviar mensagens
   - (Deveria ter R$ 50 iniciais, mas se gastou tudo em testes)

4. **Se está com crédito**, tenta outra coisa:
   - Deslogue e logue de novo no Twilio
   - Tenta enviar uma mensagem diferente (não repita a mesma coisa)

---

## ❌ "Erro ao rodar o schema SQL"

### Erro:
```
relation "public.mensagens_whatsapp" already exists
```

### Solução:

A tabela já foi criada. Se quer recriar do zero:

1. Vá em Supabase > SQL Editor
2. Rode esse comando:
   ```sql
   DROP TABLE IF EXISTS public.mensagens_whatsapp CASCADE;
   ```
3. Depois rode o schema novamente

Ou é mais fácil só ignorar o erro e continuar — a tabela já tá lá.

---

## ❌ "Posso enviar mensagens mas não consigo receber"

### Erro:
Quando você tenta enviar mensagem do seu número no WhatsApp, aparece erro tipo "Este número não está ativo".

### Solução:

Você tá usando seu número pessoal. Twilio Sandbox só funciona quando **você escaneia o QR code com sua conta pessoal**.

Se não fez isso:
1. Abra WhatsApp no seu celular
2. Vá em Mais > Configurações > Conectados a apps
3. Procure por "Twilio"
4. Se não tiver, volte pro Twilio Console
5. Em Messaging > Send WhatsApp, clique "Get Started" de novo
6. Escaneie o novo QR code

Depois tenta enviar novamente.

---

## ❌ "Table "mensagens_whatsapp" does not exist"

### Erro:
```
relation "public.mensagens_whatsapp" does not exist
```

### Solução:

O schema não foi rodado. Volte pra FASE 3 do guia e rode o SQL novamente.

Confirme que apareceu em:
- Supabase > Table Editor
- Deve listar "mensagens_whatsapp"

---

## ❌ "Edge Function retorna 500 Internal Server Error"

### Erro:
```
POST /functions/v1/twilio-webhook -> 500
```

### Solução:

1. **Veja os logs:**
   ```bash
   supabase functions logs twilio-webhook --project-id SEU_ID
   ```

2. **Erros comuns:**
   - `SUPABASE_URL is not set` → rodou o deploy sem usar a pasta correta
   - `Database error` → a tabela `mensagens_whatsapp` não existe
   - `Auth failed` → `TWILIO_AUTH_TOKEN` tá errado ou inválido

3. **Se tiver erro, edita o `index.ts` e redeploya:**
   ```bash
   supabase functions deploy twilio-webhook --project-id SEU_ID
   ```

---

## ❌ "Consegui deployar mas a tela React não vê as mensagens"

### Erro:
A tabela tem dados (você vê no Supabase), mas a tela React está vazia ou mostra "Sem dados".

### Solução:

1. **Confirme que as variáveis de ambiente estão certas:**
   - `.env.local` tem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`?
   - Se mudou os valores, faz `npm run dev` de novo

2. **Confirme que importou as queries:**
   ```javascript
   import { getMensagensPorStatus } from "@/lib/queries/whatsapp";
   ```

3. **Teste a query no terminal:**
   ```bash
   npm install @supabase/supabase-js  # se não tiver
   ```

4. **Se ainda não funcionar, testa a API do Supabase direto:**
   ```bash
   curl -X GET "https://seu-projeto.supabase.co/rest/v1/mensagens_whatsapp" \
     -H "Authorization: Bearer SEU_ANON_KEY"
   ```

   Se retornar um array com mensagens, a API tá OK e o problema é no React.

---

## ❌ "Botão 'Atender' / 'Converter' não funciona"

### Erro:
Você clica mas nada acontece, ou aparece um erro estranho.

### Solução:

1. **Abra o console do navegador** (F12 > Console)
2. **Clique no botão de novo e veja que erro aparece**
3. **Comum:**
   - `userID is undefined` → você não tá logado no Supabase
   - `Network error` → problema de conexão
   - `Row-level security violation` → precisa de uma policy no Supabase

Para a política RLS, rode no Supabase SQL Editor:

```sql
-- Se não existe, cria a policy de atualização
CREATE POLICY mensagens_whatsapp_update ON public.mensagens_whatsapp FOR UPDATE
  USING (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','atendimento','caixa'));
```

---

## ❌ "Rate limit — Twilio bloqueou"

### Erro:
```
Too many requests - rate limited
```

### Solução:

Você enviou muitas mensagens/requisições muito rápido. Espera 1 minuto e tenta de novo.

Se virou um padrão, você tá com crédito acabando ou Twilio tá bloqueando:
1. Verifique o saldo: Twilio Console > Home > Account Balance
2. Se não tiver crédito, você precisa adicionar cartão pra continuar

---

## ❌ "Como saber se meu saldo Twilio?

### Solução:

Twilio Console > Home > Account Balance

Se tiver um número verde positivo (tipo `$45.00`), tá tudo bem.
Se tiver `$0.00`, seus R$ 50 iniciais acabaram.

---

## 🆘 Erro que não está aqui?

Manda:
1. **Print do erro exato** (copiar/colar o texto)
2. **De onde vem** (terminal? Browser? Twilio?)
3. **O que você estava fazendo** quando aconteceu

Eu ajudo 👍
