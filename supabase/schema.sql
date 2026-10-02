create table if not exists public.login_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz
);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from public, anon, authenticated;

create or replace function public.get_login_lock_seconds(p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_locked_until timestamptz;
begin
  select u.id into v_user_id
    from auth.users u
    where pg_catalog.lower(u.email) = pg_catalog.lower(p_email)
    limit 1;

  if v_user_id is null then
    return 0;
  end if;

  select attempts.locked_until into v_locked_until
    from public.login_attempts attempts
    where attempts.user_id = v_user_id
    for update;

  if v_locked_until is null then
    return 0;
  end if;

  if v_locked_until <= pg_catalog.clock_timestamp() then
    update public.login_attempts
      set failed_attempts = 0, locked_until = null
      where user_id = v_user_id;
    return 0;
  end if;

  return greatest(1, ceil(extract(epoch from (v_locked_until - pg_catalog.clock_timestamp())))::integer);
end;
$$;

create or replace function public.record_login_failure(p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_failed_attempts integer;
  v_locked_until timestamptz;
begin
  select u.id into v_user_id
    from auth.users u
    where pg_catalog.lower(u.email) = pg_catalog.lower(p_email)
    limit 1;

  if v_user_id is null then
    return 0;
  end if;

  insert into public.login_attempts (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

  select attempts.failed_attempts, attempts.locked_until
    into v_failed_attempts, v_locked_until
    from public.login_attempts attempts
    where attempts.user_id = v_user_id
    for update;

  if v_locked_until > pg_catalog.clock_timestamp() then
    return greatest(1, ceil(extract(epoch from (v_locked_until - pg_catalog.clock_timestamp())))::integer);
  end if;

  if v_locked_until is not null then
    v_failed_attempts := 0;
  end if;

  v_failed_attempts := v_failed_attempts + 1;

  if v_failed_attempts >= 3 then
    update public.login_attempts
      set failed_attempts = v_failed_attempts,
          locked_until = pg_catalog.clock_timestamp() + interval '20 seconds'
      where user_id = v_user_id;
    return 20;
  end if;

  update public.login_attempts
    set failed_attempts = v_failed_attempts, locked_until = null
    where user_id = v_user_id;
  return 0;
end;
$$;

create or replace function public.reset_login_failures(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.login_attempts where user_id = p_user_id;
$$;

revoke all on function public.get_login_lock_seconds(text) from public, anon, authenticated;
revoke all on function public.record_login_failure(text) from public, anon, authenticated;
revoke all on function public.reset_login_failures(uuid) from public, anon, authenticated;
grant execute on function public.get_login_lock_seconds(text) to service_role;
grant execute on function public.record_login_failure(text) to service_role;
grant execute on function public.reset_login_failures(uuid) to service_role;
