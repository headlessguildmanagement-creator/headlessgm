insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guild-assets','guild-assets',true,2097152,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public=true, file_size_limit=2097152, allowed_mime_types=array['image/png','image/jpeg','image/webp','image/gif'];

drop policy if exists "guild owners upload guild assets" on storage.objects;
create policy "guild owners upload guild assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'guild-assets' and private.is_guild_owner(((storage.foldername(name))[1])::uuid));

drop policy if exists "guild owners update guild assets" on storage.objects;
create policy "guild owners update guild assets"
on storage.objects for update to authenticated
using (bucket_id = 'guild-assets' and private.is_guild_owner(((storage.foldername(name))[1])::uuid))
with check (bucket_id = 'guild-assets' and private.is_guild_owner(((storage.foldername(name))[1])::uuid));

drop policy if exists "guild owners delete guild assets" on storage.objects;
create policy "guild owners delete guild assets"
on storage.objects for delete to authenticated
using (bucket_id = 'guild-assets' and private.is_guild_owner(((storage.foldername(name))[1])::uuid));
