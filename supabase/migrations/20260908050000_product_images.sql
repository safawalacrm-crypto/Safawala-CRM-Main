insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
drop policy if exists product_images_upload on storage.objects;
create policy product_images_upload on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and owner_id = (select auth.uid()));
drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects for select to public using (bucket_id = 'product-images');
