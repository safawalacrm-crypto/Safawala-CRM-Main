-- Allow authenticated booking staff to create products from the booking flow.
-- Staff rows use the business owner's id, so the original owner-only policy
-- does not match their inserts even though they can read the catalog.
drop policy if exists products_booking_staff_insert on public.products;
create policy products_booking_staff_insert on public.products
  for insert to authenticated
  with check (
    owner_id = public.current_staff_owner()
    and public.staff_can_access_any(array['inventory','quotations','bookings','create_booking'])
  );

drop policy if exists products_booking_staff_update on public.products;
create policy products_booking_staff_update on public.products
  for update to authenticated
  using (
    owner_id = public.current_staff_owner()
    and public.staff_can_access_any(array['inventory','quotations','bookings','create_booking'])
  )
  with check (
    owner_id = public.current_staff_owner()
    and public.staff_can_access_any(array['inventory','quotations','bookings','create_booking'])
  );
