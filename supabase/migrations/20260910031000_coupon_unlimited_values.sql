-- Allow any positive value for both fixed and percentage offers.
-- The booking calculator caps the applied discount at the subtotal.
alter table if exists public.coupon_offers
  drop constraint if exists coupon_offers_value_check;
alter table if exists public.coupon_offers
  add constraint coupon_offers_value_check check (value > 0);
