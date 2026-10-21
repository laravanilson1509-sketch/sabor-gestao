-- =============================================================================
-- Bebidas — novo tipo de produto, com categoria (alcoólica, não alcoólica...)
-- =============================================================================
-- tipo_produto passa a aceitar 'bebida'. Bebida é vendida como produto pronto:
-- a baixa de estoque é 1 por 1, igual ao 'acabado'.
-- categoria_bebida guarda a categoria (agua, refrigerante, suco, energetico,
-- cha_cafe, outra_nao_alcoolica, cerveja, vinho, destilado, drink,
-- outra_alcoolica). Se é alcoólica ou não, o sistema deduz da categoria.
-- =============================================================================

alter table public.ingredientes
  add column if not exists categoria_bebida text;

-- se existir uma regra (check) limitando os valores de tipo_produto, remove:
-- ela não conhece 'bebida'
do $$
declare v_con record;
begin
  for v_con in
    select conname from pg_constraint
     where conrelid = 'public.ingredientes'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%tipo_produto%'
  loop
    execute format('alter table public.ingredientes drop constraint %I', v_con.conname);
  end loop;
end $$;

-- a baixa de estoque do PDV passa a tratar bebida como produto acabado
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.pdv_baixar_estoque_item(uuid)'::regprocedure);
  if position('''bebida''' in v_def) > 0 then
    return; -- já ajustada (o SQL pode ser rodado de novo sem problema)
  end if;
  if position('v_tipo = ''acabado''' in v_def) = 0 then
    raise exception 'pdv_baixar_estoque_item: trecho esperado não encontrado (rode a 0015 antes)';
  end if;
  execute replace(v_def, 'v_tipo = ''acabado''', 'v_tipo in (''acabado'', ''bebida'')');
end $$;
