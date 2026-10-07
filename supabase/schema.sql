create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuário',
  access_role text not null default 'viewer' check (access_role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_id text,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, legacy_id)
);

create table if not exists public.sweets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_id text,
  name text not null,
  price numeric(12, 2) not null check (price > 0),
  created_at timestamptz not null default now(),
  unique (owner_id, legacy_id)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  legacy_id text,
  client_id uuid not null references public.clients(id) on delete cascade,
  sweet_id uuid references public.sweets(id) on delete set null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0 and amount_paid <= total_amount),
  purchase_date date not null default current_date,
  paid_at date,
  created_at timestamptz not null default now(),
  unique (owner_id, legacy_id)
);

create index if not exists purchases_owner_client_date_idx
  on public.purchases (owner_id, client_id, purchase_date, created_at, id);

create table if not exists public.local_migrations (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  event_type text not null,
  entity_type text not null,
  entity_name text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

alter table public.clients enable row level security;
alter table public.sweets enable row level security;
alter table public.purchases enable row level security;
alter table public.local_migrations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.activity_logs enable row level security;

grant select, insert, update, delete on public.clients, public.sweets, public.purchases to authenticated;
grant select, insert on public.local_migrations to authenticated;
grant select on public.user_profiles to authenticated;
grant select, insert on public.activity_logs to authenticated;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_profiles
    where id = (select auth.uid()) and access_role = 'admin'
  );
$$;

