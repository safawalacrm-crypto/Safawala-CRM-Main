-- Private storage bucket for admin-uploaded stylist travel tickets.
-- Not public (unlike product-images): a ticket can carry a stylist's name,
-- flight/train details, etc., so the app only ever reads or writes this
-- bucket through the service-role admin client and hands the stylist (or
-- admin) a short-lived signed URL -- never a public link. That means no
-- storage.objects RLS policy is required here: the service role bypasses
-- RLS entirely, and there is no direct client-side access to this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stylist-tickets',
  'stylist-tickets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
