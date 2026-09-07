# Roteiro de Implementação — Sistema de Gestão para Restaurante (Supabase)

## 1. Stack recomendada

- **Backend/DB:** Supabase (Postgres + Auth + Realtime + Storage + Edge Functions + pg_cron)
- **Frontend:** Next.js (React) — web responsivo, cobre desktop/tablet/celular sem precisar de app nativo no início
- **PDV/KDS:** mesma base web, otimizada para tela de caixa e telas de cozinha (podem ser rotas dedicadas, ex. `/kds`, `/pdv`)
- **Emissão fiscal/pagamentos:** ficam como integrações externas via Edge Functions (webhooks), não fazem parte do core

Supabase encaixa bem aqui porque o sistema é essencially CRUD relacional + tempo real (pedidos, KDS, dashboard) + multiusuário com permissões — exatamente o que RLS (Row Level Security) e Realtime resolvem nativamente.

---

## 2. Arquitetura de dados — visão geral

Ideia central: **multiunidade desde o primeiro dia**, mesmo que o cliente comece com 1 loja. Isso evita retrabalho estrutural depois (é muito mais barato prever `unidade_id` em tudo agora do que migrar depois).

```
organizacoes (futuro, se for multi-cliente/SaaS)
 └── unidades (lojas/restaurantes)
      └── tudo mais referencia unidade_id
```

### Módulos de schema (grupos de tabelas)

1. **Auth & permissões** — `profiles`, `roles`, `permissions`, `user_roles`, `unidades`, `user_unidades`
2. **Cadastros base** — `produtos`, `categorias`, `ingredientes`, `fornecedores`
3. **Fichas técnicas** — `fichas_tecnicas`, `ficha_tecnica_itens`
4. **Estoque** — `estoque_saldo`, `movimentacoes_estoque`, `lotes`
5. **Compras** — `solicitacoes_compra`, `cotacoes`, `pedidos_compra`, `pedido_compra_itens`
6. **PDV / Pedidos** — `pedidos`, `pedido_itens`, `caixas`, `caixa_movimentacoes`
7. **Mesas & Reservas** — `mesas`, `reservas`
8. **Cozinha / KDS / Produção** — `ordens_producao`, `ordem_producao_itens`, `filas_producao`
9. **Perdas & Validade** — `perdas`, `lotes` (compartilhado com estoque)
10. **Delivery** — `delivery_pedidos`, `delivery_canais`
11. **Clientes/CRM** — `clientes`, `cupons`, `promocoes`, `fidelidade`
12. **Financeiro** — `contas_pagar`, `contas_receber`, `fluxo_caixa`, `dre_lancamentos`
13. **Auditoria** — `audit_log` (genérica, alimentada por triggers)
14. **Relatórios/BI** — views e materialized views em cima dos módulos acima

Cada tabela operacional carrega `unidade_id`, `created_by`, `created_at`, `updated_at` como padrão.

---

## 3. Como usar os recursos do Supabase por módulo

| Necessidade do requisito | Recurso do Supabase |
|---|---|
| Permissões por perfil (Admin, Gerente, Caixa...) | RLS policies + tabela `roles`/`permissions` |
| Auditoria de operações críticas | Triggers `AFTER INSERT/UPDATE/DELETE` gravando em `audit_log` |
| Recalcular custo da ficha técnica ao mudar insumo | Trigger em `ingredientes` (UPDATE de custo) → recalcula `fichas_tecnicas` |
| KDS atualizando pedidos em tempo real | Supabase Realtime (subscribe na tabela `pedidos`/`ordem_producao_itens`) |
| Alertas (estoque baixo, validade, atraso) | Combinação de: view calculada + Edge Function agendada via `pg_cron` que checa e insere em `alertas` |
| Upload de imagem de produto | Supabase Storage (bucket `produtos`) |
| Integrações futuras (iFood, PIX, NF-e) | Edge Functions como webhooks/endpoints externos |
| Dashboard consolidado multiunidade | Views agregadas + RLS relaxado para perfil Admin/Proprietário |

---

## 4. Roteiro de implementação por fases

A ordem segue dependência real entre módulos — não dá para ter PDV sem produto, nem ficha técnica sem estoque, etc.

### Fase 0 — Fundação (1–2 semanas)
- Setup do projeto Supabase + Next.js
- `unidades`, `profiles`, `roles`, `permissions`, RLS base
- Login/Auth (Supabase Auth) + seleção de unidade ativa
- Estrutura de auditoria (`audit_log` + trigger genérico)

### Fase 1 — Cadastros e estoque (núcleo do sistema)
- `categorias`, `produtos`, `ingredientes`, `fornecedores`
- `fichas_tecnicas` com cálculo automático de custo
- `estoque_saldo`, `movimentacoes_estoque`, `lotes`, controle de validade/FEFO
- Alertas de estoque mínimo/máximo e validade (view + cron)

### Fase 2 — Operação de venda
- PDV: `caixas`, `pedidos`, `pedido_itens`, formas de pagamento
- Mesas: `mesas`, status, transferência, divisão de conta
- Reservas: `reservas`

### Fase 3 — Cozinha e produção
- Fila de produção ligada a `pedidos` (Realtime)
- KDS (tela dedicada consumindo Realtime)
- PCP: `ordens_producao`, cálculo de necessidade de insumos a partir das fichas técnicas
- Consumo automático de estoque ao produzir/vender

### Fase 4 — Compras e fornecedores
- Fluxo completo: solicitação → cotação → aprovação → pedido → recebimento → entrada em estoque
- Ligação com estoque mínimo (sugestão de compra ainda manual nessa fase)

### Fase 5 — Financeiro
- Contas a pagar/receber, fluxo de caixa
- DRE gerencial (views agregando vendas + custos + despesas)
- Ligação automática: venda no PDV → conta a receber; compra aprovada → conta a pagar

### Fase 6 — CRM, promoções e delivery
- Cadastro de clientes, histórico, cupons, promoções
- Estrutura de `delivery_pedidos` pronta para integração (iFood/WhatsApp entram depois via webhook)

### Fase 7 — Relatórios, BI e alertas
- Módulo de relatórios (export Excel/PDF/CSV)
- Indicadores (CMV, margem, giro de estoque, ticket médio etc.) como views/materialized views
- Central de alertas consolidada

### Fase 8 — Integrações externas e inteligência
- iFood, WhatsApp, PIX, emissão fiscal via Edge Functions
- Sugestões automáticas (compra, produção, estoque mínimo) — pode começar com regras simples antes de qualquer ML

---

## 5. Observações práticas

- **RLS é o ponto mais crítico do projeto** — vale desenhar a matriz de permissões (perfil × módulo × ação) em planilha antes de escrever a primeira policy, porque o requisito pede controle bem granular (visualizar/criar/editar/excluir/aprovar/cancelar/alterar preço/financeiro).
- **Fichas técnicas e estoque são o coração do sistema** — praticamente todo módulo depende deles (PCP, perdas, compras, CMV, DRE). Vale investir tempo extra ali antes de avançar.
- **Multiunidade desde o início** evita migração dolorosa depois, mesmo que o cliente use só 1 loja agora.
- Dado o tamanho do escopo, recomendo tratar cada fase acima como um marco entregável e validável isoladamente, ao invés de tentar construir tudo antes do primeiro uso real.

Posso detalhar o schema SQL completo (tabelas + RLS policies) de qualquer uma dessas fases quando você quiser começar a implementação.
