
-- Add share_token to form_submissions for client access
ALTER TABLE public.form_submissions
ADD COLUMN share_token text UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

-- Create index for fast token lookups
CREATE INDEX idx_form_submissions_share_token ON public.form_submissions(share_token);

-- RPC: Get form submission by share token (read-only, no auth required)
CREATE OR REPLACE FUNCTION public.get_form_by_token(_token text)
RETURNS TABLE(
  id uuid,
  form_type text,
  form_version text,
  form_data jsonb,
  status text,
  client_name text,
  client_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fs.id, fs.form_type, fs.form_version, fs.form_data, fs.status, fs.client_name, fs.client_email
  FROM public.form_submissions fs
  WHERE length(_token) BETWEEN 1 AND 128
    AND fs.share_token = _token
  LIMIT 1;
$$;

-- RPC: Update form data by share token (client saves their answers)
CREATE OR REPLACE FUNCTION public.update_form_by_token(
  _token text,
  _form_data jsonb,
  _client_name text DEFAULT NULL,
  _client_email text DEFAULT NULL,
  _status text DEFAULT 'draft'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(_token) < 1 OR length(_token) > 128 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF _status NOT IN ('draft', 'completed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  
  UPDATE public.form_submissions
  SET form_data = _form_data,
      client_name = COALESCE(_client_name, client_name),
      client_email = COALESCE(_client_email, client_email),
      status = CASE WHEN _status = 'completed' THEN 'completed' ELSE status END,
      updated_at = now()
  WHERE share_token = _token;
END;
$$;
