-- One-time backfill: renumber every existing booking/quote to the new
-- SW-S- / SW-R- / SW-Q- format, in original creation order, so old
-- records read the same as new ones. Nothing else about the row changes.

with ordered_bookings as (
  select id, booking_type, created_at,
         row_number() over (order by created_at asc, id asc) as rn
  from public.bookings
  where not is_quote
)
update public.bookings b
set booking_number = 'SW-' || case when b.booking_type = 'rental' then 'R' else 'S' end
  || '-' || to_char(b.created_at, 'YYYY') || '-' || lpad(ob.rn::text, 5, '0')
from ordered_bookings ob
where b.id = ob.id;

with ordered_quotes as (
  select id, created_at,
         row_number() over (order by created_at asc, id asc) as rn
  from public.bookings
  where is_quote
)
update public.bookings b
set booking_number = 'SW-Q-' || to_char(b.created_at, 'YYYY') || '-' || lpad(oq.rn::text, 5, '0')
from ordered_quotes oq
where b.id = oq.id;

select setval('public.booking_number_seq', greatest((select count(*) from public.bookings where not is_quote), 1), true);
select setval('public.quote_number_seq', greatest((select count(*) from public.bookings where is_quote), 1), true);
