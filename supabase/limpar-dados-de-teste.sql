begin;

do $$
declare
  v_owner_id uuid;
  v_clientes_removidos integer;
begin
  select id
    into v_owner_id
    from auth.users
    where lower(email) = lower('beatriz@admin.com');

  if v_owner_id is null then
    raise exception 'Conta Beatriz não encontrada em Supabase Auth; nenhum dado foi removido.';
  end if;

  delete from public.clients
    where owner_id = v_owner_id;
  get diagnostics v_clientes_removidos = row_count;

  raise notice 'Clientes removidos: %. Compras vinculadas foram removidas por cascata. Doces preservados.', v_clientes_removidos;
end $$;

commit;
