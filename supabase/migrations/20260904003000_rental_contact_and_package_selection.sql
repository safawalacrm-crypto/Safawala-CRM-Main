-- Rental contacts and Package Manager variants used by booking workflows.

begin;

alter table public.bookings
  add column if not exists contact_name text,
  add column if not exists alternate_mobile text;

alter table public.booking_items
  add column if not exists package_variant_id bigint
    references public.package_variants(id) on delete restrict;

create index if not exists booking_items_package_variant_id_idx
  on public.booking_items (package_variant_id)
  where package_variant_id is not null;

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
  quote_requested boolean := coalesce((payload ->> 'is_quote')::boolean, false);
  booking_kind text := case when payload ->> 'booking_type' = 'rental' then 'rental' else 'sale' end;
  number_prefix text;
  next_number integer;
  generated_number text;
  row_item jsonb;
  variant_key bigint;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'At least one booking item is required';
  end if;
  if booking_kind = 'rental' and nullif(trim(payload ->> 'contact_name'), '') is null then
    raise exception 'Contact name is required for rental bookings';
  end if;
  if booking_kind = 'rental' and coalesce(payload ->> 'alternate_mobile', '') !~ '^[0-9]{10}$' then
    raise exception 'A valid 10-digit alternate mobile number is required for rental bookings';
  end if;

  if nullif(payload ->> 'customer_id', '') is not null then
    select id into customer_key
    from public.customers
    where id = (payload ->> 'customer_id')::bigint and owner_id = caller;
  else
    insert into public.customers (owner_id, name, phone, email, address)
    values (
      caller,
      trim(payload #>> '{customer,name}'),
      trim(payload #>> '{customer,phone}'),
      nullif(trim(payload #>> '{customer,email}'), ''),
      nullif(trim(payload #>> '{customer,address}'), '')
    )
    on conflict (owner_id, phone) do update
      set name = excluded.name,
          email = coalesce(excluded.email, public.customers.email),
          address = coalesce(excluded.address, public.customers.address)
    returning id into customer_key;
  end if;
  if customer_key is null then raise exception 'A valid customer is required'; end if;

  select
    coalesce(sum((item ->> 'quantity')::integer * (item ->> 'unit_price')::numeric), 0),
    coalesce(sum(coalesce((item ->> 'security_deposit')::numeric, 0)), 0)
  into calculated_subtotal, calculated_deposit
  from jsonb_array_elements(payload -> 'items') item;

  if paid_value > greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0) then
    raise exception 'Paid amount cannot exceed booking total';
  end if;

  number_prefix := case
    when quote_requested and booking_kind = 'rental' then 'SW-Q-R-'
    when quote_requested then 'SW-Q-S-'
    when booking_kind = 'rental' then 'SW-R-'
    else 'SW-S-'
  end || to_char(current_date, 'YYYY') || '-';
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(number_prefix, 0));
  select coalesce(max(substring(booking_number from '([0-9]+)$')::integer), 0) + 1
  into next_number
  from public.bookings
  where booking_number like number_prefix || '%';
  generated_number := number_prefix || lpad(next_number::text, 4, '0');

  insert into public.bookings (
    owner_id, booking_number, booking_type, status, payment_status, is_quote,
    customer_id, assigned_staff_id, event_name, event_date, event_time,
    event_location, contact_name, alternate_mobile, pickup_date, due_date,
    notes, subtotal, discount, tax, security_deposit, total, paid_amount,
    balance_amount
  ) values (
    caller, generated_number, booking_kind,
    case when quote_requested then 'draft' else 'confirmed' end,
    case
      when quote_requested or paid_value = 0 then 'unpaid'
      when paid_value >= greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0) then 'paid'
      else 'partial'
    end,
    quote_requested, customer_key,
    nullif(payload ->> 'assigned_staff_id', '')::bigint,
    trim(payload ->> 'event_name'), (payload ->> 'event_date')::date,
    nullif(payload ->> 'event_time', '')::time,
    nullif(trim(payload ->> 'event_location'), ''),
    case when booking_kind = 'rental' then nullif(trim(payload ->> 'contact_name'), '') else null end,
    case when booking_kind = 'rental' then payload ->> 'alternate_mobile' else null end,
    nullif(payload ->> 'pickup_date', '')::date,
    nullif(payload ->> 'due_date', '')::date,
    nullif(trim(payload ->> 'notes'), ''), calculated_subtotal,
    discount_value, tax_value, calculated_deposit,
    greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0),
    case when quote_requested then 0 else paid_value end,
    greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit
      - case when quote_requested then 0 else paid_value end, 0)
  ) returning * into created_booking;

  for row_item in select * from jsonb_array_elements(payload -> 'items') loop
    variant_key := nullif(row_item ->> 'package_variant_id', '')::bigint;
    if variant_key is not null and not exists (
      select 1 from public.package_variants
      where id = variant_key and owner_id = caller
    ) then
      raise exception 'A selected rental package is unavailable';
    end if;

    insert into public.booking_items (
      owner_id, booking_id, product_id, package_id, package_variant_id,
      item_name, quantity, unit_price, security_deposit
    ) values (
      caller, created_booking.id,
      nullif(row_item ->> 'product_id', '')::bigint,
      nullif(row_item ->> 'package_id', '')::bigint,
      variant_key, trim(row_item ->> 'item_name'),
      (row_item ->> 'quantity')::integer,
      (row_item ->> 'unit_price')::numeric,
      greatest(coalesce((row_item ->> 'security_deposit')::numeric, 0), 0)
    );
  end loop;

  if not quote_requested and paid_value > 0 then
    insert into public.booking_payments (
      owner_id, booking_id, amount, payment_method, reference_number
    ) values (
      caller, created_booking.id, paid_value,
      coalesce(nullif(payload ->> 'payment_method', ''), 'cash'),
      nullif(payload ->> 'payment_reference', '')
    );
  end if;

  insert into public.booking_activity (owner_id, booking_id, action, details)
  values (
    caller, created_booking.id, 'booking_created',
    jsonb_build_object('status', created_booking.status, 'total', created_booking.total)
  );
  return created_booking;
end;
$$;

create or replace function public.update_booking_details(booking_key bigint, payload jsonb)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_booking public.bookings;
  customer_key bigint;
  calculated_subtotal numeric(12,2);
  calculated_deposit numeric(12,2);
  discount_value numeric(12,2) := greatest(coalesce((payload ->> 'discount')::numeric, 0), 0);
  tax_value numeric(12,2) := greatest(coalesce((payload ->> 'tax')::numeric, 0), 0);
  row_item jsonb;
  variant_key bigint;
  updated_booking public.bookings;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into current_booking from public.bookings
  where id = booking_key and owner_id = caller for update;
  if current_booking.id is null then raise exception 'Booking not found'; end if;
  if current_booking.paid_amount > 0 then
    raise exception 'Items cannot be edited once a payment has been recorded';
  end if;
  if current_booking.status in ('completed', 'cancelled') then
    raise exception 'A closed booking cannot be edited';
  end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'At least one booking item is required';
  end if;
  if current_booking.booking_type = 'rental' and nullif(trim(payload ->> 'contact_name'), '') is null then
    raise exception 'Contact name is required for rental bookings';
  end if;
  if current_booking.booking_type = 'rental' and coalesce(payload ->> 'alternate_mobile', '') !~ '^[0-9]{10}$' then
    raise exception 'A valid 10-digit alternate mobile number is required for rental bookings';
  end if;

  if nullif(payload ->> 'customer_id', '') is not null then
    select id into customer_key from public.customers
    where id = (payload ->> 'customer_id')::bigint and owner_id = caller;
  else
    customer_key := current_booking.customer_id;
  end if;
  if customer_key is null then raise exception 'A valid customer is required'; end if;

  select coalesce(sum((item ->> 'quantity')::integer * (item ->> 'unit_price')::numeric), 0),
         coalesce(sum(coalesce((item ->> 'security_deposit')::numeric, 0)), 0)
  into calculated_subtotal, calculated_deposit
  from jsonb_array_elements(payload -> 'items') item;

  update public.bookings set
    customer_id = customer_key,
    assigned_staff_id = nullif(payload ->> 'assigned_staff_id', '')::bigint,
    event_name = trim(payload ->> 'event_name'),
    event_date = (payload ->> 'event_date')::date,
    event_time = nullif(payload ->> 'event_time', '')::time,
    event_location = nullif(trim(payload ->> 'event_location'), ''),
    contact_name = case when current_booking.booking_type = 'rental'
      then nullif(trim(payload ->> 'contact_name'), '') else null end,
    alternate_mobile = case when current_booking.booking_type = 'rental'
      then payload ->> 'alternate_mobile' else null end,
    pickup_date = case when current_booking.booking_type = 'rental'
      then nullif(payload ->> 'pickup_date', '')::date else null end,
    due_date = case when current_booking.booking_type = 'rental'
      then nullif(payload ->> 'due_date', '')::date else null end,
    notes = nullif(trim(payload ->> 'notes'), ''),
    subtotal = calculated_subtotal, discount = discount_value, tax = tax_value,
    security_deposit = calculated_deposit,
    total = greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0),
    balance_amount = greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0)
  where id = booking_key;

  delete from public.booking_items where booking_id = booking_key;

  for row_item in select * from jsonb_array_elements(payload -> 'items') loop
    variant_key := nullif(row_item ->> 'package_variant_id', '')::bigint;
    if variant_key is not null and not exists (
      select 1 from public.package_variants
      where id = variant_key and owner_id = caller
    ) then
      raise exception 'A selected rental package is unavailable';
    end if;

    insert into public.booking_items (
      owner_id, booking_id, product_id, package_id, package_variant_id,
      item_name, quantity, unit_price, security_deposit
    ) values (
      caller, booking_key,
      nullif(row_item ->> 'product_id', '')::bigint,
      nullif(row_item ->> 'package_id', '')::bigint,
      variant_key, trim(row_item ->> 'item_name'),
      (row_item ->> 'quantity')::integer,
      (row_item ->> 'unit_price')::numeric,
      greatest(coalesce((row_item ->> 'security_deposit')::numeric, 0), 0)
    );
  end loop;

  insert into public.booking_activity (owner_id, booking_id, action, details)
  values (
    caller, booking_key, 'booking_details_updated',
    jsonb_build_object('total', greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0))
  );
  select * into updated_booking from public.bookings where id = booking_key;
  return updated_booking;
end;
$$;

revoke all on function public.create_booking(jsonb) from public, anon;
grant execute on function public.create_booking(jsonb) to authenticated;
revoke all on function public.update_booking_details(bigint, jsonb) from public, anon;
grant execute on function public.update_booking_details(bigint, jsonb) to authenticated;

commit;
