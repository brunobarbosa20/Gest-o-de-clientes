create extension if not exists pgcrypto;

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

alter table public.clients enable row level security;
alter table public.sweets enable row level security;
alter table public.purchases enable row level security;
alter table public.local_migrations enable row level security;

grant select, insert, update, delete on public.clients, public.sweets, public.purchases to authenticated;
grant select, insert on public.local_migrations to authenticated;

drop policy if exists "Owners manage their clients" on public.clients;
create policy "Owners manage their clients" on public.clients
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners manage their sweets" on public.sweets;
create policy "Owners manage their sweets" on public.sweets
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners manage their purchases" on public.purchases;
create policy "Owners manage their purchases" on public.purchases
  for all to authenticated using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.clients
      where clients.id = client_id and clients.owner_id = (select auth.uid())
    )
    and (
      purchases.sweet_id is null
      or exists (
        select 1 from public.sweets
        where sweets.id = purchases.sweet_id and sweets.owner_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Owners read their migration status" on public.local_migrations;
create policy "Owners read their migration status" on public.local_migrations
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Owners create their migration status" on public.local_migrations;
create policy "Owners create their migration status" on public.local_migrations
  for insert to authenticated with check (owner_id = (select auth.uid()));

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