revoke all on function public.is_system_admin() from public;
grant execute on function public.is_system_admin() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (id, display_name, access_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.user_profiles (id, display_name, access_role)
select id,
       coalesce(raw_user_meta_data->>'display_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
       'viewer'
from auth.users
on conflict (id) do nothing;

update public.user_profiles
set display_name = 'Beatriz', access_role = 'admin'
where id = (select id from auth.users where lower(email) = lower('beatriz@admin.com'));

drop policy if exists "Users read their own profile" on public.user_profiles;
create policy "Users read their own profile" on public.user_profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "Authenticated users read activity logs" on public.activity_logs;
create policy "Authenticated users read activity logs" on public.activity_logs
  for select to authenticated using (true);
drop policy if exists "Admins insert activity logs" on public.activity_logs;
create policy "Admins insert activity logs" on public.activity_logs
  for insert to authenticated with check (public.is_system_admin() and actor_id = (select auth.uid()));

drop policy if exists "Authenticated users view shared clients" on public.clients;
create policy "Authenticated users view shared clients" on public.clients
  for select to authenticated using (true);
drop policy if exists "Admins insert clients" on public.clients;
create policy "Admins insert clients" on public.clients
  for insert to authenticated with check (public.is_system_admin() and owner_id = (select auth.uid()));
drop policy if exists "Admins update clients" on public.clients;
create policy "Admins update clients" on public.clients
  for update to authenticated using (public.is_system_admin())
  with check (public.is_system_admin() and owner_id = (select auth.uid()));
drop policy if exists "Admins delete clients" on public.clients;
create policy "Admins delete clients" on public.clients
  for delete to authenticated using (public.is_system_admin());

drop policy if exists "Owners manage their clients" on public.clients;

drop policy if exists "Owners manage their sweets" on public.sweets;
drop policy if exists "Authenticated users view shared sweets" on public.sweets;
create policy "Authenticated users view shared sweets" on public.sweets
  for select to authenticated using (true);
drop policy if exists "Admins insert sweets" on public.sweets;
create policy "Admins insert sweets" on public.sweets
  for insert to authenticated with check (public.is_system_admin() and owner_id = (select auth.uid()));
drop policy if exists "Admins update sweets" on public.sweets;
create policy "Admins update sweets" on public.sweets
  for update to authenticated using (public.is_system_admin())
  with check (public.is_system_admin() and owner_id = (select auth.uid()));
drop policy if exists "Admins delete sweets" on public.sweets;
create policy "Admins delete sweets" on public.sweets
  for delete to authenticated using (public.is_system_admin());

drop policy if exists "Owners manage their purchases" on public.purchases;
drop policy if exists "Authenticated users view shared purchases" on public.purchases;
create policy "Authenticated users view shared purchases" on public.purchases
  for select to authenticated using (true);
drop policy if exists "Admins insert purchases" on public.purchases;
create policy "Admins insert purchases" on public.purchases
  for insert to authenticated with check (
    public.is_system_admin()
    and owner_id = (select auth.uid())
    and exists (select 1 from public.clients where clients.id = purchases.client_id)
    and (purchases.sweet_id is null or exists (
      select 1 from public.sweets where sweets.id = purchases.sweet_id
    ))
  );
drop policy if exists "Admins update purchases" on public.purchases;
create policy "Admins update purchases" on public.purchases
  for update to authenticated using (public.is_system_admin())
  with check (public.is_system_admin() and owner_id = (select auth.uid()));
drop policy if exists "Admins delete purchases" on public.purchases;
create policy "Admins delete purchases" on public.purchases
  for delete to authenticated using (public.is_system_admin());

drop policy if exists "Owners read their migration status" on public.local_migrations;
drop policy if exists "Owners create their migration status" on public.local_migrations;
drop policy if exists "Admins read migration status" on public.local_migrations;
create policy "Admins read migration status" on public.local_migrations
  for select to authenticated using (public.is_system_admin() and owner_id = (select auth.uid()));
drop policy if exists "Admins create migration status" on public.local_migrations;
create policy "Admins create migration status" on public.local_migrations
  for insert to authenticated with check (public.is_system_admin() and owner_id = (select auth.uid()));

create or replace function public.register_client_payment(p_client_id uuid, p_amount numeric, p_paid_at date)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_remaining numeric(12, 2) := round(p_amount, 2);
  v_balance numeric(12, 2);
  v_purchase record;
  v_outstanding numeric(12, 2);
  v_applied numeric(12, 2);
begin
  if not public.is_system_admin() then
    raise exception 'Somente administradores podem registrar pagamentos.';
  end if;
  if v_remaining <= 0 then
    raise exception 'Informe um valor de pagamento maior que zero.';
  end if;

  perform 1 from public.clients where id = p_client_id for update;
  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  select coalesce(sum(total_amount - amount_paid), 0)
    into v_balance
    from public.purchases
    where client_id = p_client_id;

  if v_remaining > v_balance then
    raise exception 'O pagamento não pode ser maior que o saldo em aberto.';
  end if;

  for v_purchase in
    select * from public.purchases
    where client_id = p_client_id and amount_paid < total_amount
    order by purchase_date, created_at, id
    for update
  loop
    exit when v_remaining <= 0;
    v_outstanding := v_purchase.total_amount - v_purchase.amount_paid;
    v_applied := least(v_outstanding, v_remaining);
    update public.purchases
      set amount_paid = amount_paid + v_applied,
          paid_at = case
            when amount_paid + v_applied >= total_amount then coalesce(paid_at, p_paid_at)
            else null
          end
      where id = v_purchase.id;
    v_remaining := v_remaining - v_applied;
  end loop;

  return jsonb_build_object(
    'applied', round(p_amount, 2),
    'balance', v_balance - round(p_amount, 2)
  );
end;
$$;

create or replace function public.mark_client_purchases_paid(p_client_id uuid, p_paid_at date)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_system_admin() then
    raise exception 'Somente administradores podem atualizar pagamentos.';
  end if;
  update public.purchases
    set amount_paid = total_amount,
      paid_at = coalesce(paid_at, p_paid_at)
    where client_id = p_client_id and amount_paid < total_amount;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.register_client_payment(uuid, numeric, date) to authenticated;
grant execute on function public.mark_client_purchases_paid(uuid, date) to authenticated;
revoke all on function public.register_client_payment(uuid, numeric, date) from public;
revoke all on function public.mark_client_purchases_paid(uuid, date) from public;
