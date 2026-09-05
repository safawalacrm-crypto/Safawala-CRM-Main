-- Safawala CRM: add contact detail columns to the staff directory.
-- Additive only — existing rows default to null, no other behavior changes.

alter table public.staff_members
  add column if not exists email text,
  add column if not exists address text;
