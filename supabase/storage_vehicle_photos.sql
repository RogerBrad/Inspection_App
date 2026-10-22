-- Inspection App: storage bucket for inspection / vehicle photos.
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Photos are stored at  vehicles/<vin>/<timestamp>_<angle>.jpg  or  refrigeration/<serial>/...
-- and their public URL is saved in public.vehicle_photos.photo_url.

-- 1. Public bucket so photo_url can be shown directly in the app and the SRAM web app
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', true, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- 2. Only signed-in users (technicians) may upload
drop policy if exists "vehicle_photos_authenticated_insert" on storage.objects;
create policy "vehicle_photos_authenticated_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'vehicle-photos');

-- 3. Signed-in users may list / read objects through the API (public URLs work for everyone)
drop policy if exists "vehicle_photos_authenticated_select" on storage.objects;
create policy "vehicle_photos_authenticated_select"
on storage.objects for select
to authenticated
using (bucket_id = 'vehicle-photos');
