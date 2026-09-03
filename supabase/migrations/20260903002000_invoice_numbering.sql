-- Rebrand booking numbers from "BK-" to "SW-" (SW-S-2026-00001 for sales,
-- SW-R-2026-00001 for rentals), and give quotes their own numbering
-- series so every quote reads as SW-Q-2026-00001, distinct from live
-- booking numbers. Applies to every booking/quote created from now on;
-- existing numbers are left untouched (no data is rewritten).

create sequence if not exists public.quote_number_seq;

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
    'SW-' || case when payload ->> 'booking_type' = 'rental' then 'R' else 'S' end || '-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.booking_number_seq')::text, 5, '0'),
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

create or replace function public.create_booking_quote(payload jsonb)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_booking public.bookings;
begin
  created_booking := public.create_booking(payload || jsonb_build_object('paid_amount', 0));

  update public.bookings
  set status = 'draft', payment_status = 'unpaid', paid_amount = 0, balance_amount = total, is_quote = true,
      booking_number = 'SW-Q-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text, 5, '0')
  where id = created_booking.id
  returning * into created_booking;

  insert into public.booking_activity (owner_id, booking_id, action, details)
  values ((select auth.uid()), created_booking.id, 'quote_saved', jsonb_build_object('total', created_booking.total));

  return created_booking;
end;
$$;

revoke all on function public.create_booking(jsonb) from public, anon;
revoke all on function public.create_booking_quote(jsonb) from public, anon;
grant execute on function public.create_booking(jsonb) to authenticated;
grant execute on function public.create_booking_quote(jsonb) to authenticated;
