-- Fisiosilver
-- Politicas de Storage para informes clinicos y fotos de nutricion.
-- Ejecutar en Supabase SQL Editor si los buckets no estan configurados.
-- No usa secret keys y no elimina archivos existentes.

insert into storage.buckets (id, name, public)
values
  ('clinical-reports', 'clinical-reports', true),
  ('nutrition-photos', 'nutrition-photos', true)
on conflict (id) do update
set public = true;

-- Nota TFM:
-- Se mantienen buckets publicos para no romper el uso actual de getPublicUrl()
-- en el frontend. En una version final, se podrian usar buckets privados
-- y URLs firmadas generadas por un backend/API.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'clinical_reports_authenticated_read'
  ) then
    create policy clinical_reports_authenticated_read on storage.objects
      for select to authenticated
      using (bucket_id = 'clinical-reports');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'clinical_reports_authenticated_upload'
  ) then
    create policy clinical_reports_authenticated_upload on storage.objects
      for insert to authenticated
      with check (bucket_id = 'clinical-reports');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'nutrition_photos_authenticated_read'
  ) then
    create policy nutrition_photos_authenticated_read on storage.objects
      for select to authenticated
      using (bucket_id = 'nutrition-photos');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'nutrition_photos_authenticated_upload'
  ) then
    create policy nutrition_photos_authenticated_upload on storage.objects
      for insert to authenticated
      with check (bucket_id = 'nutrition-photos');
  end if;
end $$;
