-- Santara POS Phase 6 legacy sales import.
--
-- Adds old POS import storage. These rows are included in reports but are not
-- normal Santara POS receipt records.

create table if not exists public.legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  file_name text not null,
  date_start date,
  date_end date,
  total_rows integer not null default 0 check (total_rows >= 0),
  total_gross_sales integer not null default 0 check (total_gross_sales >= 0),
  total_discount integer not null default 0 check (total_discount >= 0),
  total_net_sales integer not null default 0 check (total_net_sales >= 0),
  total_hpp integer not null default 0 check (total_hpp >= 0),
  imported_by uuid references public.profiles(id) on delete set null,
  imported_by_name text not null default 'Santara User',
  imported_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legacy_sales (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  import_batch_id uuid not null references public.legacy_import_batches(id) on delete cascade,
  sale_date date not null,
  menu_name text not null,
  category_name text not null default 'Legacy',
  quantity integer not null default 1 check (quantity > 0),
  gross_sales integer not null default 0 check (gross_sales >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  net_sales integer not null default 0 check (net_sales >= 0),
  hpp_total integer not null default 0 check (hpp_total >= 0),
  payment_method text not null default 'Legacy',
  notes text,
  source text not null default 'legacy_import',
  imported_by uuid references public.profiles(id) on delete set null,
  imported_by_name text not null default 'Santara User',
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source = 'legacy_import')
);

create index if not exists legacy_import_batches_date_idx
  on public.legacy_import_batches(date_start, date_end);

create index if not exists legacy_sales_import_batch_id_idx
  on public.legacy_sales(import_batch_id);

create index if not exists legacy_sales_sale_date_idx
  on public.legacy_sales(sale_date);

drop trigger if exists set_legacy_import_batches_updated_at
  on public.legacy_import_batches;
create trigger set_legacy_import_batches_updated_at
before update on public.legacy_import_batches
for each row execute function public.set_updated_at();

drop trigger if exists set_legacy_sales_updated_at on public.legacy_sales;
create trigger set_legacy_sales_updated_at
before update on public.legacy_sales
for each row execute function public.set_updated_at();

alter table public.legacy_import_batches enable row level security;
alter table public.legacy_sales enable row level security;

drop policy if exists "Owner admin can manage legacy import batches"
  on public.legacy_import_batches;
create policy "Owner admin can manage legacy import batches"
on public.legacy_import_batches
for all
to authenticated
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

drop policy if exists "Owner admin can manage legacy sales"
  on public.legacy_sales;
create policy "Owner admin can manage legacy sales"
on public.legacy_sales
for all
to authenticated
using (public.is_owner_or_admin())
with check (public.is_owner_or_admin());

-- No anon policies are created. Legacy imports should only be written by
-- authenticated owner/admin accounts.
