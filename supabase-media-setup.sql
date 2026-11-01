-- NOVA AI : stockage privé des médias (images, PDF et vidéos)
-- À exécuter une seule fois dans Supabase > SQL Editor avec le rôle postgres.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nova-media',
  'nova-media',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "NOVA users upload own media" on storage.objects;
create policy "NOVA users upload own media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nova-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "NOVA users read own media" on storage.objects;
create policy "NOVA users read own media"
on storage.objects for select to authenticated
using (
  bucket_id = 'nova-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "NOVA users delete own media" on storage.objects;
create policy "NOVA users delete own media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'nova-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
