
-- 1) Drop legacy storage policies on evidence-files bucket
DROP POLICY IF EXISTS "Professionals view evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Professionals upload evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Professionals delete evidence files" ON storage.objects;

-- 2) Remove sensitive credential columns from office_config
--    (they are duplicated in office_secrets which has owner/admin-only RLS)
ALTER TABLE public.office_config DROP COLUMN IF EXISTS ghl_api_key;
ALTER TABLE public.office_config DROP COLUMN IF EXISTS webhook_api_key;
