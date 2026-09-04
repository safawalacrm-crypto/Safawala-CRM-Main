-- The app (Package Manager page, its save form, and the booking form's
-- package picker) has always expected package_variants to carry an
-- image_url column, but the table never had one. Every query that
-- selected it was failing outright -- meaning package_categories and
-- package_variants weren't loading anywhere, including the Package
-- Manager page itself. This adds the missing column so all three
-- places work as the code already expects, with zero data loss.

alter table public.package_variants
  add column if not exists image_url text;
