-- Preserve the printed barcode formats used by the legacy Safawala inventory.
-- Existing data contains numeric, alphanumeric and hyphenated codes from 9-21
-- characters. The application permits up to 50 characters for future safety.

alter table public.products
  drop constraint if exists products_barcode_format_check;

alter table public.products
  add constraint products_barcode_format_check
  check (barcode is null or barcode ~ '^[A-Za-z0-9_-]{1,50}$');

alter table public.product_variants
  drop constraint if exists product_variants_barcode_check;

alter table public.product_variants
  drop constraint if exists product_variants_barcode_format_check;

alter table public.product_variants
  add constraint product_variants_barcode_format_check
  check (barcode is null or barcode ~ '^[A-Za-z0-9_-]{1,50}$');

-- A product-level barcode is not enough for the legacy inventory. These rows
-- preserve the barcode already stuck to each individually tracked physical unit.
create table if not exists public.product_units (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  product_variant_id bigint references public.product_variants(id) on delete set null,
  legacy_source text check (legacy_source in ('product_items', 'product_barcodes')),
  legacy_id uuid,
  item_code text,
  barcode text not null check (barcode ~ '^[A-Za-z0-9_-]{1,50}$'),
  qr_code text,
  serial_number text,
  status text not null default 'available'
    check (status in ('available', 'booked', 'in_use', 'damaged', 'in_laundry', 'sold', 'retired')),
  condition text
    check (condition is null or condition in ('new', 'good', 'fair', 'poor', 'damaged')),
  location text,
  notes text,
  legacy_booking_id uuid,
  last_used_at timestamptz,
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, barcode),
  unique (owner_id, legacy_source, legacy_id)
);

create index if not exists product_units_owner_product_idx
  on public.product_units (owner_id, product_id);
create index if not exists product_units_owner_status_idx
  on public.product_units (owner_id, status);

drop trigger if exists product_units_set_updated_at on public.product_units;
create trigger product_units_set_updated_at
  before update on public.product_units
  for each row execute function public.set_updated_at();

alter table public.product_units enable row level security;

drop policy if exists product_units_owner_select on public.product_units;
create policy product_units_owner_select on public.product_units
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists product_units_owner_insert on public.product_units;
create policy product_units_owner_insert on public.product_units
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists product_units_owner_update on public.product_units;
create policy product_units_owner_update on public.product_units
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists product_units_owner_delete on public.product_units;
create policy product_units_owner_delete on public.product_units
  for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists product_units_staff_select on public.product_units;
create policy product_units_staff_select on public.product_units
  for select to authenticated using (
    owner_id = public.current_staff_owner()
    and public.staff_can_access_any(array['inventory', 'quotations', 'bookings', 'create_booking'])
  );

grant select, insert, update, delete on public.product_units to authenticated;
grant usage, select on sequence public.product_units_id_seq to authenticated;
