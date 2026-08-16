-- =====================================================================
-- FACTORYOS AI — BUGFIX PASS (2026-09-01)
--
-- 1. companies UPDATE RLS restored. The 20260830000001 cleanup dropped
--    companies_update and never re-created it, so every write to the
--    company record (Company Settings save, Profile-change approval of
--    companies.name/legal_name/gst_number, currency change) silently
--    affected 0 rows. Restore it scoped to Root + the tenant's own
--    Company Admin — approval authority, not operational override.
-- 2. Storage bucket "avatars" + owner-only write policies for Bug 3
--    (profile photo upload): a user can only upload/overwrite/delete
--    files under their own {auth.uid()}/ folder; public read so the
--    photo renders everywhere avatars are shown.
-- =====================================================================

-- ── 1. companies — UPDATE policy (Root or own-company Company Admin) ──
DROP POLICY IF EXISTS companies_update ON public.companies;
DROP POLICY IF EXISTS companies_update_tenant ON public.companies;
CREATE POLICY companies_update_tenant ON public.companies
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      id = current_company_id()
      AND has_role(auth.uid(), 'company_admin'::app_role)
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      id = current_company_id()
      AND has_role(auth.uid(), 'company_admin'::app_role)
    )
  );

-- ── 2. avatars storage bucket ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- Owner-only writes: file must live under <uid>/…
DROP POLICY IF EXISTS "avatar_owner_write" ON storage.objects;
CREATE POLICY "avatar_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_owner_update" ON storage.objects;
CREATE POLICY "avatar_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_owner_delete" ON storage.objects;
CREATE POLICY "avatar_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read for a public bucket (renders in every avatar slot).
DROP POLICY IF EXISTS "avatar_public_read" ON storage.objects;
CREATE POLICY "avatar_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- Confirm
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'companies'
ORDER BY cmd;
