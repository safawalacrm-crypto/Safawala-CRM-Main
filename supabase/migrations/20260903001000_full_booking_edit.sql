-- Allow fully editing a booking's items and pricing (not just logistics)
-- as long as no payment has been recorded against it yet. This covers
-- every quote (always paid_amount = 0) and any not-yet-paid live booking.
-- Once a payment is recorded, totals stay protected and only the
-- existing logistics-only edit path (direct update on bookings) applies.

create policy booking_items_delete_own on public.booking_items
  for delete to authenticated using ((select auth.uid()) = owner_id);
grant delete on public.booking_items to authenticated;

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
  updated_booking public.bookings;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into current_booking from public.bookings where id = booking_key and owner_id = caller for update;
  if current_booking.id is null then raise exception 'Booking not found'; end if;
  if current_booking.paid_amount > 0 then raise exception 'Items cannot be edited once a payment has been recorded'; end if;
  if current_booking.status in ('completed', 'cancelled') then raise exception 'A closed booking cannot be edited'; end if;
  if jsonb_array_length(coalesce(payload -> 'items', '[]'::jsonb)) = 0 then raise exception 'At least one booking item is required'; end if;

  if nullif(payload ->> 'customer_id', '') is not null then
    select id into customer_key from public.customers where id = (payload ->> 'customer_id')::bigint and owner_id = caller;
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
    pickup_date = case when current_booking.booking_type = 'rental' then nullif(payload ->> 'pickup_date', '')::date else null end,
    due_date = case when current_booking.booking_type = 'rental' then nullif(payload ->> 'due_date', '')::date else null end,
    notes = nullif(trim(payload ->> 'notes'), ''),
    subtotal = calculated_subtotal,
    discount = discount_value,
    tax = tax_value,
    security_deposit = calculated_deposit,
    total = greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0),
    balance_amount = greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0)
  where id = booking_key;

  delete from public.booking_items where booking_id = booking_key;

  for row_item in select * from jsonb_array_elements(payload -> 'items') loop
    insert into public.booking_items (owner_id, booking_id, product_id, package_id, item_name, quantity, unit_price, security_deposit)
    values (caller, booking_key, nullif(row_item ->> 'product_id', '')::bigint, nullif(row_item ->> 'package_id', '')::bigint,
      trim(row_item ->> 'item_name'), (row_item ->> 'quantity')::integer, (row_item ->> 'unit_price')::numeric,
      greatest(coalesce((row_item ->> 'security_deposit')::numeric, 0), 0));
  end loop;

  insert into public.booking_activity (owner_id, booking_id, action, details)
  values (caller, booking_key, 'booking_details_updated', jsonb_build_object('total', greatest(calculated_subtotal - discount_value + tax_value + calculated_deposit, 0)));

  select * into updated_booking from public.bookings where id = booking_key;
  return updated_booking;
end;
$$;

revoke all on function public.update_booking_details(bigint, jsonb) from public, anon;
grant execute on function public.update_booking_details(bigint, jsonb) to authenticated;
