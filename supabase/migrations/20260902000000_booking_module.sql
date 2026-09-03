-- Safawala CRM booking module
-- All public data is isolated per authenticated user through RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  phone text not null check (length(trim(phone)) >= 7),
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, phone)
);

create table public.staff_members (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.products (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sku text,
  name text not null check (length(trim(name)) >= 2),
  description text,
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  rental_price numeric(12,2) not null default 0 check (rental_price >= 0),
  security_deposit numeric(12,2) not null default 0 check (security_deposit >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, sku)
);

create table public.packages (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  description text,
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  rental_price numeric(12,2) not null default 0 check (rental_price >= 0),
  security_deposit numeric(12,2) not null default 0 check (security_deposit >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.package_items (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  package_id bigint not null references public.packages(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unique (package_id, product_id)
);

create sequence public.booking_number_seq;

create table public.bookings (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_number text not null unique,
  booking_type text not null check (booking_type in ('sale', 'rental')),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'ready', 'out_for_delivery', 'active', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid', 'refunded')),
  customer_id bigint not null references public.customers(id) on delete restrict,
  assigned_staff_id bigint references public.staff_members(id) on delete set null,
  event_name text not null check (length(trim(event_name)) >= 2),
  event_date date not null,
  event_time time,
  event_location text,
  pickup_date date,
  due_date date,
  returned_at timestamptz,
  notes text,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  security_deposit numeric(12,2) not null default 0 check (security_deposit >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  balance_amount numeric(12,2) not null default 0 check (balance_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (booking_type = 'rental' or (pickup_date is null and due_date is null)),
  check (booking_type = 'sale' or (pickup_date is not null and due_date is not null and due_date >= pickup_date))
);

create table public.booking_items (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id bigint not null references public.bookings(id) on delete cascade,
  product_id bigint references public.products(id) on delete restrict,
  package_id bigint references public.packages(id) on delete restrict,
  item_name text not null check (length(trim(item_name)) >= 2),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  security_deposit numeric(12,2) not null default 0 check (security_deposit >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  check (not (product_id is not null and package_id is not null))
);

create table public.booking_payments (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id bigint not null references public.bookings(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'upi', 'bank_transfer', 'other')),
  reference_number text,
  notes text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.rental_returns (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id bigint not null unique references public.bookings(id) on delete cascade,
  condition_notes text,
  damage_charge numeric(12,2) not null default 0 check (damage_charge >= 0),
  late_charge numeric(12,2) not null default 0 check (late_charge >= 0),
  refund_amount numeric(12,2) not null default 0 check (refund_amount >= 0),
  returned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.booking_activity (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_id bigint not null references public.bookings(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index customers_owner_name_idx on public.customers (owner_id, name);
create index staff_members_owner_active_idx on public.staff_members (owner_id, is_active);
create index products_owner_active_idx on public.products (owner_id, is_active);
create index packages_owner_active_idx on public.packages (owner_id, is_active);
create index package_items_owner_id_idx on public.package_items (owner_id);
create index package_items_product_id_idx on public.package_items (product_id);
create index bookings_owner_created_idx on public.bookings (owner_id, created_at desc);
create index bookings_owner_event_idx on public.bookings (owner_id, event_date);
create index bookings_owner_status_event_idx on public.bookings (owner_id, status, event_date);
create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_assigned_staff_id_idx on public.bookings (assigned_staff_id);
create index booking_items_owner_id_idx on public.booking_items (owner_id);
create index booking_items_booking_id_idx on public.booking_items (booking_id);
create index booking_items_product_id_idx on public.booking_items (product_id) where product_id is not null;
create index booking_items_package_id_idx on public.booking_items (package_id) where package_id is not null;
create index booking_payments_owner_id_idx on public.booking_payments (owner_id);
create index booking_payments_booking_id_idx on public.booking_payments (booking_id);
create index booking_activity_owner_id_idx on public.booking_activity (owner_id);
create index booking_activity_booking_created_idx on public.booking_activity (booking_id, created_at desc);
create index rental_returns_owner_id_idx on public.rental_returns (owner_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger staff_members_set_updated_at before update on public.staff_members for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger packages_set_updated_at before update on public.packages for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)) from auth.users
on conflict (id) do nothing;

create or replace function public.create_booking(payload jsonb)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  customer_key bigint;
  created_booking public.bookings;
  calculated_subtotal numeric(12,2);
  calculated_deposit numeric(12,2);
  discount_value numeric(12,2) := greatest(coalesce((payload ->> 'discount')::numeric, 0), 0);
  tax_value numeric(12,2) := greatest(coalesce((payload ->> 'tax')::numeric, 0), 0);
  paid_value numeric(12,2) := greatest(coalesce((payload ->> 'paid_amount')::numeric, 0), 0);
  row_item jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then raise exception 'At least one booking item is required'; end if;

  if nullif(payload ->> 'customer_id', '') is not null then
    select id into customer_key from public.customers where id = (payload ->> 'customer_id')::bigint and owner_id = caller;
  else
    insert into public.customers (owner_id, name, phone, email, address)
    values (caller, trim(payload #>> '{customer,name}'), trim(payload #>> '{customer,phone}'), nullif(trim(payload #>> '{customer,email}'), ''), nullif(trim(payload #>> '{customer,address}'), ''))
    on conflict (owner_id, phone) do update set name = excluded.name, email = coalesce(excluded.email, public.customers.email), address = coalesce(excluded.address, public.customers.address)
    returning id into customer_key;
  end if;
  if customer_key is null then raise exception 'A valid customer is required'; end if;

  select coalesce(sum((item ->> 'quantity')::integer * (item ->> 'unit_price')::numeric), 0),
         coalesce(sum(coalesce((item ->> 'security_deposit')::numeric, 0)), 0)
    into calculated_subtotal, calculated_deposit
  from jsonb_array_elements(payload -> 'items') item;

  if paid_value > greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0) then raise exception 'Paid amount cannot exceed booking total'; end if;

  insert into public.bookings (
    owner_id, booking_number, booking_type, status, payment_status, customer_id, assigned_staff_id,
    event_name, event_date, event_time, event_location, pickup_date, due_date, notes,
    subtotal, discount, tax, security_deposit, total, paid_amount, balance_amount
  ) values (
    caller,
    'BK-' || case when payload ->> 'booking_type' = 'rental' then 'R' else 'S' end || '-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.booking_number_seq')::text, 5, '0'),
    payload ->> 'booking_type',
    'confirmed',
    case when paid_value = 0 then 'unpaid' when paid_value >= greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0) then 'paid' else 'partial' end,
    customer_key, nullif(payload ->> 'assigned_staff_id', '')::bigint,
    trim(payload ->> 'event_name'), (payload ->> 'event_date')::date, nullif(payload ->> 'event_time', '')::time,
    nullif(trim(payload ->> 'event_location'), ''), nullif(payload ->> 'pickup_date', '')::date, nullif(payload ->> 'due_date', '')::date,
    nullif(trim(payload ->> 'notes'), ''), calculated_subtotal, discount_value, tax_value, calculated_deposit,
    greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0), paid_value,
    greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit - paid_value, 0)
  ) returning * into created_booking;

  for row_item in select * from jsonb_array_elements(payload -> 'items') loop
    insert into public.booking_items (owner_id, booking_id, product_id, package_id, item_name, quantity, unit_price, security_deposit)
    values (caller, created_booking.id, nullif(row_item ->> 'product_id', '')::bigint, nullif(row_item ->> 'package_id', '')::bigint,
      trim(row_item ->> 'item_name'), (row_item ->> 'quantity')::integer, (row_item ->> 'unit_price')::numeric,
      greatest(coalesce((row_item ->> 'security_deposit')::numeric, 0), 0));
  end loop;

  if paid_value > 0 then
    insert into public.booking_payments (owner_id, booking_id, amount, payment_method, reference_number)
    values (caller, created_booking.id, paid_value, coalesce(nullif(payload ->> 'payment_method', ''), 'cash'), nullif(payload ->> 'payment_reference', ''));
  end if;

  insert into public.booking_activity (owner_id, booking_id, action, details)
  values (caller, created_booking.id, 'booking_created', jsonb_build_object('status', created_booking.status, 'total', created_booking.total));
  return created_booking;
end;
$$;

create or replace function public.change_booking_status(booking_key bigint, next_status text)
returns public.bookings language plpgsql security invoker set search_path = '' as $$
declare caller uuid := (select auth.uid()); current_booking public.bookings; updated_booking public.bookings;
begin
  select * into current_booking from public.bookings where id = booking_key and owner_id = caller for update;
  if current_booking.id is null then raise exception 'Booking not found'; end if;
  if next_status not in ('draft','confirmed','ready','out_for_delivery','active','completed','cancelled') then raise exception 'Invalid booking status'; end if;
  if current_booking.status in ('completed','cancelled') then raise exception 'A closed booking cannot change status'; end if;
  if current_booking.booking_type = 'rental' and not (
    (current_booking.status = 'draft' and next_status in ('confirmed','cancelled')) or
    (current_booking.status = 'confirmed' and next_status in ('ready','cancelled')) or
    (current_booking.status = 'ready' and next_status in ('out_for_delivery','active','cancelled')) or
    (current_booking.status = 'out_for_delivery' and next_status in ('active','cancelled')) or
    (current_booking.status = 'active' and next_status = 'completed')
  ) then raise exception 'Invalid rental status transition'; end if;
  update public.bookings set status = next_status where id = booking_key returning * into updated_booking;
  insert into public.booking_activity (owner_id, booking_id, action, details)
  values (caller, booking_key, 'status_changed', jsonb_build_object('from', current_booking.status, 'to', next_status));
  return updated_booking;
end;
$$;

create or replace function public.record_booking_payment(booking_key bigint, payment_amount numeric, method text, reference text default null)
returns public.bookings language plpgsql security invoker set search_path = '' as $$
declare caller uuid := (select auth.uid()); current_booking public.bookings; new_paid numeric(12,2); updated_booking public.bookings;
begin
  select * into current_booking from public.bookings where id = booking_key and owner_id = caller for update;
  if current_booking.id is null then raise exception 'Booking not found'; end if;
  if payment_amount <= 0 or current_booking.paid_amount + payment_amount > current_booking.total then raise exception 'Payment amount is invalid'; end if;
  if method not in ('cash','card','upi','bank_transfer','other') then raise exception 'Invalid payment method'; end if;
  insert into public.booking_payments (owner_id, booking_id, amount, payment_method, reference_number) values (caller, booking_key, payment_amount, method, nullif(reference, ''));
  new_paid := current_booking.paid_amount + payment_amount;
  update public.bookings set paid_amount = new_paid, balance_amount = total - new_paid, payment_status = case when new_paid >= total then 'paid' else 'partial' end where id = booking_key returning * into updated_booking;
  insert into public.booking_activity (owner_id, booking_id, action, details) values (caller, booking_key, 'payment_recorded', jsonb_build_object('amount', payment_amount, 'method', method));
  return updated_booking;
end;
$$;

create or replace function public.process_rental_return(booking_key bigint, damage numeric default 0, late numeric default 0, condition_text text default null)
returns public.bookings language plpgsql security invoker set search_path = '' as $$
declare caller uuid := (select auth.uid()); current_booking public.bookings; refund numeric(12,2); updated_booking public.bookings;
begin
  select * into current_booking from public.bookings where id = booking_key and owner_id = caller for update;
  if current_booking.id is null or current_booking.booking_type <> 'rental' then raise exception 'Rental booking not found'; end if;
  if current_booking.status <> 'active' then raise exception 'Only active rentals can be returned'; end if;
  if damage < 0 or late < 0 then raise exception 'Charges cannot be negative'; end if;
  refund := greatest(current_booking.security_deposit - damage - late, 0);
  insert into public.rental_returns (owner_id, booking_id, condition_notes, damage_charge, late_charge, refund_amount) values (caller, booking_key, nullif(condition_text, ''), damage, late, refund);
  update public.bookings set status = 'completed', returned_at = now() where id = booking_key returning * into updated_booking;
  insert into public.booking_activity (owner_id, booking_id, action, details) values (caller, booking_key, 'rental_returned', jsonb_build_object('damage_charge', damage, 'late_charge', late, 'refund_amount', refund));
  return updated_booking;
end;
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.staff_members enable row level security;
alter table public.products enable row level security;
alter table public.packages enable row level security;
alter table public.package_items enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_payments enable row level security;
alter table public.rental_returns enable row level security;
alter table public.booking_activity enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$ declare table_name text; begin
  foreach table_name in array array['customers','staff_members','products','packages','package_items','bookings','booking_items','booking_payments','rental_returns','booking_activity'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', table_name || '_update_own', table_name);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles, public.customers, public.staff_members, public.products, public.packages, public.package_items, public.bookings, public.booking_items, public.booking_payments, public.rental_returns, public.booking_activity to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on function public.create_booking(jsonb) from public, anon;
revoke all on function public.change_booking_status(bigint, text) from public, anon;
revoke all on function public.record_booking_payment(bigint, numeric, text, text) from public, anon;
revoke all on function public.process_rental_return(bigint, numeric, numeric, text) from public, anon;
grant execute on function public.create_booking(jsonb) to authenticated;
grant execute on function public.change_booking_status(bigint, text) to authenticated;
grant execute on function public.record_booking_payment(bigint, numeric, text, text) to authenticated;
grant execute on function public.process_rental_return(bigint, numeric, numeric, text) to authenticated;
