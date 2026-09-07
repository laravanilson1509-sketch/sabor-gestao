# Twilio + Supabase — 2 Opções

## Opção 1: Com n8n (visual, mais controle)

```
Twilio → n8n (workflow visual) → Supabase
```

**Pros:**
- ✅ Tela visual, sem código
- ✅ Fácil de debugar
- ✅ Pode adicionar lógica complexa (ex: buscar cliente por telefone, criar pedido automático)
- ✅ Webhook reutilizável pra muitos serviços

**Contras:**
- ⚠️ Precisa de conta n8n + n8n.cloud (free: 1.000 execuções/mês)
- ⚠️ Um extra na stack (mais dependências)

**Quando usar:**
- Você quer respostas condicionais (ex: se cliente é VIP, envia menu premium)
- Você já usa n8n pra outras automações
- Você quer que seja fácil mexer depois, sem tocar em código

---

## Opção 2: Edge Function direto (mais rápido)

```
Twilio → Supabase Edge Function → Banco de dados
```

**Pros:**
- ✅ Uma chamada só, zero intermediários
- ✅ Rápido (~50-100ms)
- ✅ Sem custo adicional (dentro do free tier Supabase)
- ✅ Fácil de hospedar e versionar (no próprio Supabase)

**Contras:**
- ⚠️ Precisa editar código TypeScript
- ⚠️ Mais difícil fazer lógica complexa sem redeployar

**Quando usar:**
- Você quer começar agora, rápido
- A lógica é simples (recebe → grava)
- Você não usa n8n

---

## Comparação lado a lado

| | n8n | Edge Function |
|---|-----|--------|
| **Setup** | 10 min (importar JSON) | 5 min (deploy CLI) |
| **Custo** | Free até 1.000/mês | Free (incluso Supabase) |
| **Visual** | Sim (UI drag-drop) | Não (código) |
| **Latência** | ~200-300ms | ~50-100ms |
| **Escalabilidade** | Free tier chega só até 1.000/mês | Supabase aguenta milhões |
| **Complexidade futura** | Fácil adicionar lógica | Precisa redeployar |

---

## Minha sugestão

**Comece com a Edge Function** (rápido pra validar). Depois, se precisar de:
- Responder diferente por cliente
- Criar pedido automaticamente
- Logs detalhados e workflow visual

...aí você migra pro n8n (é meia hora de trabalho, exporta o workflow já pronto).

---

## Arquivos entregues

### Para n8n:
- `n8n-workflow-twilio-supabase.json` — workflow pronto, importar no n8n
- `GUIA-TWILIO-N8N-SUPABASE.md` — setup completo passo a passo
- `edge-functions/twilio-resposta.ts` — Edge Function que envia resposta automática

### Para Edge Function direto:
- `edge-functions/twilio-webhook.ts` — recebe e grava tudo sozinho
- `PAYLOADS-TWILIO-N8N-SUPABASE.md` — estrutura do que chega/sai

---

## Próximo passo

Qual você prefere começar?

1. **Edge Function direto** → mais rápido, 20 min e tá rodando
2. **n8n** → mais visual, mais flexível pra depois

Avisa e eu detalho a configuração de Twilio + o que fazer.
