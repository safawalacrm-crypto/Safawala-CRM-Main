-- Save a booking atomically as a draft quote while reusing booking validation.
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
  set status = 'draft', payment_status = 'unpaid', paid_amount = 0, balance_amount = total
  where id = created_booking.id
  returning * into created_booking;

  insert into public.booking_activity (owner_id, booking_id, action, details)
  values ((select auth.uid()), created_booking.id, 'quote_saved', jsonb_build_object('total', created_booking.total));

  return created_booking;
end;
$$;

revoke all on function public.create_booking_quote(jsonb) from public, anon;
grant execute on function public.create_booking_quote(jsonb) to authenticated;
