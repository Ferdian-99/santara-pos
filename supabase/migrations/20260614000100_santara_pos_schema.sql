-- Santara POS Phase 5A schema preparation.
-- This migration prepares Supabase persistence, but the app remains
-- localStorage-first until a later data-service/sync phase.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'cashier'
    check (role in ('owner', 'admin', 'cashier')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.menu_categories(id) on delete set null,
  category_name text not null,
  name text not null,
  price integer not null default 0 check (price >= 0),
  hpp integer not null default 0 check (hpp >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  transaction_at timestamptz not null default now(),
  cashier_id uuid references public.profiles(id) on delete set null,
  cashier_name text not null default 'Santara Cashier',
  subtotal_before_discount integer not null default 0
    check (subtotal_before_discount >= 0),
  discount_type text not null default 'none'
    check (discount_type in ('none', 'fixed', 'percentage')),
  discount_value numeric(12, 2) not null default 0 check (discount_value >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  total_after_discount integer not null default 0 check (total_after_discount >= 0),
  payment_method text not null check (payment_method in ('Cash', 'QRIS', 'Debit')),
  paid_amount integer check (paid_amount is null or paid_amount >= 0),
  change_amount integer check (change_amount is null or change_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  menu_name_snapshot text not null,
  category_name_snapshot text not null,
  unit_price_snapshot integer not null default 0 check (unit_price_snapshot >= 0),
  hpp_snapshot integer not null default 0 check (hpp_snapshot >= 0),
  quantity integer not null default 1 check (quantity > 0),
  subtotal integer not null default 0 check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pending_orders (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  cashier_id uuid references public.profiles(id) on delete set null,
  cashier_name text not null default 'Santara Cashier',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pending_order_items (
  id uuid primary key default gen_random_uuid(),
  pending_order_id uuid not null references public.pending_orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  menu_name_snapshot text not null,
  category_name_snapshot text not null,
  unit_price_snapshot integer not null default 0 check (unit_price_snapshot >= 0),
  hpp_snapshot integer not null default 0 check (hpp_snapshot >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_category_id_idx
  on public.menu_items(category_id);

create index if not exists transactions_transaction_at_idx
  on public.transactions(transaction_at);

create index if not exists transaction_items_transaction_id_idx
  on public.transaction_items(transaction_id);

create index if not exists pending_order_items_pending_order_id_idx
  on public.pending_order_items(pending_order_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_menu_categories_updated_at on public.menu_categories;
create trigger set_menu_categories_updated_at
before update on public.menu_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_menu_items_updated_at on public.menu_items;
create trigger set_menu_items_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_pending_orders_updated_at on public.pending_orders;
create trigger set_pending_orders_updated_at
before update on public.pending_orders
for each row execute function public.set_updated_at();

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.pending_orders enable row level security;
alter table public.pending_order_items enable row level security;
alter table public.app_settings enable row level security;

-- Phase 5A RLS note:
-- Auth and role-based permissions are not implemented yet. These policies keep
-- anonymous anon-key access closed, while allowing signed-in users during later
-- integration testing. Tighten these policies by role before production use.

drop policy if exists "Authenticated users can manage profiles" on public.profiles;
create policy "Authenticated users can manage profiles"
on public.profiles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage menu categories" on public.menu_categories;
create policy "Authenticated users can manage menu categories"
on public.menu_categories
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage menu items" on public.menu_items;
create policy "Authenticated users can manage menu items"
on public.menu_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage transactions" on public.transactions;
create policy "Authenticated users can manage transactions"
on public.transactions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage transaction items" on public.transaction_items;
create policy "Authenticated users can manage transaction items"
on public.transaction_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage pending orders" on public.pending_orders;
create policy "Authenticated users can manage pending orders"
on public.pending_orders
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage pending order items" on public.pending_order_items;
create policy "Authenticated users can manage pending order items"
on public.pending_order_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage app settings" on public.app_settings;
create policy "Authenticated users can manage app settings"
on public.app_settings
for all
to authenticated
using (true)
with check (true);
