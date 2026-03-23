-- Storage RLS policies for progress-photos bucket
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tzkokgpxqjeyuvyvmqtt/sql/new

-- Drop any existing policies for this bucket (safe to re-run)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND (policyname ILIKE '%progress%' OR policyname ILIKE '%progress-photos%')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON storage.objects';
  END LOOP;
END $$;

-- INSERT: athletes can upload to their own folder
CREATE POLICY "pp insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'progress-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- SELECT: athletes can view their own photos
CREATE POLICY "pp select own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id::text = (storage.foldername(name))[1]
          AND coach_id = auth.uid()
      )
    )
  );

-- UPDATE: needed for upsert:true on upload
CREATE POLICY "pp update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: athletes can delete their own photos
CREATE POLICY "pp delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'progress-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
