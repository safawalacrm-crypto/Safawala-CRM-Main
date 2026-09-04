-- User-owned numbering for sale/rental bookings and quotations.

begin;

create table if not exists public.document_number_settings (
  owner_id uuid not null references auth.users(id) on delete cascade,
  series text not null check (
    series in ('sale_booking', 'rental_booking', 'sale_quote', 'rental_quote')
  ),
  prefix text not null check (prefix ~ '^[A-Z0-9-]{2,24}-$'),
  next_number integer not null default 1 check (next_number between 1 and 99999999),
  number_padding smallint not null default 4 check (number_padding between 2 and 8),
  sequence_year integer not null default extract(year from current_date)::integer
    check (sequence_year between 2000 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, series)
);

alter table public.document_number_settings enable row level security;

drop policy if exists "Users can view own document number settings"
  on public.document_number_settings;
create policy "Users can view own document number settings"
  on public.document_number_settings for select
  using ((select auth.uid()) = owner_id);

drop policy if exists "Users can create own document number settings"
  on public.document_number_settings;
create policy "Users can create own document number settings"
  on public.document_number_settings for insert
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update own document number settings"
  on public.document_number_settings;
create policy "Users can update own document number settings"
  on public.document_number_settings for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop trigger if exists document_number_settings_updated_at
  on public.document_number_settings;
create trigger document_number_settings_updated_at
before update on public.document_number_settings
for each row execute function public.set_updated_at();

with owners as (
  select id as owner_id from public.profiles
  union
  select distinct owner_id from public.bookings
), series_defaults(series, prefix, booking_type, is_quote) as (
  values
    ('sale_booking', 'SW-S-', 'sale', false),
    ('rental_booking', 'SW-R-', 'rental', false),
    ('sale_quote', 'SW-Q-S-', 'sale', true),
    ('rental_quote', 'SW-Q-R-', 'rental', true)
)
insert into public.document_number_settings (
  owner_id, series, prefix, next_number, number_padding, sequence_year
)
select
  owners.owner_id,
  defaults.series,
  defaults.prefix,
  coalesce(max(substring(bookings.booking_number from '([0-9]+)$')::integer), 0) + 1,
  4,
  extract(year from current_date)::integer
from owners
cross join series_defaults defaults
left join public.bookings bookings
  on bookings.owner_id = owners.owner_id
  and bookings.booking_type = defaults.booking_type
  and bookings.is_quote = defaults.is_quote
  and extract(year from bookings.created_at) = extract(year from current_date)
group by owners.owner_id, defaults.series, defaults.prefix
on conflict (owner_id, series) do nothing;

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
  current_year integer := extract(year from current_date)::integer;
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
    caller, series_key, fallback_prefix, 1, 4, current_year
  ) on conflict (owner_id, series) do nothing;

  select * into settings_row
  from public.document_number_settings
  where owner_id = caller and series = series_key
  for update;

  candidate := case
    when settings_row.sequence_year = current_year then settings_row.next_number
    else 1
  end;

  loop
    generated := settings_row.prefix || current_year::text || '-'
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
  set next_number = candidate + 1,
      sequence_year = current_year
  where owner_id = caller and series = series_key;

  return generated;
end;
$$;

create or replace function public.assign_booking_document_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.booking_number := public.next_document_number(
    new.owner_id,
    new.is_quote,
    new.booking_type
  );
  return new;
end;
$$;

drop trigger if exists bookings_assign_document_number on public.bookings;
create trigger bookings_assign_document_number
before insert on public.bookings
for each row execute function public.assign_booking_document_number();

revoke all on function public.next_document_number(uuid, boolean, text)
  from public, anon;
revoke all on function public.assign_booking_document_number()
  from public, anon;
grant execute on function public.next_document_number(uuid, boolean, text)
  to authenticated;

commit;
