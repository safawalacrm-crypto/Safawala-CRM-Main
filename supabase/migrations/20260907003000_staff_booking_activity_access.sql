-- Allow active Staff Portal accounts to read and append activity only for the
-- booking or quotation records they are already authorized to access.
begin;

drop policy if exists booking_activity_booking_staff_select on public.booking_activity;
create policy booking_activity_booking_staff_select
on public.booking_activity
for select
to authenticated
using (
  owner_id = public.current_staff_owner()
  and exists (
    select 1
    from public.bookings b
    join public.staff_members sm on sm.id = public.current_staff_member_id()
    where b.id = booking_activity.booking_id
      and b.owner_id = booking_activity.owner_id
      and (
        (
          sm.access_type = 'staff'
          and b.is_quote
          and b.created_by_staff_id = sm.id
          and public.staff_can_access('quotations')
        )
        or (
          sm.access_type = 'main'
          and (
            (b.is_quote and public.staff_can_access('quotations'))
            or (not b.is_quote and public.staff_can_access('bookings'))
          )
        )
      )
  )
);

drop policy if exists booking_activity_booking_staff_insert on public.booking_activity;
create policy booking_activity_booking_staff_insert
on public.booking_activity
for insert
to authenticated
with check (
  owner_id = public.current_staff_owner()
  and exists (
    select 1
    from public.bookings b
    join public.staff_members sm on sm.id = public.current_staff_member_id()
    where b.id = booking_activity.booking_id
      and b.owner_id = booking_activity.owner_id
      and (
        (
          sm.access_type = 'staff'
          and b.is_quote
          and b.created_by_staff_id = sm.id
          and public.staff_can_access('quotations')
        )
        or (
          sm.access_type = 'main'
          and (
            (b.is_quote and public.staff_can_access('quotations'))
            or (not b.is_quote and public.staff_can_access('bookings'))
          )
        )
      )
  )
);

grant select, insert on public.booking_activity to authenticated;

commit;
