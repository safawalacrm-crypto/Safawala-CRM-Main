-- Use four-digit counters for every Safawala document series while keeping
-- the existing SW-S / SW-R / SW-Q prefixes and independent yearly ranges.

begin;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.create_booking(jsonb)'::regprocedure)
    into function_definition;

  if position('lpad(next_number::text, 5, ''0'')' in function_definition) = 0 then
    raise exception 'Expected five-digit create_booking format was not found';
  end if;

  execute replace(
    function_definition,
    'lpad(next_number::text, 5, ''0'')',
    'lpad(next_number::text, 4, ''0'')'
  );
end;
$migration$;

-- Temporarily move document numbers out of the way so the unique constraint
-- cannot collide while existing records receive their four-digit numbers.
update public.bookings
set booking_number = 'SW-TMP-' || id::text;

with independently_ordered as (
  select
    id,
    case
      when is_quote then 'Q'
      when booking_type = 'rental' then 'R'
      else 'S'
    end as series,
    extract(year from created_at)::integer as booking_year,
    row_number() over (
      partition by
        case
          when is_quote then 'Q'
          when booking_type = 'rental' then 'R'
          else 'S'
        end,
        extract(year from created_at)
      order by created_at asc, id asc
    ) as series_number
  from public.bookings
)
update public.bookings b
set booking_number = 'SW-' || ordered.series || '-' || ordered.booking_year::text || '-' || lpad(ordered.series_number::text, 4, '0')
from independently_ordered ordered
where b.id = ordered.id;

commit;
