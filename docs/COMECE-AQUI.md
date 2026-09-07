# 🗂️ ÍNDICE — Por onde começar

Você tem 4 arquivos entregues. Leia nesta ordem:

---

## 📋 Passo 0 — Entender o fluxo (2 min)

**Arquivo:** Este aqui

**O que vai acontecer:**
```
Cliente envia msg no WhatsApp
    ↓
Twilio recebe
    ↓
Twilio envia webhook pro seu servidor Supabase
    ↓
Edge Function valida + grava em mensagens_whatsapp
    ↓
Você vê no quadro da tela React (não atendido/atendido/convertido)
    ↓
Você marca como atendido ou descarta
    ↓
Se virou pedido, ele nasce no PDV com fila de cozinha
```

**Custo:** R$ 0 no início (Twilio dá R$ 50 grátis). Depois ~R$ 6-30/mês se tiver 100-500 msgs/dia.

---

## 📝 Passo 1 — Checklist rápido (10 min)

**Arquivo:** `CHECKLIST-RAPIDO.md`

**Por que:** É a coisa mais direta. 8 fases, checkboxes, cola um comando aqui, cola um ali. Sem teorias.

**Quando terminar:** você vai ter:
- ✅ Conta Twilio ativa com WhatsApp Sandbox
- ✅ Schema rodado no Supabase
- ✅ Edge Function deployada
- ✅ Teste funcionando (recebeu mensagem, gravou no banco, respondeu no WhatsApp)

---

## 📖 Passo 2 — Guia detalhado (se algo der errado)

**Arquivo:** `GUIA-COMPLETO-TWILIO-EDGE-FUNCTION.md`

**Por que:** Se o checklist ficar confuso ou tiver dúvida, aqui explica cada coisa com mais detalhe.

**Quando usar:** só se travou em algum passo do checklist.

---

## 🔧 Passo 3 — Troubleshooting (se ainda der errado)

**Arquivo:** `TROUBLESHOOTING-DETALHADO.md`

**Por que:** Os erros mais comuns tão aqui com solução.

**Quando usar:** se rodou tudo mas algo não funcionou como esperado.

---

## 🚀 Passo 4 — Próximas fases (depois que tudo funcionar)

**Após confirmar que:**
- [ ] Mensagem chega no WhatsApp
- [ ] Mensagem aparece no Supabase
- [ ] Resposta automática volta pro cliente
- [ ] Quadro React atualiza em tempo real

**Você vai querer:**

### Fase A — Responder manualmente
Quando alguém clica em "Responder" na tela, a mensagem sai do seu número Twilio pra o cliente.

**Arquivo que vai precisar:** `edge-functions/twilio-enviar-manual.ts` (ainda não mandei, fácil criar)

### Fase B — Converter em pedido automaticamente
Quando clica "Converter", o pedido nasce no PDV, vai pra fila da cozinha, baixa estoque, tudo.

**Já tá pronto:** `lib/queries/whatsapp.ts` tem `converterEmPedido()`

### Fase C — Notificar cliente
Quando o pedido fica pronto na cozinha, cliente recebe aviso automático no WhatsApp.

**Precisa:** trigger no banco + chamada pra Twilio API

---

## ✅ RESUMÃO

| Situação | O que fazer |
|----------|-----------|
| Nunca fiz integração antes | Lê CHECKLIST-RAPIDO.md de cima pra baixo |
| Travei em algum passo | Procura o erro em GUIA-COMPLETO-... ou TROUBLESHOOTING-... |
| Tudo funcionou! | Me avisa que tá pronto pra próxima fase |
| Quero entender melhor | Lê GUIA-COMPLETO-... (tem mais explicação) |

---

## 📂 Arquivos que você vai usar

### SQL (rodar no Supabase SQL Editor)
```
schema-whatsapp-triagem.sql
```

### Code (copiar pra seu projeto)
```
edge-functions/twilio-webhook.ts  (main)
lib/queries/whatsapp.ts           (frontend)
```

### Docs (ler pra entender)
```
CHECKLIST-RAPIDO.md               (começa daqui)
GUIA-COMPLETO-...md               (explica melhor)
TROUBLESHOOTING-...md             (se der erro)
```

### Preview React (só pra ver como fica)
```
preview-whatsapp-inbox.jsx
```

---

## 🎯 OBJETIVO

Depois de 40 minutos, você quer ter:

1. **Mensagem no WhatsApp** → aparece no Supabase
2. **Resposta automática** → volta pro cliente
3. **Quadro atualiza** → você vê em tempo real na tela React
4. **Triagem funciona** → clica "Atender", marca como "Convertido"
5. **Tudo sem pagar nada** → usando Twilio free tier

---

## 🆘 Tá pronto?

1. Abre `CHECKLIST-RAPIDO.md`
2. Segue passo a passo
3. Quando terminar, manda print do quadro de mensagens
4. A gente valida se tá 100% e parte pra próximas fases

Sucesso! 🚀
