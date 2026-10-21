-- =============================================================================
-- Impressão de comandas e fechamento de conta
-- =============================================================================
-- Cinco operações separadas, mas ligadas pelo pedido:
--   1. Ticket de produção  -> pdv_impressoes (documento 'producao')
--   2. Pré-conta            -> conferência do cliente, NÃO recebe dinheiro
--   3. Pagamento            -> pdv_pagamentos (um por forma/pessoa)
--   4. Fechamento           -> pdv_fechamentos (foto da conta no momento)
--   5. Comprovante          -> pdv_impressoes (documento 'comprovante')
-- Reimprimir só cria uma nova linha na fila: nunca gera venda nem pagamento.
-- Nenhum desses comprovantes é documento fiscal (NFC-e fica para a integração
-- fiscal).
--
-- Ações sensíveis (cancelar item já enviado, desconto, cortesia, tirar a taxa
-- de serviço, reabrir conta, estornar pagamento, fechar com pendência) só
-- acontecem pelas funções abaixo, que conferem o PIN de quem autoriza e gravam
-- na auditoria.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;


-- =============================================================================
-- 1. CONFIGURAÇÃO DA CONTA E DO CUPOM
-- =============================================================================

create table if not exists public.pdv_config (
  unidade_id uuid primary key,
  nome_estabelecimento text,
  documento text,                -- CNPJ/CPF impresso no cabeçalho
  endereco text,
  telefone text,
  rodape text default 'Obrigado pela preferência!',
  taxa_servico_pct numeric(5,2) not null default 10 check (taxa_servico_pct between 0 and 30),
  taxa_servico_mesa boolean not null default true,
  taxa_servico_balcao boolean not null default false,
  remover_taxa_exige_pin boolean not null default true,
  desconto_max_caixa_pct numeric(5,2) not null default 10 check (desconto_max_caixa_pct between 0 and 100),
  imprimir_producao_auto boolean not null default true,
  imprimir_comprovante_auto boolean not null default true,
  imprimir_via_estabelecimento boolean not null default false,
  exigir_caixa_aberto boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create or replace function public.pdv_obter_config(p_unidade uuid)
returns public.pdv_config language plpgsql security definer set search_path = public as $$
declare
  v public.pdv_config;
begin
  select * into v from public.pdv_config where unidade_id = p_unidade;
  if not found then
    insert into public.pdv_config (unidade_id) values (p_unidade)
    on conflict (unidade_id) do nothing;
    select * into v from public.pdv_config where unidade_id = p_unidade;
  end if;
  return v;
end;
$$;


-- =============================================================================
-- 2. OPERADORES, PIN E PERMISSÕES
-- =============================================================================
-- Todos usam o mesmo login no computador do salão; quem autoriza uma ação
-- sensível digita o próprio PIN. O PIN fica guardado só como hash (bcrypt) e
-- ninguém consegue ler essa coluna pela API.

create table if not exists public.pdv_operadores (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  nome text not null,
  perfil text not null default 'atendente'
    check (perfil in ('atendente','caixa','gerente','administrador')),
  pin_hash text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pdv_operadores_unidade on public.pdv_operadores (unidade_id);

-- o que cada perfil pode autorizar
create or replace function public.pdv_perfil_pode(p_perfil text, p_acao text)
returns boolean language sql immutable as $$
  select case p_acao
    when 'desconto'             then p_perfil in ('caixa','gerente','administrador')
    when 'remover_taxa'         then p_perfil in ('caixa','gerente','administrador')
    when 'cancelar_item'        then p_perfil in ('gerente','administrador')
    when 'cortesia'             then p_perfil in ('gerente','administrador')
    when 'reabrir_conta'        then p_perfil in ('gerente','administrador')
    when 'estornar_pagamento'   then p_perfil in ('gerente','administrador')
    when 'fechar_pendente'      then p_perfil in ('gerente','administrador')
    when 'cancelar_pedido'      then p_perfil in ('gerente','administrador')
    when 'gerenciar_operadores' then p_perfil in ('gerente','administrador')
    else false
  end;
$$;

-- confere o PIN e a permissão; devolve quem autorizou (ou dá erro)
create or replace function public.pdv_autorizar(p_unidade uuid, p_pin text, p_acao text)
returns public.pdv_operadores
language plpgsql security definer set search_path = public, extensions as $$
declare
  v public.pdv_operadores;
begin
  if coalesce(trim(p_pin), '') = '' then
    raise exception 'Digite o PIN de quem autoriza.';
  end if;
  select * into v from public.pdv_operadores
   where unidade_id = p_unidade and ativo and pin_hash is not null
     and pin_hash = crypt(p_pin, pin_hash)
   limit 1;
  if not found then
    raise exception 'PIN inválido.';
  end if;
  if not public.pdv_perfil_pode(v.perfil, p_acao) then
    raise exception 'O perfil % de % não pode autorizar esta ação.', v.perfil, v.nome;
  end if;
  return v;
end;
$$;

-- criar/editar operador. Enquanto não existir nenhum gerente/administrador com
-- PIN, o primeiro cadastro é livre (é assim que o dono começa).
create or replace function public.pdv_salvar_operador(
  p_unidade uuid, p_id uuid, p_nome text, p_perfil text, p_ativo boolean,
  p_pin_novo text, p_pin_autorizador text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_tem_gestor boolean;
  v_id uuid;
  v_outro record;
  v_aut public.pdv_operadores;
begin
  select exists (
    select 1 from public.pdv_operadores
     where unidade_id = p_unidade and ativo and pin_hash is not null
       and perfil in ('gerente','administrador')
  ) into v_tem_gestor;

  if v_tem_gestor then
    v_aut := public.pdv_autorizar(p_unidade, p_pin_autorizador, 'gerenciar_operadores');
  elsif p_perfil not in ('gerente','administrador') then
    raise exception 'Cadastre primeiro um gerente ou administrador com PIN.';
  end if;

  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome.';
  end if;

  if p_pin_novo is not null and p_pin_novo <> '' then
    if p_pin_novo !~ '^[0-9]{4,6}$' then
      raise exception 'O PIN deve ter de 4 a 6 números.';
    end if;
    -- o PIN identifica a pessoa, então não pode repetir na mesma unidade
    for v_outro in
      select id, pin_hash from public.pdv_operadores
       where unidade_id = p_unidade and pin_hash is not null
         and id is distinct from p_id
    loop
      if v_outro.pin_hash = crypt(p_pin_novo, v_outro.pin_hash) then
        raise exception 'Esse PIN já é usado por outra pessoa. Escolha outro.';
      end if;
    end loop;
  end if;

  if p_id is null then
    if p_pin_novo is null or p_pin_novo = '' then
      raise exception 'Defina um PIN para o operador.';
    end if;
    insert into public.pdv_operadores (unidade_id, nome, perfil, ativo, pin_hash)
    values (p_unidade, trim(p_nome), p_perfil, coalesce(p_ativo, true), crypt(p_pin_novo, gen_salt('bf')))
    returning id into v_id;
  else
    update public.pdv_operadores
       set nome = trim(p_nome),
           perfil = p_perfil,
           ativo = coalesce(p_ativo, true),
           pin_hash = case when coalesce(p_pin_novo, '') <> ''
                           then crypt(p_pin_novo, gen_salt('bf')) else pin_hash end
     where id = p_id and unidade_id = p_unidade
    returning id into v_id;
  end if;

  insert into public.pdv_auditoria (unidade_id, acao, detalhes, autorizado_por, autorizado_por_nome)
  values (p_unidade, 'operador_salvo',
          jsonb_build_object('operador', trim(p_nome), 'perfil', p_perfil, 'ativo', coalesce(p_ativo, true),
                             'pin_alterado', coalesce(p_pin_novo, '') <> ''),
          v_aut.id, v_aut.nome);
  return v_id;
end;
$$;


-- =============================================================================
-- 3. AUDITORIA (só cresce: ninguém edita nem apaga pela API)
-- =============================================================================

create table if not exists public.pdv_auditoria (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  pedido_id uuid,
  acao text not null,
  motivo text,
  detalhes jsonb not null default '{}'::jsonb,
  operador_email text default (auth.jwt() ->> 'email'),  -- quem estava logado
  autorizado_por uuid,                                     -- quem digitou o PIN
  autorizado_por_nome text,
  terminal_id uuid,
  criado_em timestamptz not null default now()
);

create index if not exists idx_pdv_auditoria_pedido on public.pdv_auditoria (pedido_id);
create index if not exists idx_pdv_auditoria_unidade on public.pdv_auditoria (unidade_id, criado_em desc);


-- =============================================================================
-- 4. TERMINAIS, SETORES, IMPRESSORAS E ROTAS
-- =============================================================================

-- cada computador/tablet que usa o PDV; o id fica salvo no navegador
create table if not exists public.pdv_terminais (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  nome text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.pdv_setores (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  nome text not null,
  padrao boolean not null default false,   -- produto sem setor vai para este
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (unidade_id, nome)
);

-- setor de produção de cada item do cardápio
alter table public.ingredientes
  add column if not exists setor_id uuid references public.pdv_setores(id) on delete set null;

create or replace function public.pdv_garantir_setores(p_unidade uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.pdv_setores where unidade_id = p_unidade) then
    insert into public.pdv_setores (unidade_id, nome, padrao, ordem) values
      (p_unidade, 'Cozinha', true, 1),
      (p_unidade, 'Bar', false, 2),
      (p_unidade, 'Bebidas', false, 3),
      (p_unidade, 'Sobremesas', false, 4)
    on conflict do nothing;
  end if;
end;
$$;

create table if not exists public.pdv_impressoras (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  nome text not null,
  largura_mm int not null default 80 check (largura_mm in (58, 80)),
  -- 'navegador': a página /impressao imprime; 'escpos_*': fica para o agente local
  conexao text not null default 'navegador' check (conexao in ('navegador','escpos_rede','escpos_usb')),
  endereco text,                       -- IP:porta ou nome da porta USB (agente)
  copias int not null default 1 check (copias between 1 and 5),
  fonte text not null default 'normal' check (fonte in ('normal','grande')),
  cortar_papel boolean not null default true,
  ativo boolean not null default true,
  ultimo_sinal timestamptz,            -- última vez que uma estação/agente buscou a fila
  criado_em timestamptz not null default now()
);

-- documento 'producao' é por setor; 'conta' (pré-conta, comprovante, via) não tem setor.
-- terminal_id nulo = vale para todos os terminais; um terminal específico tem prioridade.
create table if not exists public.pdv_rotas_impressao (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  documento text not null check (documento in ('producao','conta')),
  setor_id uuid references public.pdv_setores(id) on delete cascade,
  terminal_id uuid references public.pdv_terminais(id) on delete cascade,
  impressora_id uuid not null references public.pdv_impressoras(id) on delete cascade,
  criado_em timestamptz not null default now(),
  check ((documento = 'producao') = (setor_id is not null))
);

create unique index if not exists uq_pdv_rotas
  on public.pdv_rotas_impressao (unidade_id, documento, setor_id, terminal_id) nulls not distinct;

create or replace function public.pdv_resolver_impressora(
  p_unidade uuid, p_documento text, p_setor uuid, p_terminal uuid
) returns uuid language sql stable security definer set search_path = public as $$
  select r.impressora_id
    from public.pdv_rotas_impressao r
    join public.pdv_impressoras i on i.id = r.impressora_id and i.ativo
   where r.unidade_id = p_unidade
     and r.documento = p_documento
     and r.setor_id is not distinct from p_setor
     and (r.terminal_id = p_terminal or r.terminal_id is null)
   order by (r.terminal_id is null)
   limit 1;
$$;


-- =============================================================================
-- 5. FILA DE IMPRESSÃO
-- =============================================================================
-- O conteúdo é uma "foto" em JSON: a reimpressão sai igual à original, e o
-- layout (58/80 mm, navegador ou ESC/POS) é montado na hora de imprimir.

create table if not exists public.pdv_impressoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  documento text not null check (documento in (
    'producao','cancelamento','alteracao','pre_conta','comprovante','via_estabelecimento'
  )),
  pedido_id uuid,
  setor_id uuid,
  impressora_id uuid references public.pdv_impressoras(id) on delete set null,
  titulo text not null,
  conteudo jsonb not null,
  status text not null default 'pendente'
    check (status in ('pendente','imprimindo','impresso','falha','sem_impressora')),
  tentativas int not null default 0,
  erro text,
  via int not null default 1,
  reimpressao_de uuid references public.pdv_impressoes(id) on delete set null,
  solicitado_por text default (auth.jwt() ->> 'email'),
  terminal_id uuid,
  estacao text,                 -- qual estação/agente imprimiu
  criado_em timestamptz not null default now(),
  pego_em timestamptz,
  impresso_em timestamptz
);

create index if not exists idx_pdv_impressoes_fila
  on public.pdv_impressoes (unidade_id, status, criado_em);
create index if not exists idx_pdv_impressoes_pedido on public.pdv_impressoes (pedido_id);

-- coloca um documento na fila, já escolhendo a impressora pela rota
create or replace function public.pdv_enfileirar(
  p_unidade uuid, p_documento text, p_pedido uuid, p_setor uuid, p_terminal uuid,
  p_titulo text, p_conteudo jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_impressora uuid;
  v_id uuid;
begin
  v_impressora := public.pdv_resolver_impressora(
    p_unidade,
    case when p_documento in ('producao','cancelamento','alteracao') then 'producao' else 'conta' end,
    p_setor, p_terminal);
  insert into public.pdv_impressoes
    (unidade_id, documento, pedido_id, setor_id, impressora_id, titulo, conteudo, status, terminal_id)
  values
    (p_unidade, p_documento, p_pedido, p_setor, v_impressora, p_titulo, p_conteudo,
     case when v_impressora is null then 'sem_impressora' else 'pendente' end, p_terminal)
  returning id into v_id;
  return v_id;
end;
$$;

-- a estação/agente pega os próximos trabalhos das suas impressoras. Quem ficou
-- "imprimindo" por mais de 2 minutos sem confirmação vira falha.
create or replace function public.pdv_pegar_impressoes(p_impressoras uuid[], p_estacao text)
returns setof public.pdv_impressoes language plpgsql security definer set search_path = public as $$
begin
  update public.pdv_impressoras set ultimo_sinal = now() where id = any(p_impressoras);

  update public.pdv_impressoes
     set status = 'falha', erro = 'A estação não confirmou a impressão'
   where status = 'imprimindo' and pego_em < now() - interval '2 minutes'
     and impressora_id = any(p_impressoras);

  return query
  update public.pdv_impressoes i
     set status = 'imprimindo', pego_em = now(), tentativas = i.tentativas + 1, estacao = p_estacao, erro = null
   where i.id in (
     select id from public.pdv_impressoes
      where status = 'pendente' and impressora_id = any(p_impressoras)
      order by criado_em
      limit 10
      for update skip locked
   )
  returning i.*;
end;
$$;

create or replace function public.pdv_confirmar_impressao(p_id uuid, p_ok boolean, p_erro text)
returns void language sql security definer set search_path = public as $$
  update public.pdv_impressoes
     set status = case when p_ok then 'impresso' else 'falha' end,
         impresso_em = case when p_ok then now() else impresso_em end,
         erro = case when p_ok then null else coalesce(p_erro, 'Falha ao imprimir') end
   where id = p_id;
$$;

-- tentar de novo: procura a impressora outra vez (a rota pode ter sido criada depois)
create or replace function public.pdv_tentar_novamente(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.pdv_impressoes;
  v_impressora uuid;
begin
  select * into v from public.pdv_impressoes where id = p_id for update;
  if v.status not in ('falha','sem_impressora','pendente') then
    raise exception 'Este documento não está com falha.';
  end if;
  v_impressora := coalesce(
    (select id from public.pdv_impressoras where id = v.impressora_id and ativo),
    public.pdv_resolver_impressora(
      v.unidade_id,
      case when v.documento in ('producao','cancelamento','alteracao') then 'producao' else 'conta' end,
      v.setor_id, v.terminal_id));
  update public.pdv_impressoes
     set impressora_id = v_impressora,
         status = case when v_impressora is null then 'sem_impressora' else 'pendente' end,
         erro = null
   where id = p_id;
end;
$$;

-- segunda via: copia o conteúdo original, marca a via e registra quem pediu
create or replace function public.pdv_reimprimir(p_id uuid, p_terminal uuid, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v public.pdv_impressoes;
  v_raiz uuid;
  v_via int;
  v_impressora uuid;
  v_novo uuid;
begin
  select * into v from public.pdv_impressoes where id = p_id;
  if not found then raise exception 'Documento não encontrado.'; end if;
  v_raiz := coalesce(v.reimpressao_de, v.id);
  select coalesce(max(via), 1) + 1 into v_via
    from public.pdv_impressoes where id = v_raiz or reimpressao_de = v_raiz;

  v_impressora := coalesce(
    public.pdv_resolver_impressora(
      v.unidade_id,
      case when v.documento in ('producao','cancelamento','alteracao') then 'producao' else 'conta' end,
      v.setor_id, p_terminal),
    (select id from public.pdv_impressoras where id = v.impressora_id and ativo));

  insert into public.pdv_impressoes
    (unidade_id, documento, pedido_id, setor_id, impressora_id, titulo, conteudo, status,
     via, reimpressao_de, terminal_id)
  values
    (v.unidade_id, v.documento, v.pedido_id, v.setor_id, v_impressora, v.titulo,
     v.conteudo || jsonb_build_object('reimpressao', jsonb_build_object(
       'via', v_via, 'por', auth.jwt() ->> 'email', 'em', now(), 'motivo', p_motivo)),
     case when v_impressora is null then 'sem_impressora' else 'pendente' end,
     v_via, v_raiz, p_terminal)
  returning id into v_novo;

  insert into public.pdv_auditoria (unidade_id, pedido_id, acao, motivo, detalhes, terminal_id)
  values (v.unidade_id, v.pedido_id, 'reimpressao', p_motivo,
          jsonb_build_object('documento', v.documento, 'titulo', v.titulo, 'via', v_via, 'original', v_raiz),
          p_terminal);
  return v_novo;
end;
$$;


-- =============================================================================
-- 6. PEDIDO E ITENS: colunas novas
-- =============================================================================

alter table public.pdv_pedidos
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists desconto numeric(12,2) not null default 0,
  add column if not exists desconto_pct numeric(5,2),           -- se foi em %, recalcula com os itens
  add column if not exists desconto_motivo text,
  add column if not exists desconto_autorizado_por text,
  add column if not exists taxa_servico_pct numeric(5,2),
  add column if not exists taxa_servico numeric(12,2) not null default 0,
  add column if not exists taxa_removida_por text,
  add column if not exists taxa_removida_motivo text,
  add column if not exists pessoas int not null default 1,
  add column if not exists para_viagem boolean not null default false,
  add column if not exists pre_conta_em timestamptz,
  add column if not exists fechado_por text,
  add column if not exists reaberturas int not null default 0;

alter table public.pdv_pedido_itens
  add column if not exists restricao text,                         -- alergia / restrição (destaque)
  add column if not exists adicionais jsonb not null default '[]'::jsonb,  -- [{nome, valor}]
  add column if not exists cortesia boolean not null default false,
  add column if not exists cancelado boolean not null default false,
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_motivo text,
  add column if not exists cancelado_por text;

-- valor de uma linha da comanda (cancelado e cortesia não cobram)
create or replace function public.pdv_valor_item(i public.pdv_pedido_itens)
returns numeric language sql immutable as $$
  select case when i.cancelado or i.cortesia then 0
    else round(i.quantidade * (i.preco_unitario + coalesce((
      select sum((a ->> 'valor')::numeric) from jsonb_array_elements(i.adicionais) a), 0)), 2)
  end;
$$;

-- taxa de serviço padrão ao abrir o pedido
create or replace function public.trg_pdv_pedido_taxa_padrao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v public.pdv_config;
begin
  if new.taxa_servico_pct is null then
    v := public.pdv_obter_config(new.unidade_id);
    new.taxa_servico_pct := case
      when new.canal = 'mesa' and v.taxa_servico_mesa then v.taxa_servico_pct
      when new.canal <> 'mesa' and v.taxa_servico_balcao then v.taxa_servico_pct
      else 0 end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pdv_pedido_taxa_padrao_bi on public.pdv_pedidos;
create trigger trg_pdv_pedido_taxa_padrao_bi
  before insert on public.pdv_pedidos
  for each row execute function public.trg_pdv_pedido_taxa_padrao();

-- total = itens - desconto + taxa de serviço. Só recalcula enquanto a conta
-- está aberta: conta fechada fica congelada.
create or replace function public.trg_pdv_pedido_totais()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sub numeric(12,2);
begin
  if new.status = 'aberto' or old.status = 'aberto' then
    select coalesce(sum(public.pdv_valor_item(i)), 0) into v_sub
      from public.pdv_pedido_itens i where i.pedido_id = new.id;
    new.subtotal := v_sub;
    if new.desconto_pct is not null then
      new.desconto := round(v_sub * new.desconto_pct / 100, 2);
    end if;
    new.desconto := least(greatest(coalesce(new.desconto, 0), 0), v_sub);
    new.taxa_servico := round((v_sub - new.desconto) * coalesce(new.taxa_servico_pct, 0) / 100, 2);
    new.total := v_sub - new.desconto + new.taxa_servico;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pdv_pedido_totais_bu on public.pdv_pedidos;
create trigger trg_pdv_pedido_totais_bu
  before update on public.pdv_pedidos
  for each row execute function public.trg_pdv_pedido_totais();

-- qualquer mudança nos itens recalcula o pedido (o nome "zz" faz este gatilho
-- rodar depois dos que já existiam)
create or replace function public.trg_pdv_itens_recalcular()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.pdv_pedidos set subtotal = subtotal
   where id = coalesce(new.pedido_id, old.pedido_id);
  return null;
end;
$$;

drop trigger if exists zz_pdv_itens_recalcular on public.pdv_pedido_itens;
create trigger zz_pdv_itens_recalcular
  after insert or update or delete on public.pdv_pedido_itens
  for each row execute function public.trg_pdv_itens_recalcular();

-- pedidos antigos: subtotal = total (não tinham desconto nem taxa)
-- (contas que já estavam abertas continuam sem taxa de serviço)
update public.pdv_pedidos set subtotal = total where subtotal = 0 and total > 0 and status <> 'aberto';
update public.pdv_pedidos set taxa_servico_pct = 0 where taxa_servico_pct is null;

-- forma_pagamento passa a aceitar 'multiplo' (várias formas) e 'fiado'
do $$
declare v_con record;
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'pdv_pedidos' and column_name = 'forma_pagamento')
     = 'USER-DEFINED' then
    alter table public.pdv_pedidos alter column forma_pagamento type text using forma_pagamento::text;
  end if;
  for v_con in
    select conname from pg_constraint
     where conrelid = 'public.pdv_pedidos'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%forma_pagamento%'
  loop
    execute format('alter table public.pdv_pedidos drop constraint %I', v_con.conname);
  end loop;
end $$;


-- =============================================================================
-- 7. CONTEÚDO DOS DOCUMENTOS
-- =============================================================================

-- como o pedido aparece no topo de qualquer ticket
create or replace function public.pdv_identificacao(p public.pdv_pedidos)
returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when p.canal = 'mesa' then jsonb_build_object(
      'modo', 'mesa',
      'rotulo', 'MESA ' || coalesce((select numero::text from public.pdv_mesas where id = p.mesa_id), '?'))
    when p.para_viagem then jsonb_build_object('modo', 'retirada', 'rotulo', 'RETIRADA · SENHA ' || p.numero)
    else jsonb_build_object('modo', 'senha', 'rotulo', 'SENHA ' || p.numero)
  end || jsonb_build_object('pedido', p.numero, 'cliente', p.nome_cliente);
$$;

create or replace function public.pdv_cabecalho_loja(p_unidade uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nome', c.nome_estabelecimento, 'documento', c.documento,
    'endereco', c.endereco, 'telefone', c.telefone,
    'rodape', coalesce(c.rodape, 'Obrigado pela preferência!'))
  from (select 1) x
  left join public.pdv_config c on c.unidade_id = p_unidade;
$$;

create or replace function public.pdv_nome_terminal(p_terminal uuid)
returns text language sql stable security definer set search_path = public as $$
  select nome from public.pdv_terminais where id = p_terminal;
$$;

-- pré-conta, comprovante e via do estabelecimento usam o mesmo conteúdo
create or replace function public.pdv_conteudo_conta(p_pedido uuid, p_terminal uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_itens jsonb;
  v_pagamentos jsonb;
  v_pago numeric;
  v_troco numeric;
begin
  select * into p from public.pdv_pedidos where id = p_pedido;

  select coalesce(jsonb_agg(jsonb_build_object(
           'quantidade', i.quantidade, 'nome', i.nome,
           'preco_unitario', i.preco_unitario, 'adicionais', i.adicionais,
           'cortesia', i.cortesia, 'cancelado', i.cancelado,
           'valor', public.pdv_valor_item(i)) order by i.criado_em), '[]'::jsonb)
    into v_itens
    from public.pdv_pedido_itens i
   where i.pedido_id = p_pedido;

  select coalesce(jsonb_agg(jsonb_build_object(
           'forma', g.forma, 'valor', g.valor, 'recebido', g.valor_recebido,
           'troco', g.troco, 'pagador', g.pagador, 'transacao', g.transacao_id) order by g.criado_em), '[]'::jsonb),
         coalesce(sum(g.valor), 0), coalesce(sum(g.troco), 0)
    into v_pagamentos, v_pago, v_troco
    from public.pdv_pagamentos g
   where g.pedido_id = p_pedido and g.status = 'confirmado';

  return jsonb_build_object(
    'loja', public.pdv_cabecalho_loja(p.unidade_id),
    'identificacao', public.pdv_identificacao(p),
    'aberto_em', p.criado_em,
    'emitido_em', now(),
    'operador', auth.jwt() ->> 'email',
    'terminal', public.pdv_nome_terminal(p_terminal),
    'itens', v_itens,
    'subtotal', p.subtotal,
    'desconto', p.desconto,
    'desconto_motivo', p.desconto_motivo,
    'taxa_servico_pct', p.taxa_servico_pct,
    'taxa_servico', p.taxa_servico,
    'total', p.total,
    'pessoas', p.pessoas,
    'pagamentos', v_pagamentos,
    'pago', v_pago,
    'troco', v_troco,
    'restante', greatest(p.total - v_pago, 0)
  );
end;
$$;


-- =============================================================================
-- 8. ENVIO PARA A PRODUÇÃO (com impressão automática por setor)
-- =============================================================================
-- Só os itens ainda não enviados entram no ticket; se a mesa já tinha itens
-- na produção, o ticket sai marcado como ACRÉSCIMO.

create or replace function public.pdv_enviar_producao(
  p_pedido uuid, p_itens_sem_estoque uuid[], p_terminal uuid
) returns int language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_cfg public.pdv_config;
  v_acrescimo boolean;
  v_ids uuid[];
  v_setor record;
  v_qtd int := 0;
begin
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Este pedido não está aberto.'; end if;

  perform public.pdv_garantir_setores(p.unidade_id);
  v_cfg := public.pdv_obter_config(p.unidade_id);

  v_acrescimo := exists (
    select 1 from public.pdv_pedido_itens
     where pedido_id = p_pedido and status_cozinha is not null and not cancelado);

  select array_agg(id) into v_ids from public.pdv_pedido_itens
   where pedido_id = p_pedido and status_cozinha is null and not cancelado;
  if v_ids is null then return 0; end if;

  update public.pdv_pedido_itens
     set sem_estoque = true
   where id = any(v_ids) and id = any(coalesce(p_itens_sem_estoque, '{}'));

  update public.pdv_pedido_itens
     set status_cozinha = 'novo', enviado_cozinha_em = now()
   where id = any(v_ids);
  v_qtd := array_length(v_ids, 1);

  if not v_cfg.imprimir_producao_auto then return v_qtd; end if;

  -- um ticket por setor (sem setor padrão, sai como "Produção" e fica sem impressora)
  for v_setor in
    select s.id, coalesce(s.nome, 'Produção') as nome,
           jsonb_agg(jsonb_build_object(
             'quantidade', i.quantidade, 'nome', i.nome, 'observacao', i.observacao,
             'restricao', i.restricao, 'adicionais', i.adicionais, 'sem_estoque', i.sem_estoque)
             order by i.criado_em) as itens
      from public.pdv_pedido_itens i
      left join public.ingredientes g on g.id = i.produto_id
      left join public.pdv_setores s on s.id = coalesce(
             (select id from public.pdv_setores where id = g.setor_id and ativo),
             (select id from public.pdv_setores where unidade_id = p.unidade_id and padrao limit 1))
     where i.id = any(v_ids)
     group by s.id, s.nome
  loop
    perform public.pdv_enfileirar(
      p.unidade_id, 'producao', p.id, v_setor.id, p_terminal,
      (public.pdv_identificacao(p) ->> 'rotulo') || ' · ' || v_setor.nome,
      jsonb_build_object(
        'setor', v_setor.nome,
        'identificacao', public.pdv_identificacao(p),
        'acrescimo', v_acrescimo,
        'emitido_em', now(),
        'operador', auth.jwt() ->> 'email',
        'terminal', public.pdv_nome_terminal(p_terminal),
        'itens', v_setor.itens));
  end loop;

  return v_qtd;
end;
$$;

-- setor de um item (para os tickets de cancelamento/alteração)
create or replace function public.pdv_setor_do_item(i public.pdv_pedido_itens, p_unidade uuid)
returns public.pdv_setores language sql stable security definer set search_path = public as $$
  select s.* from public.pdv_setores s
   where s.id = coalesce(
     (select st.id from public.ingredientes g join public.pdv_setores st on st.id = g.setor_id and st.ativo
       where g.id = i.produto_id),
     (select id from public.pdv_setores where unidade_id = p_unidade and padrao limit 1));
$$;


-- =============================================================================
-- 9. ITENS: alterar e cancelar
-- =============================================================================

-- observação/restrição/adicionais. Antes do envio é livre; depois do envio,
-- a produção recebe um ticket de ALTERAÇÃO (adicionais com preço não mudam
-- depois do envio: cancele e lance de novo).
create or replace function public.pdv_alterar_item(
  p_item uuid, p_observacao text, p_restricao text, p_adicionais jsonb,
  p_separar_um boolean, p_terminal uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  i public.pdv_pedido_itens;
  p public.pdv_pedidos;
  v_alvo uuid := p_item;
  v_setor public.pdv_setores;
begin
  select * into i from public.pdv_pedido_itens where id = p_item for update;
  select * into p from public.pdv_pedidos where id = i.pedido_id;
  if p.status <> 'aberto' then raise exception 'Este pedido não está aberto.'; end if;
  if i.cancelado then raise exception 'Este item foi cancelado.'; end if;

  if i.status_cozinha is not null then
    if p_adicionais is not null and p_adicionais <> i.adicionais then
      raise exception 'Adicionais não mudam depois do envio. Cancele o item e lance de novo.';
    end if;
    if p_separar_um then
      raise exception 'Itens já enviados não podem ser separados.';
    end if;
  end if;

  -- "só para 1 unidade": tira 1 da linha e cria uma linha nova com a mudança
  if p_separar_um and i.quantidade > 1 then
    update public.pdv_pedido_itens set quantidade = quantidade - 1 where id = i.id;
    insert into public.pdv_pedido_itens (pedido_id, produto_id, nome, quantidade, preco_unitario)
    values (i.pedido_id, i.produto_id, i.nome, 1, i.preco_unitario)
    returning id into v_alvo;
  end if;

  update public.pdv_pedido_itens
     set observacao = nullif(trim(p_observacao), ''),
         restricao = nullif(trim(p_restricao), ''),
         adicionais = case when i.status_cozinha is null then coalesce(p_adicionais, '[]'::jsonb) else adicionais end
   where id = v_alvo;

  if i.status_cozinha is not null
     and (i.observacao is distinct from nullif(trim(p_observacao), '')
          or i.restricao is distinct from nullif(trim(p_restricao), '')) then
    v_setor := public.pdv_setor_do_item(i, p.unidade_id);
    perform public.pdv_enfileirar(
      p.unidade_id, 'alteracao', p.id, v_setor.id, p_terminal,
      (public.pdv_identificacao(p) ->> 'rotulo') || ' · ALTERAÇÃO',
      jsonb_build_object(
        'setor', v_setor.nome, 'identificacao', public.pdv_identificacao(p),
        'emitido_em', now(), 'operador', auth.jwt() ->> 'email',
        'terminal', public.pdv_nome_terminal(p_terminal),
        'itens', jsonb_build_array(jsonb_build_object(
          'quantidade', i.quantidade, 'nome', i.nome,
          'observacao', nullif(trim(p_observacao), ''), 'restricao', nullif(trim(p_restricao), ''),
          'antes', jsonb_build_object('observacao', i.observacao, 'restricao', i.restricao)))));
    insert into public.pdv_auditoria (unidade_id, pedido_id, acao, detalhes, terminal_id)
    values (p.unidade_id, p.id, 'alterar_item',
            jsonb_build_object('item', i.nome, 'antes', jsonb_build_object('observacao', i.observacao, 'restricao', i.restricao),
                               'depois', jsonb_build_object('observacao', nullif(trim(p_observacao), ''),
                                                            'restricao', nullif(trim(p_restricao), ''))),
            p_terminal);
  end if;

  return v_alvo;
end;
$$;

-- cancelar item que JÁ FOI para a produção (antes do envio é só tirar da comanda).
-- Cancela p_quantidade unidades; o restante continua na comanda.
create or replace function public.pdv_cancelar_item(
  p_item uuid, p_quantidade numeric, p_motivo text, p_devolver_estoque boolean,
  p_pin text, p_terminal uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  i public.pdv_pedido_itens;
  p public.pdv_pedidos;
  v_aut public.pdv_operadores;
  v_alvo uuid := p_item;
  v_setor public.pdv_setores;
begin
  select * into i from public.pdv_pedido_itens where id = p_item for update;
  select * into p from public.pdv_pedidos where id = i.pedido_id for update;
  if p.status <> 'aberto' then raise exception 'Este pedido não está aberto.'; end if;
  if i.cancelado then raise exception 'Este item já foi cancelado.'; end if;
  if i.status_cozinha is null then raise exception 'Item ainda não enviado: é só tirar da comanda.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if p_quantidade is null or p_quantidade <= 0 or p_quantidade > i.quantidade then
    raise exception 'Quantidade inválida.';
  end if;

  v_aut := public.pdv_autorizar(p.unidade_id, p_pin, 'cancelar_item');

  -- cancelamento parcial: separa as unidades canceladas numa linha própria
  if p_quantidade < i.quantidade then
    update public.pdv_pedido_itens set quantidade = quantidade - p_quantidade where id = i.id;
    insert into public.pdv_pedido_itens
      (pedido_id, produto_id, nome, quantidade, preco_unitario, observacao, restricao, adicionais,
       status_cozinha, enviado_cozinha_em, iniciado_em, pronto_em, sem_estoque)
    values
      (i.pedido_id, i.produto_id, i.nome, p_quantidade, i.preco_unitario, i.observacao, i.restricao, i.adicionais,
       i.status_cozinha, i.enviado_cozinha_em, i.iniciado_em, i.pronto_em, i.sem_estoque)
    returning id into v_alvo;
  elsif p_devolver_estoque and i.status_cozinha = 'pronto' then
    -- item inteiro já baixado: devolve ao estoque (não foi consumido)
    perform public.pdv_estornar_estoque_item(i.id);
  end if;

  update public.pdv_pedido_itens
     set cancelado = true, cancelado_em = now(), cancelado_motivo = trim(p_motivo),
         cancelado_por = v_aut.nome
   where id = v_alvo;

  v_setor := public.pdv_setor_do_item(i, p.unidade_id);
  perform public.pdv_enfileirar(
    p.unidade_id, 'cancelamento', p.id, v_setor.id, p_terminal,
    (public.pdv_identificacao(p) ->> 'rotulo') || ' · CANCELAMENTO',
    jsonb_build_object(
      'setor', v_setor.nome, 'identificacao', public.pdv_identificacao(p),
      'emitido_em', now(), 'operador', auth.jwt() ->> 'email',
      'terminal', public.pdv_nome_terminal(p_terminal),
      'autorizado_por', v_aut.nome, 'motivo', trim(p_motivo),
      'itens', jsonb_build_array(jsonb_build_object(
        'quantidade', p_quantidade, 'nome', i.nome, 'observacao', i.observacao))));

  insert into public.pdv_auditoria
    (unidade_id, pedido_id, acao, motivo, detalhes, autorizado_por, autorizado_por_nome, terminal_id)
  values
    (p.unidade_id, p.id, 'cancelar_item', trim(p_motivo),
     jsonb_build_object('item', i.nome, 'quantidade', p_quantidade,
                        'valor', round(p_quantidade * i.preco_unitario, 2),
                        'status_producao', i.status_cozinha, 'devolveu_estoque', p_devolver_estoque),
     v_aut.id, v_aut.nome, p_terminal);
end;
$$;

-- cortesia: o item continua na conta, mas com valor zero
create or replace function public.pdv_cortesia_item(
  p_item uuid, p_cortesia boolean, p_motivo text, p_pin text, p_terminal uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  i public.pdv_pedido_itens;
  p public.pdv_pedidos;
  v_aut public.pdv_operadores;
begin
  select * into i from public.pdv_pedido_itens where id = p_item for update;
  select * into p from public.pdv_pedidos where id = i.pedido_id;
  if p.status <> 'aberto' then raise exception 'Este pedido não está aberto.'; end if;
  if p_cortesia and coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo da cortesia.'; end if;
  v_aut := public.pdv_autorizar(p.unidade_id, p_pin, 'cortesia');
  update public.pdv_pedido_itens set cortesia = p_cortesia where id = p_item;
  insert into public.pdv_auditoria
    (unidade_id, pedido_id, acao, motivo, detalhes, autorizado_por, autorizado_por_nome, terminal_id)
  values
    (p.unidade_id, p.id, case when p_cortesia then 'cortesia' else 'cortesia_removida' end, p_motivo,
     jsonb_build_object('item', i.nome, 'quantidade', i.quantidade, 'valor', public.pdv_valor_item(i)),
     v_aut.id, v_aut.nome, p_terminal);
end;
$$;


-- =============================================================================
-- 10. DESCONTO E TAXA DE SERVIÇO
-- =============================================================================

-- p_valor em R$ ou p_pct em %. Caixa tem limite (pdv_config.desconto_max_caixa_pct).
create or replace function public.pdv_aplicar_desconto(
  p_pedido uuid, p_valor numeric, p_pct numeric, p_motivo text, p_pin text, p_terminal uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_cfg public.pdv_config;
  v_aut public.pdv_operadores;
  v_pct_efetivo numeric;
begin
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Este pedido não está aberto.'; end if;
  if exists (select 1 from public.pdv_pagamentos where pedido_id = p_pedido and status = 'confirmado') then
    raise exception 'Já há pagamento lançado. Estorne os pagamentos antes de mudar o desconto.';
  end if;

  if coalesce(p_valor, 0) = 0 and coalesce(p_pct, 0) = 0 then
    -- tirar o desconto também fica registrado
    update public.pdv_pedidos
       set desconto = 0, desconto_pct = null, desconto_motivo = null, desconto_autorizado_por = null
     where id = p_pedido;
    insert into public.pdv_auditoria (unidade_id, pedido_id, acao, detalhes, terminal_id)
    values (p.unidade_id, p.id, 'desconto_removido', jsonb_build_object('valor_anterior', p.desconto), p_terminal);
    return;
  end if;

  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo do desconto.'; end if;
  if p_pct is not null and (p_pct <= 0 or p_pct > 100) then raise exception 'Percentual inválido.'; end if;
  if p_valor is not null and (p_valor <= 0 or p_valor > p.subtotal) then
    raise exception 'O desconto não pode passar do valor dos itens.';
  end if;

  v_aut := public.pdv_autorizar(p.unidade_id, p_pin, 'desconto');
  v_cfg := public.pdv_obter_config(p.unidade_id);
  v_pct_efetivo := coalesce(p_pct, case when p.subtotal > 0 then p_valor * 100 / p.subtotal else 100 end);
  if v_aut.perfil = 'caixa' and v_pct_efetivo > v_cfg.desconto_max_caixa_pct then
    raise exception 'O caixa pode dar até % por cento de desconto. Peça o PIN de um gerente.', v_cfg.desconto_max_caixa_pct;
  end if;

  update public.pdv_pedidos
     set desconto_pct = p_pct,
         desconto = case when p_pct is null then p_valor else desconto end,
         desconto_motivo = trim(p_motivo),
         desconto_autorizado_por = v_aut.nome
   where id = p_pedido;

  insert into public.pdv_auditoria
    (unidade_id, pedido_id, acao, motivo, detalhes, autorizado_por, autorizado_por_nome, terminal_id)
  values
    (p.unidade_id, p.id, 'desconto', trim(p_motivo),
     jsonb_build_object('valor', p_valor, 'pct', p_pct, 'subtotal', p.subtotal),
     v_aut.id, v_aut.nome, p_terminal);
end;
$$;

-- tirar ou devolver a taxa de serviço (o cliente pode recusar a taxa)
create or replace function public.pdv_definir_taxa_servico(
  p_pedido uuid, p_cobrar boolean, p_motivo text, p_pin text, p_terminal uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_cfg public.pdv_config;
  v_aut public.pdv_operadores;
begin
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Este pedido não está aberto.'; end if;
  if exists (select 1 from public.pdv_pagamentos where pedido_id = p_pedido and status = 'confirmado') then
    raise exception 'Já há pagamento lançado. Estorne os pagamentos antes de mudar a taxa.';
  end if;
  v_cfg := public.pdv_obter_config(p.unidade_id);

  if p_cobrar then
    update public.pdv_pedidos
       set taxa_servico_pct = v_cfg.taxa_servico_pct, taxa_removida_por = null, taxa_removida_motivo = null
     where id = p_pedido;
    insert into public.pdv_auditoria (unidade_id, pedido_id, acao, detalhes, terminal_id)
    values (p.unidade_id, p.id, 'taxa_incluida', jsonb_build_object('pct', v_cfg.taxa_servico_pct), p_terminal);
    return;
  end if;

  if v_cfg.remover_taxa_exige_pin then
    v_aut := public.pdv_autorizar(p.unidade_id, p_pin, 'remover_taxa');
  end if;
  update public.pdv_pedidos
     set taxa_servico_pct = 0,
         taxa_removida_por = coalesce(v_aut.nome, auth.jwt() ->> 'email'),
         taxa_removida_motivo = nullif(trim(p_motivo), '')
   where id = p_pedido;
  insert into public.pdv_auditoria
    (unidade_id, pedido_id, acao, motivo, detalhes, autorizado_por, autorizado_por_nome, terminal_id)
  values
    (p.unidade_id, p.id, 'taxa_removida', nullif(trim(p_motivo), ''),
     jsonb_build_object('pct_anterior', p.taxa_servico_pct, 'valor_anterior', p.taxa_servico),
     v_aut.id, v_aut.nome, p_terminal);
end;
$$;


-- =============================================================================
-- 11. PAGAMENTOS
-- =============================================================================
-- Cada pagamento tem uma chave criada no navegador antes de enviar. Se a
-- internet cair e o botão for clicado de novo, a mesma chave devolve o
-- pagamento que já existe: não cobra duas vezes.

create table if not exists public.pdv_pagamentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  pedido_id uuid not null references public.pdv_pedidos(id) on delete restrict,
  caixa_id uuid references public.pdv_caixas(id),
  forma text not null check (forma in (
    'dinheiro','pix','cartao_credito','cartao_debito','vale_refeicao','outro','fiado'
  )),
  valor numeric(12,2) not null check (valor > 0),    -- quanto abateu da conta
  valor_recebido numeric(12,2),                      -- dinheiro entregue pelo cliente
  troco numeric(12,2) not null default 0,
  pagador text,                                      -- "Pessoa 2", "João"...
  itens jsonb,                                       -- divisão por item: ids pagos
  transacao_id text,                                 -- NSU/autorização da maquininha, id do Pix
  chave_idempotencia uuid not null unique,
  status text not null default 'confirmado' check (status in ('confirmado','estornado')),
  operador_email text default (auth.jwt() ->> 'email'),
  terminal_id uuid,
  criado_em timestamptz not null default now(),
  estornado_em timestamptz,
  estornado_por text,
  estorno_motivo text
);

create index if not exists idx_pdv_pagamentos_pedido on public.pdv_pagamentos (pedido_id);
create index if not exists idx_pdv_pagamentos_caixa on public.pdv_pagamentos (caixa_id);
create index if not exists idx_pdv_pagamentos_data on public.pdv_pagamentos (unidade_id, criado_em);

create or replace function public.pdv_registrar_pagamento(
  p_pedido uuid, p_forma text, p_valor numeric, p_valor_recebido numeric,
  p_pagador text, p_transacao text, p_itens jsonb, p_chave uuid, p_terminal uuid
) returns public.pdv_pagamentos language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_cfg public.pdv_config;
  v_existente public.pdv_pagamentos;
  v_pago numeric;
  v_restante numeric;
  v_valor numeric;
  v_recebido numeric;
  v_caixa uuid;
  v_novo public.pdv_pagamentos;
begin
  select * into v_existente from public.pdv_pagamentos where chave_idempotencia = p_chave;
  if found then return v_existente; end if;

  if p_forma = 'fiado' then raise exception 'Use "Fechar com pendência" para deixar valor a receber.'; end if;
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Esta conta não está aberta.'; end if;
  v_cfg := public.pdv_obter_config(p.unidade_id);

  select id into v_caixa from public.pdv_caixas where unidade_id = p.unidade_id and status = 'aberto';
  if v_caixa is null and v_cfg.exigir_caixa_aberto then
    raise exception 'Abra o caixa antes de receber pagamentos.';
  end if;

  select coalesce(sum(valor), 0) into v_pago
    from public.pdv_pagamentos where pedido_id = p_pedido and status = 'confirmado';
  v_restante := p.total - v_pago;
  if v_restante <= 0 then raise exception 'Esta conta já está paga.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor.'; end if;

  if p_forma = 'dinheiro' then
    -- dinheiro pode vir a mais: abate só o que falta e o resto é troco
    v_valor := least(p_valor, v_restante);
    v_recebido := greatest(coalesce(p_valor_recebido, p_valor), p_valor);
  else
    if p_valor > v_restante + 0.005 then
      raise exception 'O valor (R$ %) é maior que o que falta (R$ %).',
        replace(to_char(p_valor, 'FM999999990.00'), '.', ','),
        replace(to_char(v_restante, 'FM999999990.00'), '.', ',');
    end if;
    v_valor := p_valor;
    v_recebido := null;
  end if;

  insert into public.pdv_pagamentos
    (unidade_id, pedido_id, caixa_id, forma, valor, valor_recebido, troco, pagador, itens,
     transacao_id, chave_idempotencia, terminal_id)
  values
    (p.unidade_id, p.id, v_caixa, p_forma, round(v_valor, 2), v_recebido,
     case when v_recebido is null then 0 else round(v_recebido - v_valor, 2) end,
     nullif(trim(p_pagador), ''), p_itens, nullif(trim(p_transacao), ''), p_chave, p_terminal)
  returning * into v_novo;
  return v_novo;
end;
$$;

create or replace function public.pdv_estornar_pagamento(
  p_pagamento uuid, p_motivo text, p_pin text, p_terminal uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  g public.pdv_pagamentos;
  p public.pdv_pedidos;
  v_aut public.pdv_operadores;
begin
  select * into g from public.pdv_pagamentos where id = p_pagamento for update;
  select * into p from public.pdv_pedidos where id = g.pedido_id for update;
  if g.status <> 'confirmado' then raise exception 'Este pagamento já foi estornado.'; end if;
  if p.status <> 'aberto' then raise exception 'Reabra a conta antes de estornar um pagamento.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo do estorno.'; end if;
  v_aut := public.pdv_autorizar(p.unidade_id, p_pin, 'estornar_pagamento');

  update public.pdv_pagamentos
     set status = 'estornado', estornado_em = now(), estornado_por = v_aut.nome, estorno_motivo = trim(p_motivo)
   where id = p_pagamento;

  -- pendência estornada: a conta a receber criada no fechamento é cancelada
  if g.forma = 'fiado' then
    update public.contas_receber set status = 'cancelada'
     where pdv_pagamento_id = g.id and status = 'aberta';
  end if;

  insert into public.pdv_auditoria
    (unidade_id, pedido_id, acao, motivo, detalhes, autorizado_por, autorizado_por_nome, terminal_id)
  values
    (p.unidade_id, p.id, 'estornar_pagamento', trim(p_motivo),
     jsonb_build_object('forma', g.forma, 'valor', g.valor, 'transacao', g.transacao_id, 'pagador', g.pagador),
     v_aut.id, v_aut.nome, p_terminal);
end;
$$;


-- =============================================================================
-- 12. FECHAMENTO, PENDÊNCIA E REABERTURA
-- =============================================================================

create table if not exists public.pdv_fechamentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  pedido_id uuid not null references public.pdv_pedidos(id) on delete restrict,
  versao int not null,                        -- 1 = primeiro fechamento, 2 = depois de reabrir...
  conteudo jsonb not null,                    -- itens, totais e pagamentos naquele momento
  total numeric(12,2) not null,
  fechado_em timestamptz not null default now(),
  fechado_por text default (auth.jwt() ->> 'email'),
  terminal_id uuid,
  reaberto_em timestamptz,
  reaberto_por text,
  reaberto_motivo text,
  unique (pedido_id, versao)
);

-- liga a conta a receber ao pagamento "fiado" do PDV (o painel não soma duas vezes)
alter table public.contas_receber
  add column if not exists pdv_pedido_id uuid,
  add column if not exists pdv_pagamento_id uuid;

-- fecha a conta: só se o que foi pago cobre o total
create or replace function public.pdv_fechar_conta(p_pedido uuid, p_terminal uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_cfg public.pdv_config;
  v_pago numeric;
  v_formas text[];
  v_versao int;
  v_conteudo jsonb;
  v_id uuid;
begin
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Esta conta não está aberta.'; end if;
  if not exists (select 1 from public.pdv_pedido_itens where pedido_id = p_pedido and not cancelado) then
    raise exception 'A conta não tem itens. Para desistir, cancele o pedido.';
  end if;

  select coalesce(sum(valor), 0), array_agg(distinct forma)
    into v_pago, v_formas
    from public.pdv_pagamentos where pedido_id = p_pedido and status = 'confirmado';
  if v_pago < p.total - 0.005 then
    raise exception 'Ainda falta receber R$ %.', replace(to_char(p.total - v_pago, 'FM999999990.00'), '.', ',');
  end if;

  v_conteudo := public.pdv_conteudo_conta(p_pedido, p_terminal);
  select coalesce(max(versao), 0) + 1 into v_versao from public.pdv_fechamentos where pedido_id = p_pedido;

  insert into public.pdv_fechamentos (unidade_id, pedido_id, versao, conteudo, total, terminal_id)
  values (p.unidade_id, p.id, v_versao, v_conteudo, p.total, p_terminal)
  returning id into v_id;

  update public.pdv_pedidos
     set status = 'fechado',
         fechado_em = now(),
         fechado_por = auth.jwt() ->> 'email',
         forma_pagamento = case
           when coalesce(array_length(v_formas, 1), 0) = 0 then 'outro'   -- conta zerada (cortesia total)
           when array_length(v_formas, 1) = 1 then v_formas[1]
           else 'multiplo' end
   where id = p_pedido;

  v_cfg := public.pdv_obter_config(p.unidade_id);
  if v_cfg.imprimir_comprovante_auto then
    perform public.pdv_enfileirar(p.unidade_id, 'comprovante', p.id, null, p_terminal,
      (v_conteudo -> 'identificacao' ->> 'rotulo') || ' · Comprovante', v_conteudo);
  end if;
  if v_cfg.imprimir_via_estabelecimento then
    perform public.pdv_enfileirar(p.unidade_id, 'via_estabelecimento', p.id, null, p_terminal,
      (v_conteudo -> 'identificacao' ->> 'rotulo') || ' · Via do estabelecimento', v_conteudo);
  end if;
  return v_id;
end;
$$;

-- fechar deixando o resto "a receber" (fiado/convênio). Vira conta a receber
-- no Financeiro, com autorização de gerente.
create or replace function public.pdv_fechar_com_pendencia(
  p_pedido uuid, p_devedor text, p_vencimento date, p_motivo text, p_pin text,
  p_chave uuid, p_terminal uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_aut public.pdv_operadores;
  v_pago numeric;
  v_restante numeric;
  v_pag uuid;
  v_rotulo text;
begin
  -- clique repetido: a pendência já foi lançada e a conta fechada
  if exists (select 1 from public.pdv_pagamentos where chave_idempotencia = p_chave) then
    return (select id from public.pdv_fechamentos where pedido_id = p_pedido order by versao desc limit 1);
  end if;
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Esta conta não está aberta.'; end if;
  if coalesce(trim(p_devedor), '') = '' then raise exception 'Informe quem vai pagar depois.'; end if;
  if p_vencimento is null then raise exception 'Informe o vencimento.'; end if;
  v_aut := public.pdv_autorizar(p.unidade_id, p_pin, 'fechar_pendente');

  select coalesce(sum(valor), 0) into v_pago
    from public.pdv_pagamentos where pedido_id = p_pedido and status = 'confirmado';
  v_restante := round(p.total - v_pago, 2);
  if v_restante <= 0 then raise exception 'Não há valor pendente.'; end if;

  insert into public.pdv_pagamentos
    (unidade_id, pedido_id, caixa_id, forma, valor, pagador, chave_idempotencia, terminal_id)
  values
    (p.unidade_id, p.id,
     (select id from public.pdv_caixas where unidade_id = p.unidade_id and status = 'aberto'),
     'fiado', v_restante, trim(p_devedor), p_chave, p_terminal)
  returning id into v_pag;

  v_rotulo := public.pdv_identificacao(p) ->> 'rotulo';
  insert into public.contas_receber
    (unidade_id, descricao, categoria, devedor, valor, vencimento, observacao, pdv_pedido_id, pdv_pagamento_id)
  values
    (p.unidade_id, 'Conta do PDV — ' || initcap(lower(v_rotulo)) || ' (pedido #' || p.numero || ')',
     'fiado', trim(p_devedor), v_restante, p_vencimento,
     'Autorizado por ' || v_aut.nome || coalesce('. ' || nullif(trim(p_motivo), ''), ''),
     p.id, v_pag);

  insert into public.pdv_auditoria
    (unidade_id, pedido_id, acao, motivo, detalhes, autorizado_por, autorizado_por_nome, terminal_id)
  values
    (p.unidade_id, p.id, 'fechar_pendente', nullif(trim(p_motivo), ''),
     jsonb_build_object('devedor', trim(p_devedor), 'valor', v_restante, 'vencimento', p_vencimento),
     v_aut.id, v_aut.nome, p_terminal);

  return public.pdv_fechar_conta(p_pedido, p_terminal);
end;
$$;

-- reabrir: nada é apagado. O fechamento anterior fica guardado com quem
-- reabriu e por quê; os pagamentos continuam valendo (estorne se precisar).
create or replace function public.pdv_reabrir_conta(
  p_pedido uuid, p_motivo text, p_pin text, p_terminal uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_aut public.pdv_operadores;
begin
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'fechado' then raise exception 'Só dá para reabrir uma conta fechada.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo da reabertura.'; end if;
  if p.mesa_id is not null and exists (
    select 1 from public.pdv_pedidos where mesa_id = p.mesa_id and status = 'aberto' and id <> p.id) then
    raise exception 'A mesa já tem outra conta aberta. Feche-a antes de reabrir esta.';
  end if;
  v_aut := public.pdv_autorizar(p.unidade_id, p_pin, 'reabrir_conta');

  update public.pdv_fechamentos
     set reaberto_em = now(), reaberto_por = v_aut.nome, reaberto_motivo = trim(p_motivo)
   where pedido_id = p_pedido and reaberto_em is null;

  update public.pdv_pedidos
     set status = 'aberto', fechado_em = null, fechado_por = null, reaberturas = reaberturas + 1
   where id = p_pedido;

  insert into public.pdv_auditoria
    (unidade_id, pedido_id, acao, motivo, detalhes, autorizado_por, autorizado_por_nome, terminal_id)
  values
    (p.unidade_id, p.id, 'reabrir_conta', trim(p_motivo),
     jsonb_build_object('total_fechado', p.total, 'fechado_em', p.fechado_em, 'fechado_por', p.fechado_por),
     v_aut.id, v_aut.nome, p_terminal);
end;
$$;

-- pré-conta: conferência do cliente. Marca a mesa como "conta pedida".
create or replace function public.pdv_imprimir_pre_conta(p_pedido uuid, p_pessoas int, p_terminal uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_conteudo jsonb;
begin
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Esta conta não está aberta.'; end if;
  update public.pdv_pedidos
     set pre_conta_em = now(), pessoas = greatest(coalesce(p_pessoas, pessoas), 1)
   where id = p_pedido;
  v_conteudo := public.pdv_conteudo_conta(p_pedido, p_terminal);
  return public.pdv_enfileirar(p.unidade_id, 'pre_conta', p.id, null, p_terminal,
    (v_conteudo -> 'identificacao' ->> 'rotulo') || ' · Pré-conta', v_conteudo);
end;
$$;

-- cancelar o pedido inteiro: sem nada enviado é livre; com itens na produção
-- ou pagamento lançado, precisa de gerente
create or replace function public.pdv_cancelar_pedido(
  p_pedido uuid, p_motivo text, p_pin text, p_terminal uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  p public.pdv_pedidos;
  v_aut public.pdv_operadores;
  v_enviados int;
  i public.pdv_pedido_itens;
  v_setor public.pdv_setores;
begin
  select * into p from public.pdv_pedidos where id = p_pedido for update;
  if p.status <> 'aberto' then raise exception 'Este pedido não está aberto.'; end if;
  if exists (select 1 from public.pdv_pagamentos where pedido_id = p_pedido and status = 'confirmado') then
    raise exception 'Há pagamentos lançados. Estorne antes de cancelar o pedido.';
  end if;
  select count(*) into v_enviados from public.pdv_pedido_itens
   where pedido_id = p_pedido and status_cozinha is not null and not cancelado;

  if v_enviados > 0 then
    if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
    v_aut := public.pdv_autorizar(p.unidade_id, p_pin, 'cancelar_pedido');
    -- avisa cada setor do que estava em produção
    for i in select * from public.pdv_pedido_itens
              where pedido_id = p_pedido and status_cozinha is not null and status_cozinha <> 'pronto' and not cancelado
    loop
      v_setor := public.pdv_setor_do_item(i, p.unidade_id);
      perform public.pdv_enfileirar(p.unidade_id, 'cancelamento', p.id, v_setor.id, p_terminal,
        (public.pdv_identificacao(p) ->> 'rotulo') || ' · CANCELAMENTO',
        jsonb_build_object('setor', v_setor.nome, 'identificacao', public.pdv_identificacao(p),
          'emitido_em', now(), 'operador', auth.jwt() ->> 'email',
          'terminal', public.pdv_nome_terminal(p_terminal),
          'autorizado_por', v_aut.nome, 'motivo', trim(p_motivo),
          'itens', jsonb_build_array(jsonb_build_object('quantidade', i.quantidade, 'nome', i.nome))));
    end loop;
    update public.pdv_pedido_itens
       set cancelado = true, cancelado_em = now(), cancelado_motivo = trim(p_motivo), cancelado_por = v_aut.nome
     where pedido_id = p_pedido and not cancelado and status_cozinha is not null and status_cozinha <> 'pronto';
  end if;

  update public.pdv_pedidos set status = 'cancelado', fechado_em = now() where id = p_pedido;

  insert into public.pdv_auditoria
    (unidade_id, pedido_id, acao, motivo, detalhes, autorizado_por, autorizado_por_nome, terminal_id)
  values
    (p.unidade_id, p.id, 'cancelar_pedido', nullif(trim(p_motivo), ''),
     jsonb_build_object('total', p.total, 'itens_em_producao', v_enviados),
     v_aut.id, v_aut.nome, p_terminal);
end;
$$;


-- =============================================================================
-- 13. DELIVERY: ticket de produção automático quando o pedido chega
-- =============================================================================

create or replace function public.trg_delivery_imprimir_producao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.pdv_config;
  v_setor record;
  v_ident jsonb;
begin
  if new.status_cozinha is distinct from 'novo' then return new; end if;
  v_cfg := public.pdv_obter_config(new.unidade_id);
  if not v_cfg.imprimir_producao_auto then return new; end if;
  perform public.pdv_garantir_setores(new.unidade_id);

  v_ident := jsonb_build_object('modo', 'delivery', 'rotulo', 'DELIVERY',
    'cliente', replace(coalesce(new.telefone_cliente, ''), 'whatsapp:', ''),
    'endereco', new.endereco_entrega, 'pagamento', new.forma_pagamento);

  for v_setor in
    select s.id, coalesce(s.nome, 'Produção') as nome,
           jsonb_agg(jsonb_build_object(
             'quantidade', (it ->> 'quantidade')::numeric, 'nome', it ->> 'nome',
             'observacao', it ->> 'observacao')) as itens
      from jsonb_array_elements(coalesce(new.itens, '[]'::jsonb)) it
      left join public.ingredientes g on g.id::text = it ->> 'ingrediente_id'
      left join public.pdv_setores s on s.id = coalesce(
             (select id from public.pdv_setores where id = g.setor_id and ativo),
             (select id from public.pdv_setores where unidade_id = new.unidade_id and padrao limit 1))
     group by s.id, s.nome
  loop
    perform public.pdv_enfileirar(new.unidade_id, 'producao', null, v_setor.id, null,
      'DELIVERY · ' || v_setor.nome,
      jsonb_build_object('setor', v_setor.nome, 'identificacao', v_ident, 'acrescimo', false,
                         'emitido_em', now(), 'itens', v_setor.itens, 'delivery_id', new.id));
  end loop;
  return new;
exception when others then
  -- impressão nunca pode impedir o pedido de entrar
  return new;
end;
$$;

drop trigger if exists trg_delivery_imprimir_producao_ai on public.pedidos_delivery;
create trigger trg_delivery_imprimir_producao_ai
  after insert on public.pedidos_delivery
  for each row execute function public.trg_delivery_imprimir_producao();


-- =============================================================================
-- 14. REGRAS DE ACESSO (RLS)
-- =============================================================================
-- Mesmo padrão das outras tabelas do PDV: quem está logado lê. As tabelas de
-- dinheiro e de PIN só mudam pelas funções acima.

alter table public.pdv_config enable row level security;
alter table public.pdv_operadores enable row level security;
alter table public.pdv_auditoria enable row level security;
alter table public.pdv_terminais enable row level security;
alter table public.pdv_setores enable row level security;
alter table public.pdv_impressoras enable row level security;
alter table public.pdv_rotas_impressao enable row level security;
alter table public.pdv_impressoes enable row level security;
alter table public.pdv_pagamentos enable row level security;
alter table public.pdv_fechamentos enable row level security;

-- configuração da impressão: leitura e escrita para quem está logado
do $$
declare t text;
begin
  foreach t in array array['pdv_config','pdv_terminais','pdv_setores','pdv_impressoras','pdv_rotas_impressao']
  loop
    execute format('drop policy if exists %1$s_logado on public.%1$s', t);
    execute format('create policy %1$s_logado on public.%1$s for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- só leitura (a escrita é pelas funções security definer)
drop policy if exists pdv_impressoes_ler on public.pdv_impressoes;
create policy pdv_impressoes_ler on public.pdv_impressoes for select to authenticated using (true);
drop policy if exists pdv_pagamentos_ler on public.pdv_pagamentos;
create policy pdv_pagamentos_ler on public.pdv_pagamentos for select to authenticated using (true);
drop policy if exists pdv_fechamentos_ler on public.pdv_fechamentos;
create policy pdv_fechamentos_ler on public.pdv_fechamentos for select to authenticated using (true);
drop policy if exists pdv_auditoria_ler on public.pdv_auditoria;
create policy pdv_auditoria_ler on public.pdv_auditoria for select to authenticated using (true);
drop policy if exists pdv_operadores_ler on public.pdv_operadores;
create policy pdv_operadores_ler on public.pdv_operadores for select to authenticated using (true);

-- o hash do PIN não sai pela API
revoke all on public.pdv_operadores from anon, authenticated;
grant select (id, unidade_id, nome, perfil, ativo, criado_em) on public.pdv_operadores to authenticated;

-- a função que confere PIN não é chamada direto do navegador (evita "chutar" PIN)
revoke execute on function public.pdv_autorizar(uuid, text, text) from public, anon, authenticated;

-- a estação de impressão recebe os tickets na hora (sem esperar a próxima consulta)
do $$
begin
  alter publication supabase_realtime add table public.pdv_impressoes;
exception when others then
  null; -- já estava na publicação (ou o realtime não existe neste banco)
end $$;
