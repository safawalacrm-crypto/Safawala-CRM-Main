-- Safawala CRM inventory extension.
-- Existing products remain valid; every new CRM product requires an 11-digit barcode in the UI.

alter table public.products
  add column if not exists barcode text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists size text,
  add column if not exists color text,
  add column if not exists material text,
  add column if not exists cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  add column if not exists regular_price numeric(12,2) not null default 0 check (regular_price >= 0),
  add column if not exists reorder_level integer not null default 0 check (reorder_level >= 0),
  add column if not exists image_urls text[] not null default '{}';

alter table public.products drop constraint if exists products_barcode_format_check;
alter table public.products
  add constraint products_barcode_format_check
  check (barcode is null or barcode ~ '^[0-9]{11}$');

create unique index if not exists products_owner_barcode_idx
  on public.products (owner_id, barcode) where barcode is not null;
create index if not exists products_owner_category_idx
  on public.products (owner_id, category) where category is not null;

create table if not exists public.product_variants (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  sku text,
  barcode text,
  size text,
  color text,
  design text,
  material text,
  regular_price_adjustment numeric(12,2) not null default 0,
  sale_price_adjustment numeric(12,2) not null default 0,
  rental_price_adjustment numeric(12,2) not null default 0,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, sku),
  check (barcode is null or barcode ~ '^[0-9]{11}$')
);

create unique index if not exists product_variants_owner_barcode_idx
  on public.product_variants (owner_id, barcode) where barcode is not null;
create index if not exists product_variants_product_idx
  on public.product_variants (product_id);

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

alter table public.product_variants enable row level security;

drop policy if exists product_variants_select_own on public.product_variants;
create policy product_variants_select_own on public.product_variants
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists product_variants_insert_own on public.product_variants;
create policy product_variants_insert_own on public.product_variants
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists product_variants_update_own on public.product_variants;
create policy product_variants_update_own on public.product_variants
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists product_variants_delete_own on public.product_variants;
create policy product_variants_delete_own on public.product_variants
  for delete to authenticated using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.product_variants to authenticated;
grant usage, select on sequence public.product_variants_id_seq to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select using (bucket_id = 'product-images');
drop policy if exists product_images_insert_own on storage.objects;
create policy product_images_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists product_images_update_own on storage.objects;
create policy product_images_update_own on storage.objects
  for update to authenticated using (
    bucket_id = 'product-images' and owner_id = (select auth.uid())::text
  );
drop policy if exists product_images_delete_own on storage.objects;
create policy product_images_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'product-images' and owner_id = (select auth.uid())::text
  );
