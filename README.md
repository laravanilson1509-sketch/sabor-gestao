<<<<<<< HEAD
# Sabor Gestão

Sistema de gestão integrada para restaurante — vendas, PDV, cozinha/KDS,
estoque, compras, financeiro, CRM/delivery e triagem de pedidos por WhatsApp.

Backend em Supabase (Postgres + Auth + Realtime + Edge Functions), frontend
em Next.js.

## Estrutura do repositório

```
sabor-gestao/
├── frontend/              → app Next.js (o que roda de verdade)
├── supabase/
│   ├── migrations/         → schema SQL, numerado, roda em ordem
│   ├── functions/          → Edge Functions (Deno), uma pasta por função
│   └── config.toml
├── n8n/                    → workflow de automação (alternativa às Edge Functions)
├── docs/                   → guias de setup, troubleshooting, decisões de arquitetura
└── previews/               → protótipos React com dados mockados (referência visual)
```

## Setup rápido

### 1. Banco de dados

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_ID

# roda as migrations em ordem
supabase db push
```

Ou, se preferir manual: abra cada arquivo de `supabase/migrations/` em ordem
numérica no SQL Editor do painel Supabase e clique Run.

### 2. Edge Functions

```bash
supabase functions deploy ifood-webhook --project-id SEU_PROJECT_ID
supabase functions deploy pix-webhook --project-id SEU_PROJECT_ID
supabase functions deploy twilio-webhook --project-id SEU_PROJECT_ID
supabase functions deploy twilio-resposta --project-id SEU_PROJECT_ID

supabase secrets set --project-id SEU_PROJECT_ID \
  TWILIO_ACCOUNT_SID="..." \
  TWILIO_AUTH_TOKEN="..." \
  TWILIO_PHONE="..."
```

Guia completo: `docs/GUIA-COMPLETO-TWILIO-EDGE-FUNCTION.md`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# preenche com os valores do seu projeto Supabase
npm run dev
```

Detalhes: `frontend/README.md`

## Onde começar (se for a primeira vez lendo isso)

1. `docs/COMECE-AQUI.md`
2. `docs/CHECKLIST-RAPIDO.md`
3. Se travar em algo: `docs/TROUBLESHOOTING-DETALHADO.md`

## Status

- ✅ Schema completo (10 migrations)
- ✅ 4 Edge Functions (iFood, PIX, Twilio webhook, Twilio resposta)
- ✅ Módulo WhatsApp 100% funcional (frontend real, conectado ao banco)
- 🔲 Demais módulos (PDV, Cozinha, Estoque etc.) — só protótipo em `previews/`, ainda não viraram páginas reais
- 🔲 Login/autenticação
- 🔲 Seleção de unidade (multiunidade)
=======
# sabor-gestao
Sistema de gestão integrada para restaurante
>>>>>>> add0826a937f02f290f5c95e90f841a6c562f1ec
