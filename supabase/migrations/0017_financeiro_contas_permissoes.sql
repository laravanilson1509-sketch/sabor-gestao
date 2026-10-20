-- =============================================================================
-- Financeiro — permissões das contas a pagar/receber
-- =============================================================================
-- O Supabase liga o RLS nas tabelas novas; sem nenhuma policy ele bloqueia tudo.
-- Aqui liberamos ler e gravar só para quem está logado no sistema.
-- =============================================================================

alter table public.contas_pagar enable row level security;
alter table public.contas_receber enable row level security;

drop policy if exists contas_pagar_logado on public.contas_pagar;
create policy contas_pagar_logado on public.contas_pagar
  for all to authenticated using (true) with check (true);

drop policy if exists contas_receber_logado on public.contas_receber;
create policy contas_receber_logado on public.contas_receber
  for all to authenticated using (true) with check (true);
