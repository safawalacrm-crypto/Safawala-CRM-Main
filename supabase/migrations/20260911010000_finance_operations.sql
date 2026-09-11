-- Finance & operations records for challans, vouchers, and expenses.
create table if not exists public.challans (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  challan_number text not null,
  challan_date date not null default current_date,
  party_name text not null check (length(trim(party_name)) >= 2),
  mobile text,
  booking_id bigint references public.bookings(id) on delete set null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'active' check (status in ('active','closed')),
  notes text,
  created_at timestamptz not null default now(),
  unique(owner_id, challan_number)
);
create table if not exists public.vouchers (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  voucher_number text not null,
  voucher_type text not null check (voucher_type in ('payment','receipt')),
  voucher_date date not null default current_date,
  payment_mode text not null default 'cash',
  amount numeric(12,2) not null check (amount > 0),
  booking_id bigint references public.bookings(id) on delete set null,
  account_name text not null,
  narration text,
  receiver_name text,
  prepared_by text,
  created_at timestamptz not null default now(),
  unique(owner_id, voucher_number)
);
create table if not exists public.expenses (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  category text not null default 'Uncategorized',
  vendor_id bigint references public.vendors(id) on delete set null,
  booking_id bigint references public.bookings(id) on delete set null,
  receipt_number text,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists challans_owner_date_idx on public.challans(owner_id, challan_date desc);
create index if not exists vouchers_owner_date_idx on public.vouchers(owner_id, voucher_date desc);
create index if not exists expenses_owner_date_idx on public.expenses(owner_id, expense_date desc);
do $$ declare t text; begin foreach t in array array['challans','vouchers','expenses'] loop execute format('alter table public.%I enable row level security', t); execute format('drop policy if exists %I on public.%I', t || '_owner', t); execute format('create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t || '_owner', t); execute format('grant select, insert, update, delete on public.%I to authenticated', t); end loop; end $$;
grant usage, select on all sequences in schema public to authenticated;
