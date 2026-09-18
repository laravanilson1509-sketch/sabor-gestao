-- 0011: completa os cadastros que o frontend já usa (telas de
-- fornecedores/clientes/funcionarios/motoboys) mas que ainda não
-- tinham suporte total no banco.
--
-- Não altera nem remove nada das migrations 0001-0010 — só adiciona
-- colunas e tabelas novas, pra não quebrar dado que já exista.
--
-- Idempotente: usa "if not exists" em tudo e "drop policy if exists"
-- antes de recriar policy, então é seguro rodar de novo mesmo que uma
-- tentativa anterior tenha aplicado só parte do arquivo.

-- ============================================================
-- MOTOBOYS
-- ============================================================
create table if not exists public.motoboys (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,
  telefone text,
  placa_veiculo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- caso a tabela já existisse (criada antes, por fora desta migration)
-- com um subconjunto diferente de colunas, garante que as que o
-- frontend usa estejam todas lá.
alter table public.motoboys
  add column if not exists nome text,
  add column if not exists telefone text,
  add column if not exists placa_veiculo text;

alter table public.motoboys
  add column if not exists ativo boolean not null default true;

create index if not exists idx_motoboys_unidade on public.motoboys (unidade_id);

alter table public.motoboys enable row level security;

-- segue o mesmo padrão de fornecedores/ingredientes (0001): qualquer um
-- vinculado à unidade vê, só quem gerencia (ou o próprio delivery/caixa
-- no dia a dia) cria/edita, e só gestor exclui.
drop policy if exists motoboys_select on public.motoboys;
create policy motoboys_select on public.motoboys
  for select using (public.user_has_unidade(unidade_id));

drop policy if exists motoboys_write on public.motoboys;
create policy motoboys_write on public.motoboys
  for insert with check (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','caixa','atendimento'));

drop policy if exists motoboys_update on public.motoboys;
create policy motoboys_update on public.motoboys
  for update using (public.user_papel(unidade_id) in ('administrador','proprietario','gerente','caixa','atendimento'));

drop policy if exists motoboys_delete on public.motoboys;
create policy motoboys_delete on public.motoboys
  for delete using (public.user_is_gestor(unidade_id));

-- ============================================================
-- FUNCIONARIOS
-- ============================================================
create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,
  cargo text,
  telefone text,
  email text,
  data_admissao date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- mesmo raciocínio: garante as colunas mesmo se a tabela já existisse
-- com estrutura diferente.
alter table public.funcionarios
  add column if not exists nome text,
  add column if not exists cargo text,
  add column if not exists telefone text,
  add column if not exists email text,
  add column if not exists data_admissao date;

alter table public.funcionarios
  add column if not exists ativo boolean not null default true;

create index if not exists idx_funcionarios_unidade on public.funcionarios (unidade_id);

alter table public.funcionarios enable row level security;

-- dado sensível (cargo, admissão) — só gestor mexe.
drop policy if exists funcionarios_select on public.funcionarios;
create policy funcionarios_select on public.funcionarios
  for select using (public.user_has_unidade(unidade_id));

drop policy if exists funcionarios_write on public.funcionarios;
create policy funcionarios_write on public.funcionarios
  for all using (public.user_is_gestor(unidade_id))
  with check (public.user_is_gestor(unidade_id));

-- ============================================================
-- FORNECEDORES: a tela de cadastro usa nome/cnpj_cpf/observacoes/ativo,
-- mas a tabela original (0001) foi desenhada com
-- razao_social/nome_fantasia/cnpj/status. Mantém as colunas antigas
-- (evita perder dado já cadastrado) e adiciona as que o frontend espera.
-- ============================================================
alter table public.fornecedores
  add column if not exists nome text,
  add column if not exists cnpj_cpf text,
  add column if not exists observacoes text;

alter table public.fornecedores
  add column if not exists ativo boolean not null default true;

-- ============================================================
-- CLIENTES: já tem nome/telefone/email/endereco, faltava
-- observacoes e ativo (a tela de cadastro usa os dois).
-- ============================================================
alter table public.clientes
  add column if not exists observacoes text;

alter table public.clientes
  add column if not exists ativo boolean not null default true;