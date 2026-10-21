-- =============================================================================
-- Clientes — data de nascimento (para avisar os aniversariantes)
-- =============================================================================
alter table public.clientes
  add column if not exists data_nascimento date;
