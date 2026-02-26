
-- SECURITY DEFINER functions for token-based access

CREATE OR REPLACE FUNCTION public.get_case_id_by_token(_token text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.client_cases
  WHERE length(_token) BETWEEN 1 AND 128 AND access_token = _token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_case_by_token(_token text)
RETURNS TABLE (id uuid, client_name text, case_type text, petitioner_name text, beneficiary_name text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.client_name, c.case_type, c.petitioner_name, c.beneficiary_name, c.status
  FROM public.client_cases c
  WHERE length(_token) BETWEEN 1 AND 128 AND c.access_token = _token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_evidence_by_token(_token text)
RETURNS SETOF public.evidence_items
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.* FROM public.evidence_items e
  INNER JOIN public.client_cases c ON c.id = e.case_id
  WHERE length(_token) BETWEEN 1 AND 128 AND c.access_token = _token
  ORDER BY e.upload_order ASC;
$$;

CREATE OR REPLACE FUNCTION public.update_case_status_by_token(_token text, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('pending', 'in_progress', 'completed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF length(_token) < 1 OR length(_token) > 128 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  UPDATE public.client_cases SET status = _status, updated_at = now() WHERE access_token = _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_evidence_by_token(
  _token text, _evidence_id uuid,
  _caption text DEFAULT NULL, _participants text DEFAULT NULL,
  _location text DEFAULT NULL, _platform text DEFAULT NULL,
  _demonstrates text DEFAULT NULL, _notes text DEFAULT NULL,
  _form_complete boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF length(_token) < 1 OR length(_token) > 128 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.evidence_items e
    INNER JOIN public.client_cases c ON c.id = e.case_id
    WHERE e.id = _evidence_id AND c.access_token = _token
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.evidence_items SET
    caption = _caption, participants = _participants, location = _location,
    platform = _platform, demonstrates = _demonstrates, notes = _notes,
    form_complete = _form_complete, updated_at = now()
  WHERE id = _evidence_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_evidence_by_token(_token text, _evidence_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _file_path text;
BEGIN
  IF length(_token) < 1 OR length(_token) > 128 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  SELECT e.file_path INTO _file_path FROM public.evidence_items e
  INNER JOIN public.client_cases c ON c.id = e.case_id
  WHERE e.id = _evidence_id AND c.access_token = _token;
  IF _file_path IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.evidence_items WHERE id = _evidence_id;
  RETURN _file_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_case_id_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_case_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_evidence_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_case_status_by_token(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_evidence_by_token(text, uuid, text, text, text, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_evidence_by_token(text, uuid) TO anon, authenticated;

-- Remove permissive RLS policies
DROP POLICY IF EXISTS "Anyone with token can view case" ON public.client_cases;
DROP POLICY IF EXISTS "Anyone can view evidence" ON public.evidence_items;
DROP POLICY IF EXISTS "Anyone can insert evidence with valid case" ON public.evidence_items;
DROP POLICY IF EXISTS "Anyone can update evidence with valid case" ON public.evidence_items;

-- Storage policies for evidence-files
DROP POLICY IF EXISTS "Professionals upload evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Professionals view evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Professionals delete evidence files" ON storage.objects;

CREATE POLICY "Professionals upload evidence files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence-files' AND EXISTS (
    SELECT 1 FROM public.client_cases
    WHERE professional_id = auth.uid() AND id::text = (string_to_array(name, '/'))[1]
  )
);

CREATE POLICY "Professionals view evidence files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'evidence-files' AND EXISTS (
    SELECT 1 FROM public.client_cases
    WHERE professional_id = auth.uid() AND id::text = (string_to_array(name, '/'))[1]
  )
);

CREATE POLICY "Professionals delete evidence files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'evidence-files' AND EXISTS (
    SELECT 1 FROM public.client_cases
    WHERE professional_id = auth.uid() AND id::text = (string_to_array(name, '/'))[1]
  )
);
