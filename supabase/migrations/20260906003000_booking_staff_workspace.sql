-- Allow only active Booking-department staff to use the shared booking and quote workspace.

begin;

create or replace function public.current_booking_owner()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when profile.role = 'admin' then profile.id
    when profile.role = 'staff' and public.current_staff_has_department('booking')
      then public.current_staff_owner()
    else null
  end
  from public.profiles profile
  where profile.id = (select auth.uid())
  limit 1
$$;

revoke all on function public.current_booking_owner() from public, anon;
grant execute on function public.current_booking_owner() to authenticated;

-- Shared read access required by booking lists, details, PDFs and the booking form.
drop policy if exists staff_members_booking_staff_select on public.staff_members;
create policy staff_members_booking_staff_select on public.staff_members for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists products_booking_staff_select on public.products;
create policy products_booking_staff_select on public.products for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists product_variants_booking_staff_select on public.product_variants;
create policy product_variants_booking_staff_select on public.product_variants for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists packages_booking_staff_select on public.packages;
create policy packages_booking_staff_select on public.packages for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists package_items_booking_staff_select on public.package_items;
create policy package_items_booking_staff_select on public.package_items for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists package_categories_booking_staff_select on public.package_categories;
create policy package_categories_booking_staff_select on public.package_categories for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists package_variants_booking_staff_select on public.package_variants;
create policy package_variants_booking_staff_select on public.package_variants for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists booking_payments_booking_staff_select on public.booking_payments;
create policy booking_payments_booking_staff_select on public.booking_payments for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists rental_returns_booking_staff_select on public.rental_returns;
create policy rental_returns_booking_staff_select on public.rental_returns for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists booking_activity_booking_staff_select on public.booking_activity;
create policy booking_activity_booking_staff_select on public.booking_activity for select to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

-- Booking staff may create and maintain booking records for their owner.
drop policy if exists customers_booking_staff_insert on public.customers;
create policy customers_booking_staff_insert on public.customers for insert to authenticated
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));
drop policy if exists customers_booking_staff_update on public.customers;
create policy customers_booking_staff_update on public.customers for update to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'))
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists bookings_booking_staff_insert on public.bookings;
create policy bookings_booking_staff_insert on public.bookings for insert to authenticated
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));
drop policy if exists bookings_booking_staff_update on public.bookings;
create policy bookings_booking_staff_update on public.bookings for update to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'))
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists booking_items_booking_staff_insert on public.booking_items;
create policy booking_items_booking_staff_insert on public.booking_items for insert to authenticated
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));
drop policy if exists booking_items_booking_staff_update on public.booking_items;
create policy booking_items_booking_staff_update on public.booking_items for update to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'))
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));
drop policy if exists booking_items_booking_staff_delete on public.booking_items;
create policy booking_items_booking_staff_delete on public.booking_items for delete to authenticated
  using (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

drop policy if exists booking_payments_booking_staff_insert on public.booking_payments;
create policy booking_payments_booking_staff_insert on public.booking_payments for insert to authenticated
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));
drop policy if exists rental_returns_booking_staff_insert on public.rental_returns;
create policy rental_returns_booking_staff_insert on public.rental_returns for insert to authenticated
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));
drop policy if exists booking_activity_booking_staff_insert on public.booking_activity;
create policy booking_activity_booking_staff_insert on public.booking_activity for insert to authenticated
  with check (owner_id = public.current_booking_owner() and public.current_staff_has_department('booking'));

-- Existing RPCs remain the single business-logic path. Resolve their caller to the
-- owning Admin account when the authenticated user has active Booking access.
do $$
declare
  signature text;
  definition text;
  rewritten text;
begin
  foreach signature in array array[
    'public.create_booking(jsonb)',
    'public.create_booking_quote(jsonb)',
    'public.update_booking_details(bigint,jsonb)',
    'public.change_booking_status(bigint,text)',
    'public.record_booking_payment(bigint,numeric,text,text)',
    'public.process_rental_return(bigint,numeric,numeric,text)'
  ] loop
    definition := pg_catalog.pg_get_functiondef(signature::regprocedure);
    rewritten := replace(definition, '(select auth.uid())', 'public.current_booking_owner()');
    if rewritten = definition then
      raise exception 'Could not apply Booking staff ownership to %', signature;
    end if;
    execute rewritten;
  end loop;
end
$$;

commit;
