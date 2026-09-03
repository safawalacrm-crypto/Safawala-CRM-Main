-- Package & Variant Management
-- Independent package master data, isolated per authenticated CRM user.

create table if not exists public.package_categories (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists package_categories_owner_name_unique
  on public.package_categories (owner_id, lower(trim(name)));

create index if not exists package_categories_owner_active_idx
  on public.package_categories (owner_id, is_active, created_at);

create table if not exists public.package_variants (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  category_id bigint not null references public.package_categories(id) on delete restrict,
  name text not null check (length(trim(name)) >= 1),
  base_price numeric(12,2) not null default 0 check (base_price >= 0),
  inclusions text[] not null default '{}'::text[],
  extra_safa_price numeric(12,2) not null default 0 check (extra_safa_price >= 0),
  missing_safa_penalty numeric(12,2) not null default 0 check (missing_safa_penalty >= 0),
  security_deposit numeric(12,2) not null default 0 check (security_deposit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists package_variants_category_name_unique
  on public.package_variants (category_id, lower(trim(name)));

create index if not exists package_variants_owner_category_idx
  on public.package_variants (owner_id, category_id, created_at);

drop trigger if exists package_categories_set_updated_at on public.package_categories;
create trigger package_categories_set_updated_at
  before update on public.package_categories
  for each row execute function public.set_updated_at();

drop trigger if exists package_variants_set_updated_at on public.package_variants;
create trigger package_variants_set_updated_at
  before update on public.package_variants
  for each row execute function public.set_updated_at();

alter table public.package_categories enable row level security;
alter table public.package_variants enable row level security;

create policy package_categories_select_own
  on public.package_categories for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy package_categories_insert_own
  on public.package_categories for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy package_categories_update_own
  on public.package_categories for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy package_variants_select_own
  on public.package_variants for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy package_variants_insert_own
  on public.package_variants for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.package_categories category
      where category.id = category_id
        and category.owner_id = (select auth.uid())
    )
  );

create policy package_variants_update_own
  on public.package_variants for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.package_categories category
      where category.id = category_id
        and category.owner_id = (select auth.uid())
    )
  );

create policy package_variants_delete_own
  on public.package_variants for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.package_categories, public.package_variants from anon;
grant select, insert, update on public.package_categories to authenticated;
grant select, insert, update, delete on public.package_variants to authenticated;
grant usage, select on sequence public.package_categories_id_seq to authenticated;
grant usage, select on sequence public.package_variants_id_seq to authenticated;
