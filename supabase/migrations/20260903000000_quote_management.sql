-- Quote management module
-- Tracks which bookings originated as a saved quote so the Quotes
-- workspace can list them and follow their Generated -> Converted /
-- Rejected lifecycle, independently of the booking's own status.

alter table public.bookings
  add column if not exists is_quote boolean not null default false;

create index if not exists bookings_owner_is_quote_idx
  on public.bookings (owner_id, is_quote, status);

-- Re-create create_booking_quote so it also flags the row as a quote.
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
  set status = 'draft', payment_status = 'unpaid', paid_amount = 0, balance_amount = total, is_quote = true
  where id = created_booking.id
  returning * into created_booking;

  insert into public.booking_activity (owner_id, booking_id, action, details)
  values ((select auth.uid()), created_booking.id, 'quote_saved', jsonb_build_object('total', created_booking.total));

  return created_booking;
end;
$$;

revoke all on function public.create_booking_quote(jsonb) from public, anon;
grant execute on function public.create_booking_quote(jsonb) to authenticated;

-- Accepting or rejecting a quote reuses change_booking_status(id, 'confirmed' | 'cancelled'),
-- which already enforces valid transitions for both sale and rental bookings.
