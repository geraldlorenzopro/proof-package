
-- ═══════════════════════════════════════════════
-- FIX 1: Storage bucket case-documents
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view case documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload case documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete case documents" ON storage.objects;

CREATE POLICY "account_members_select_case_docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.account_members am ON am.account_id = cc.account_id
    WHERE am.user_id = auth.uid()
    AND cc.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "account_members_insert_case_docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.account_members am ON am.account_id = cc.account_id
    WHERE am.user_id = auth.uid()
    AND cc.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "account_members_delete_case_docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-documents'
  AND EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.account_members am ON am.account_id = cc.account_id
    WHERE am.user_id = auth.uid()
    AND cc.id::text = (storage.foldername(name))[1]
  )
);

-- ═══════════════════════════════════════════════
-- FIX 2: Storage bucket evidence-files
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "View evidence with valid case" ON storage.objects;
DROP POLICY IF EXISTS "Upload evidence with valid case" ON storage.objects;
DROP POLICY IF EXISTS "Delete evidence with valid case" ON storage.objects;

CREATE POLICY "account_members_select_evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.evidence_items ei
      JOIN public.client_cases cc ON cc.id = ei.case_id
      JOIN public.account_members am ON am.account_id = cc.account_id
      WHERE am.user_id = auth.uid()
      AND ei.file_path = name
    )
    OR EXISTS (
      SELECT 1 FROM public.client_cases cc
      JOIN public.account_members am ON am.account_id = cc.account_id
      WHERE am.user_id = auth.uid()
      AND cc.id::text = (string_to_array(name, '/'))[1]
    )
  )
);

CREATE POLICY "account_members_insert_evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidence-files'
  AND EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.account_members am ON am.account_id = cc.account_id
    WHERE am.user_id = auth.uid()
    AND cc.id::text = (string_to_array(name, '/'))[1]
  )
);

CREATE POLICY "account_members_delete_evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidence-files'
  AND EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.account_members am ON am.account_id = cc.account_id
    WHERE am.user_id = auth.uid()
    AND cc.id::text = (string_to_array(name, '/'))[1]
  )
);

-- ═══════════════════════════════════════════════
-- FIX 4: email_logs INSERT policy
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "Service can insert email logs" ON public.email_logs;

CREATE POLICY "service_role_insert_email_logs"
ON public.email_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Fix SELECT policy to use authenticated role
DROP POLICY IF EXISTS "Team can view email logs" ON public.email_logs;

CREATE POLICY "account_members_select_email_logs"
ON public.email_logs FOR SELECT
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid()
  )
);

-- ═══════════════════════════════════════════════
-- FIX 5: Sensitive field comments + helper function
-- ═══════════════════════════════════════════════

COMMENT ON COLUMN public.client_cases.uscis_password IS 'SENSITIVE: USCIS account password - consider encrypting';
COMMENT ON COLUMN public.client_cases.nvc_cas_password IS 'SENSITIVE: NVC/CEAC password - consider encrypting';
COMMENT ON COLUMN public.client_profiles.ssn_last4 IS 'SENSITIVE: Last 4 digits of SSN only';
COMMENT ON COLUMN public.client_profiles.passport_number IS 'SENSITIVE: Passport number - consider encrypting';

CREATE OR REPLACE FUNCTION public.can_view_sensitive_fields(p_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.account_members am ON am.account_id = cc.account_id
    WHERE cc.id = p_case_id
    AND am.user_id = auth.uid()
    AND am.role IN ('owner', 'admin', 'attorney')
  )
$$;

-- ═══════════════════════════════════════════════
-- FIX 6: Change public → authenticated on consultations & intake_sessions
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "Team can manage consultations" ON public.consultations;

CREATE POLICY "authenticated_manage_consultations"
ON public.consultations FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Team can manage intake sessions" ON public.intake_sessions;

CREATE POLICY "authenticated_manage_intake_sessions"
ON public.intake_sessions FOR ALL
TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  account_id IN (
    SELECT account_id FROM public.account_members
    WHERE user_id = auth.uid()
  )
);
