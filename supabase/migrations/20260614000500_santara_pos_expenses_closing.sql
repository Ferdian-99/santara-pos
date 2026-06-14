-- Santara POS Phase 7 expenses, daily closing, and Google Sheet sync.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  expense_date date not null,
  name text not null,
  category text not null,
  amount integer not null default 0 check (amount >= 0),
  payment_method text not null default 'Cash'
    check (payment_method in ('Cash', 'QRIS', 'Debit', 'Transfer', 'Other')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text not null default 'Santara User',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  closing_date date not null unique,
  cashier_id uuid references public.profiles(id) on delete set null,
  cashier_name text not null default 'Santara Cashier',
  gross_sales integer not null default 0,
  total_discount integer not null default 0,
  net_sales integer not null default 0,
  total_hpp integer not null default 0,
  gross_profit integer not null default 0,
  total_expenses integer not null default 0,
  net_profit integer not null default 0,
  cash_sales integer not null default 0,
  qris_sales integer not null default 0,
  debit_sales integer not null default 0,
  expected_cash integer not null default 0,
  actual_cash integer not null default 0,
  cash_difference integer not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text not null default 'Santara User',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_sheet_sync_settings (
  id uuid primary key default gen_random_uuid(),
  endpoint_url text not null default '',
  is_enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_by_name text not null default 'Santara User',
  updated_at timestamptz not null default now()
);

create table if not exists public.google_sheet_sync_logs (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  report_mode text not null,
  selected_date date,
  status text not null check (status in ('success', 'error')),
  message text not null default '',
  synced_at timestamptz not null default now(),
  synced_by uuid references public.profiles(id) on delete set null,
  synced_by_name text not null default 'Santara User'
);

create index if not exists expenses_expense_date_idx
  on public.expenses(expense_date);

create index if not exists daily_closings_closing_date_idx
  on public.daily_closings(closing_date);

create index if not exists google_sheet_sync_logs_synced_at_idx
  on public.google_sheet_sync_logs(synced_at);

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_closings_updated_at on public.daily_closings;
create trigger set_daily_closings_updated_at
before update on public.daily_closings
for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;
alter table public.daily_closings enable row level security;
alter table public.google_sheet_sync_settings enable row level security;
alter table public.google_sheet_sync_logs enable row level security;

drop policy if exists "Owner admin can manage expenses" on public.expenses;
create policy "Owner admin can manage expenses"
on public.expenses
for all
to authenticated
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

drop policy if exists "Owner admin can manage daily closings"
  on public.daily_closings;
create policy "Owner admin can manage daily closings"
on public.daily_closings
for all
to authenticated
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

drop policy if exists "Owner admin can manage Google Sheet settings"
  on public.google_sheet_sync_settings;
create policy "Owner admin can manage Google Sheet settings"
on public.google_sheet_sync_settings
for all
to authenticated
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

drop policy if exists "Owner admin can manage Google Sheet sync logs"
  on public.google_sheet_sync_logs;
create policy "Owner admin can manage Google Sheet sync logs"
on public.google_sheet_sync_logs
for all
to authenticated
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

-- No anon policies are created. These are owner/admin operational records.
