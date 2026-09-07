# Sabor Gestão — App

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local
# edite .env.local com os valores do seu Supabase (URL, anon key, unidade_id)
npm run dev
```

Abre em `http://localhost:3000` — redireciona direto pra `/whatsapp`.

## Pré-requisitos no Supabase

Antes de rodar o app, confirme que já rodou (nesta ordem, no SQL Editor):

1. `schema-fichas-tecnicas-estoque.sql`
2. `schema-pdv-pedidos-mesas.sql`
3. `schema-cozinha-kds.sql`
4. `schema-compras.sql`
5. `schema-financeiro.sql`
6. `schema-crm-delivery.sql`
7. `schema-relatorios-alertas-bi.sql`
8. `schema-integracoes.sql`
9. `schema-precificacao-revenda.sql`
10. `schema-whatsapp-triagem.sql`

E que a Edge Function `twilio-resposta` está deployada e com os secrets `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE` configurados (veja `GUIA-COMPLETO-TWILIO-EDGE-FUNCTION.md`).

## O que já funciona nesta versão

- **`/whatsapp`** — quadro real (não mockado), conectado ao Supabase:
  - Lista mensagens da unidade, agrupadas por status
  - Atualiza sozinho quando chega mensagem nova (Realtime — não precisa recarregar a página)
  - **Responder direto no app**: digita a resposta no card e clica "Enviar resposta" — a mensagem sai pelo número Twilio da unidade e o card já marca como atendido
  - **Descartar**: pra spam ou mensagem sem interesse comercial
  - **Converter em pedido**: seleciona produtos do cardápio real (lidos do banco) e cria o pedido de verdade — ele nasce no PDV, entra na fila da cozinha, baixa estoque

## O que ainda não está aqui

- Login/autenticação (tudo assume um usuário já autenticado com acesso à unidade — o Supabase client já manda o JWT, mas não tem tela de login neste pacote)
- Seleção de unidade (fixo por env var `NEXT_PUBLIC_UNIDADE_ID` por enquanto)
- Telas de PDV, Mesas, Cozinha, Estoque, Fichas Técnicas como páginas reais (só existem como protótipo com dados mockados, nos arquivos `preview-*.jsx`)
- Quantidade/observação por item ao converter mensagem em pedido (hoje sempre cria com quantidade 1)

## Estrutura

```
app/
  layout.tsx           — shell raiz
  page.tsx             — redireciona pra /whatsapp
  whatsapp/page.tsx     — tela real do WhatsApp
  globals.css
components/
  whatsapp/InboxBoard.tsx   — o quadro (client component)
lib/
  supabase/client.ts    — cliente browser
  supabase/server.ts    — cliente server
  queries/whatsapp.ts   — todas as chamadas ao banco desta tela
  queries/*.ts          — queries de outros módulos (já prontas, aguardando telas)
  theme.ts              — cores compartilhadas
middleware.ts           — renovação de sessão Supabase
```

## Próximo passo natural

Transformar `preview-sistema-restaurante-v2.jsx` (fichas técnicas) e as outras prévias em páginas reais, no mesmo padrão do que foi feito aqui pro WhatsApp: componente client + queries do Supabase + Realtime onde fizer sentido (cozinha/KDS, por exemplo).
