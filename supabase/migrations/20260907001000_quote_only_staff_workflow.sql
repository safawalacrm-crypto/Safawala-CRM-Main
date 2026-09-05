-- Quote-only showroom workflow.
-- Staff IDs create quotations under their showroom owner. Main IDs convert
-- those quotations into new bookings using the owner's existing number series.

begin;

alter table public.bookings
  add column if not exists created_by_staff_id bigint references public.staff_members(id) on delete set null,
  add column if not exists source_quote_id bigint references public.bookings(id) on delete set null,
  add column if not exists converted_booking_id bigint references public.bookings(id) on delete set null;

create index if not exists bookings_created_by_staff_idx
  on public.bookings(owner_id, created_by_staff_id, created_at desc);
create unique index if not exists bookings_source_quote_unique
  on public.bookings(source_quote_id) where source_quote_id is not null;
create unique index if not exists bookings_converted_booking_unique
  on public.bookings(converted_booking_id) where converted_booking_id is not null;

create or replace function public.next_document_number(
  caller uuid,
  quote_requested boolean,
  booking_kind text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  series_key text;
  fallback_prefix text;
  settings_row public.document_number_settings;
  default_year integer := extract(year from current_date)::integer;
  candidate integer;
  generated text;
begin
  if actor is null or caller is null then raise exception 'Authentication required'; end if;
  if actor <> caller and not exists (
    select 1 from public.staff_members sm
    where sm.user_id=actor and sm.owner_id=caller and sm.portal_active and sm.is_active
      and (sm.access_type='main' or (sm.access_type='staff' and quote_requested))
  ) then
    raise exception 'Document number access denied';
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
  where owner_id=caller and series=series_key
  for update;

  candidate := settings_row.next_number;
  loop
    generated := settings_row.prefix || settings_row.sequence_year::text || '-'
      || lpad(candidate::text, settings_row.number_padding, '0');
    exit when not exists (select 1 from public.bookings where booking_number=generated);
    candidate := candidate + 1;
    if candidate > 99999999 then raise exception 'Document number range is exhausted'; end if;
  end loop;

  update public.document_number_settings
  set next_number=candidate + 1
  where owner_id=caller and series=series_key;
  return generated;
end;
$$;

create or replace function public.create_booking(payload jsonb)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_role text;
  owner_key uuid;
  actor_staff_id bigint;
  actor_access_type text;
  customer_key bigint;
  assigned_staff_key bigint;
  created_booking public.bookings;
  calculated_subtotal numeric(12,2);
  calculated_deposit numeric(12,2);
  discount_value numeric(12,2) := greatest(coalesce((payload ->> 'discount')::numeric,0),0);
  tax_value numeric(12,2) := greatest(coalesce((payload ->> 'tax')::numeric,0),0);
  paid_value numeric(12,2) := greatest(coalesce((payload ->> 'paid_amount')::numeric,0),0);
  quote_requested boolean := coalesce((payload ->> 'is_quote')::boolean,false);
  booking_kind text := case when payload ->> 'booking_type'='rental' then 'rental' else 'sale' end;
  row_item jsonb;
  variant_key bigint;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select role into actor_role from public.profiles where id=actor;

  if actor_role='admin' then
    owner_key := actor;
  elsif actor_role='staff' then
    select id,owner_id,access_type into actor_staff_id,owner_key,actor_access_type
    from public.staff_members
    where user_id=actor and portal_active and is_active limit 1;
    if actor_staff_id is null then raise exception 'Active staff access is required'; end if;
    if actor_access_type='staff' then
      if not quote_requested then raise exception 'Staff IDs can save quotations only'; end if;
      discount_value := 0; tax_value := 0; paid_value := 0;
      assigned_staff_key := actor_staff_id;
    else
      if not public.staff_can_access('create_booking') then raise exception 'Create booking access denied'; end if;
      if quote_requested and not public.staff_can_access('quotations') then raise exception 'Quotation access denied'; end if;
      if not quote_requested and not public.staff_can_access('bookings') then raise exception 'Booking access denied'; end if;
    end if;
  else
    raise exception 'Booking access denied';
  end if;

  if jsonb_array_length(coalesce(payload -> 'items','[]'::jsonb))=0 then
    raise exception 'At least one booking item is required';
  end if;
  if booking_kind='rental' and nullif(trim(payload ->> 'contact_name'),'') is null then
    raise exception 'Contact name is required for rental bookings';
  end if;
  if booking_kind='rental' and coalesce(payload ->> 'alternate_mobile','') !~ '^[0-9]{10}$' then
    raise exception 'A valid 10-digit alternate mobile number is required for rental bookings';
  end if;

  if nullif(payload ->> 'customer_id','') is not null then
    select id into customer_key from public.customers
    where id=(payload ->> 'customer_id')::bigint and owner_id=owner_key;
  else
    insert into public.customers(owner_id,name,phone,email,address)
    values(owner_key,trim(payload #>> '{customer,name}'),trim(payload #>> '{customer,phone}'),
      nullif(trim(payload #>> '{customer,email}'),''),nullif(trim(payload #>> '{customer,address}'),''))
    on conflict(owner_id,phone) do update set
      name=excluded.name,
      email=coalesce(excluded.email,public.customers.email),
      address=coalesce(excluded.address,public.customers.address)
    returning id into customer_key;
  end if;
  if customer_key is null then raise exception 'A valid customer is required'; end if;

  if assigned_staff_key is null and nullif(payload ->> 'assigned_staff_id','') is not null then
    select id into assigned_staff_key from public.staff_members
    where id=(payload ->> 'assigned_staff_id')::bigint and owner_id=owner_key and is_active;
    if assigned_staff_key is null then raise exception 'Selected staff member is unavailable'; end if;
  end if;

  select coalesce(sum((item ->> 'quantity')::integer*(item ->> 'unit_price')::numeric),0),
         coalesce(sum(coalesce((item ->> 'security_deposit')::numeric,0)),0)
  into calculated_subtotal,calculated_deposit
  from jsonb_array_elements(payload -> 'items') item;

  if paid_value > greatest(calculated_subtotal-discount_value+tax_value+calculated_deposit,0) then
    raise exception 'Paid amount cannot exceed booking total';
  end if;

  insert into public.bookings(
    owner_id,booking_number,booking_type,status,payment_status,is_quote,customer_id,
    assigned_staff_id,created_by_staff_id,event_name,event_date,event_time,event_location,
    contact_name,alternate_mobile,pickup_date,due_date,notes,subtotal,discount,tax,
    security_deposit,total,paid_amount,balance_amount
  ) values (
    owner_key,'PENDING',booking_kind,case when quote_requested then 'draft' else 'confirmed' end,
    case when quote_requested or paid_value=0 then 'unpaid'
      when paid_value>=greatest(calculated_subtotal-discount_value+tax_value+calculated_deposit,0) then 'paid'
      else 'partial' end,
    quote_requested,customer_key,assigned_staff_key,actor_staff_id,trim(payload ->> 'event_name'),
    (payload ->> 'event_date')::date,nullif(payload ->> 'event_time','')::time,
    nullif(trim(payload ->> 'event_location'),''),
    case when booking_kind='rental' then nullif(trim(payload ->> 'contact_name'),'') else null end,
    case when booking_kind='rental' then payload ->> 'alternate_mobile' else null end,
    nullif(payload ->> 'pickup_date','')::date,nullif(payload ->> 'due_date','')::date,
    nullif(trim(payload ->> 'notes'),''),calculated_subtotal,discount_value,tax_value,
    calculated_deposit,greatest(calculated_subtotal-discount_value+tax_value+calculated_deposit,0),
    case when quote_requested then 0 else paid_value end,
    greatest(calculated_subtotal-discount_value+tax_value+calculated_deposit
      - case when quote_requested then 0 else paid_value end,0)
  ) returning * into created_booking;

  for row_item in select * from jsonb_array_elements(payload -> 'items') loop
    variant_key := nullif(row_item ->> 'package_variant_id','')::bigint;
    if variant_key is not null and not exists(
      select 1 from public.package_variants where id=variant_key and owner_id=owner_key
    ) then raise exception 'A selected rental package is unavailable'; end if;

    insert into public.booking_items(
      owner_id,booking_id,product_id,package_id,package_variant_id,item_name,quantity,unit_price,security_deposit
    ) values (
      owner_key,created_booking.id,nullif(row_item ->> 'product_id','')::bigint,
      nullif(row_item ->> 'package_id','')::bigint,variant_key,trim(row_item ->> 'item_name'),
      (row_item ->> 'quantity')::integer,(row_item ->> 'unit_price')::numeric,
      greatest(coalesce((row_item ->> 'security_deposit')::numeric,0),0)
    );
  end loop;

  if not quote_requested and paid_value>0 then
    insert into public.booking_payments(owner_id,booking_id,amount,payment_method,reference_number)
    values(owner_key,created_booking.id,paid_value,
      coalesce(nullif(payload ->> 'payment_method',''),'cash'),nullif(payload ->> 'payment_reference',''));
  end if;

  insert into public.booking_activity(owner_id,booking_id,action,details)
  values(owner_key,created_booking.id,case when quote_requested then 'quote_saved' else 'booking_created' end,
    jsonb_build_object('status',created_booking.status,'total',created_booking.total,'created_by_staff_id',actor_staff_id));
  return created_booking;
end;
$$;

create or replace function public.create_booking_quote(payload jsonb)
returns public.bookings
language sql
security invoker
set search_path = ''
as $$
  select public.create_booking(payload || jsonb_build_object('paid_amount',0,'is_quote',true));
$$;

create or replace function public.convert_quote_to_booking(quote_key bigint)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  owner_key uuid;
  actor_staff_id bigint;
  actor_access_type text;
  source_quote public.bookings;
  created_booking public.bookings;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.profiles where id=actor and role='admin') then
    owner_key := actor;
  else
    select id,owner_id,access_type into actor_staff_id,owner_key,actor_access_type
    from public.staff_members where user_id=actor and portal_active and is_active limit 1;
    if actor_staff_id is null or actor_access_type<>'main'
      or not public.staff_can_access('quotations') or not public.staff_can_access('bookings') then
      raise exception 'Only an authorized Main ID can convert a quote';
    end if;
  end if;

  select * into source_quote from public.bookings
  where id=quote_key and owner_id=owner_key and is_quote for update;
  if source_quote.id is null then raise exception 'Quote not found'; end if;
  if source_quote.converted_booking_id is not null then
    select * into created_booking from public.bookings where id=source_quote.converted_booking_id;
    return created_booking;
  end if;
  if source_quote.status<>'draft' then raise exception 'Only a generated quote can be converted'; end if;

  insert into public.bookings(
    owner_id,booking_number,booking_type,status,payment_status,is_quote,customer_id,
    assigned_staff_id,created_by_staff_id,event_name,event_date,event_time,event_location,
    contact_name,alternate_mobile,pickup_date,due_date,notes,subtotal,discount,tax,
    security_deposit,total,paid_amount,balance_amount,source_quote_id
  ) values (
    owner_key,'PENDING',source_quote.booking_type,'confirmed','unpaid',false,source_quote.customer_id,
    source_quote.assigned_staff_id,source_quote.created_by_staff_id,source_quote.event_name,
    source_quote.event_date,source_quote.event_time,source_quote.event_location,source_quote.contact_name,
    source_quote.alternate_mobile,source_quote.pickup_date,source_quote.due_date,source_quote.notes,
    source_quote.subtotal,source_quote.discount,source_quote.tax,source_quote.security_deposit,
    source_quote.total,0,source_quote.total,source_quote.id
  ) returning * into created_booking;

  insert into public.booking_items(
    owner_id,booking_id,product_id,package_id,package_variant_id,item_name,quantity,unit_price,security_deposit
  ) select owner_key,created_booking.id,product_id,package_id,package_variant_id,item_name,quantity,unit_price,security_deposit
    from public.booking_items where booking_id=source_quote.id;

  update public.bookings set status='confirmed',converted_booking_id=created_booking.id
  where id=source_quote.id;

  insert into public.booking_activity(owner_id,booking_id,action,details) values
    (owner_key,source_quote.id,'quote_converted',jsonb_build_object('booking_id',created_booking.id,'booking_number',created_booking.booking_number,'converted_by',actor_staff_id)),
    (owner_key,created_booking.id,'booking_created_from_quote',jsonb_build_object('quote_id',source_quote.id,'quote_number',source_quote.booking_number,'converted_by',actor_staff_id));
  return created_booking;
end;
$$;

drop policy if exists bookings_staff_select on public.bookings;
create policy bookings_staff_select on public.bookings for select to authenticated using (
  owner_id=public.current_staff_owner() and exists(
    select 1 from public.staff_members sm where sm.id=public.current_staff_member_id() and (
      (sm.access_type='staff' and is_quote and created_by_staff_id=sm.id)
      or (sm.access_type='main' and ((is_quote and public.staff_can_access('quotations')) or (not is_quote and public.staff_can_access('bookings'))))
    )
  )
);

drop policy if exists bookings_booking_staff_insert on public.bookings;
create policy bookings_booking_staff_insert on public.bookings for insert to authenticated with check (
  owner_id=public.current_staff_owner() and exists(
    select 1 from public.staff_members sm where sm.id=public.current_staff_member_id() and (
      (sm.access_type='staff' and is_quote and created_by_staff_id=sm.id and assigned_staff_id=sm.id)
      or (sm.access_type='main' and ((is_quote and public.staff_can_access('quotations')) or (not is_quote and public.staff_can_access('bookings'))))
    )
  )
);

drop policy if exists bookings_booking_staff_update on public.bookings;
create policy bookings_booking_staff_update on public.bookings for update to authenticated using (
  owner_id=public.current_staff_owner() and exists(
    select 1 from public.staff_members sm where sm.id=public.current_staff_member_id() and (
      (sm.access_type='staff' and is_quote and created_by_staff_id=sm.id)
      or (sm.access_type='main' and ((is_quote and public.staff_can_access('quotations')) or (not is_quote and public.staff_can_access('bookings'))))
    )
  )
) with check (
  owner_id=public.current_staff_owner() and exists(
    select 1 from public.staff_members sm where sm.id=public.current_staff_member_id() and (
      (sm.access_type='staff' and is_quote and created_by_staff_id=sm.id)
      or (sm.access_type='main' and ((is_quote and public.staff_can_access('quotations')) or (not is_quote and public.staff_can_access('bookings'))))
    )
  )
);

revoke all on function public.next_document_number(uuid,boolean,text) from public,anon;
revoke all on function public.create_booking(jsonb) from public,anon;
revoke all on function public.create_booking_quote(jsonb) from public,anon;
revoke all on function public.convert_quote_to_booking(bigint) from public,anon;
grant execute on function public.next_document_number(uuid,boolean,text) to authenticated;
grant execute on function public.create_booking(jsonb) to authenticated;
grant execute on function public.create_booking_quote(jsonb) to authenticated;
grant execute on function public.convert_quote_to_booking(bigint) to authenticated;

commit;
