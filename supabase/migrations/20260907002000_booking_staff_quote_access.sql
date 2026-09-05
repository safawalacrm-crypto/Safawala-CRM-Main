-- Keep quote-only access inside the Staff Portal and limit it to staff linked
-- to the Booking department.
begin;

create or replace function public.staff_can_access(requested_module text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.staff_members sm
    where sm.user_id=(select auth.uid())
      and sm.portal_active
      and sm.is_active
      and (
        (
          sm.access_type='staff'
          and requested_module in ('quotations','create_booking')
          and exists(
            select 1 from public.staff_departments sd
            where sd.staff_id=sm.id and sd.department='booking'
          )
        )
        or (
          sm.access_type='main'
          and exists(
            select 1 from public.staff_access_modules sam
            where sam.staff_id=sm.id
              and sam.owner_id=sm.owner_id
              and sam.module=requested_module
              and sam.enabled
          )
        )
      )
  )
$$;

create or replace function public.enforce_quote_only_staff()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  account_id bigint;
  account_type text;
begin
  select sm.id,sm.access_type into account_id,account_type
  from public.staff_members sm
  where sm.user_id=(select auth.uid()) and sm.portal_active and sm.is_active
  limit 1;

  if account_type='staff' then
    if not exists(
      select 1 from public.staff_departments sd
      where sd.staff_id=account_id and sd.department='booking'
    ) then
      raise exception 'Quote creation requires an active Booking department assignment';
    end if;
    if new.is_quote is not true then
      raise exception 'Staff IDs can save quotations only';
    end if;
    if coalesce(new.paid_amount,0)<>0 or coalesce(new.discount,0)<>0 or coalesce(new.tax,0)<>0 then
      raise exception 'Staff IDs cannot edit payment, discount or tax details';
    end if;
  end if;
  return new;
end
$$;

revoke all on function public.staff_can_access(text) from public,anon;
grant execute on function public.staff_can_access(text) to authenticated;

commit;
