create table if not exists public.coupon_offers (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  value numeric(12,2) not null check (value > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, code)
);
create index if not exists coupon_offers_owner_active_idx on public.coupon_offers(owner_id, is_active, created_at desc);
alter table public.coupon_offers enable row level security;
drop policy if exists coupon_offers_owner on public.coupon_offers;
create policy coupon_offers_owner on public.coupon_offers for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on public.coupon_offers to authenticated;
grant usage, select on sequence coupon_offers_id_seq to authenticated;
