-- Keep each document series on the year explicitly selected in Settings.

begin;

create or replace function public.next_document_number(
  caller uuid,
  quote_requested boolean,
  booking_kind text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  series_key text;
  fallback_prefix text;
  settings_row public.document_number_settings;
  default_year integer := extract(year from current_date)::integer;
  candidate integer;
  generated text;
begin
  if caller is null or caller <> (select auth.uid()) then
    raise exception 'Authentication required';
  end if;

  series_key := case
    when quote_requested and booking_kind = 'rental' then 'rental_quote'
    when quote_requested then 'sale_quote'
    when booking_kind = 'rental' then 'rental_booking'
    else 'sale_booking'
  end;
  fallback_prefix := case series_key
    when 'rental_quote' then 'SW-Q-R-'
    when 'sale_quote' then 'SW-Q-S-'
    when 'rental_booking' then 'SW-R-'
    else 'SW-S-'
  end;

  insert into public.document_number_settings (
    owner_id, series, prefix, next_number, number_padding, sequence_year
  ) values (
    caller, series_key, fallback_prefix, 1, 4, default_year
  ) on conflict (owner_id, series) do nothing;

  select * into settings_row
  from public.document_number_settings
  where owner_id = caller and series = series_key
  for update;

  candidate := settings_row.next_number;

  loop
    generated := settings_row.prefix || settings_row.sequence_year::text || '-'
      || lpad(candidate::text, settings_row.number_padding, '0');
    exit when not exists (
      select 1 from public.bookings where booking_number = generated
    );
    candidate := candidate + 1;
    if candidate > 99999999 then
      raise exception 'Document number range is exhausted';
    end if;
  end loop;

  update public.document_number_settings
  set next_number = candidate + 1
  where owner_id = caller and series = series_key;

  return generated;
end;
$$;

commit;
