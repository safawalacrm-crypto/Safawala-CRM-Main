-- Package Manager variants can carry one catalog image used in rental selection.
alter table public.package_variants
  add column if not exists image_url text;
