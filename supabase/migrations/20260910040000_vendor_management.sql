create table if not exists public.vendors (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  contact_person text,
  phone text not null,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendors_owner_active_idx on public.vendors(owner_id, is_active, created_at desc);

alter table public.vendors enable row level security;
drop policy if exists vendors_owner on public.vendors;
create policy vendors_owner on public.vendors for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.vendors to authenticated;
grant usage, select on sequence vendors_id_seq to authenticated;
