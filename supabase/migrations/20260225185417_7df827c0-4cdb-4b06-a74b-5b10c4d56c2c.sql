-- 1. Make evidence-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'evidence-files';

-- 2. Drop existing permissive storage policies if any
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete evidence files" ON storage.objects;

-- 3. Upload: only allow if path starts with a valid case_id
CREATE POLICY "Upload evidence with valid case"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'evidence-files'
    AND EXISTS (
      SELECT 1 FROM public.client_cases
      WHERE id::text = (string_to_array(name, '/'))[1]
    )
  );

-- 4. Select/download: only if path matches a valid case
CREATE POLICY "View evidence with valid case"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'evidence-files'
    AND EXISTS (
      SELECT 1 FROM public.client_cases
      WHERE id::text = (string_to_array(name, '/'))[1]
    )
  );

-- 5. Delete: same restriction
CREATE POLICY "Delete evidence with valid case"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'evidence-files'
    AND EXISTS (
      SELECT 1 FROM public.client_cases
      WHERE id::text = (string_to_array(name, '/'))[1]
    )
  );
