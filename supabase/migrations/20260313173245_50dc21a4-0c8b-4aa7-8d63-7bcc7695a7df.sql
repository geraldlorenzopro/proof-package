
-- Table for visa evaluation results
CREATE TABLE public.visa_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  professional_id uuid,
  client_profile_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_email text,
  access_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  avatar_code text,
  avatar_group text,
  avatar_label text,
  score integer,
  risk_level text DEFAULT 'pending',
  score_breakdown jsonb DEFAULT '{}'::jsonb,
  audio_recordings jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.visa_evaluations ENABLE ROW LEVEL SECURITY;

-- Account members can manage evaluations
CREATE POLICY "Account members can view evaluations"
  ON public.visa_evaluations FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert evaluations"
  ON public.visa_evaluations FOR INSERT TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can update evaluations"
  ON public.visa_evaluations FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can delete evaluations"
  ON public.visa_evaluations FOR DELETE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- Public access function for client self-evaluation
CREATE OR REPLACE FUNCTION public.get_visa_eval_by_token(_token text)
RETURNS TABLE(id uuid, client_name text, answers jsonb, avatar_code text, avatar_label text, score integer, risk_level text, score_breakdown jsonb, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT ve.id, ve.client_name, ve.answers, ve.avatar_code, ve.avatar_label,
         ve.score, ve.risk_level, ve.score_breakdown, ve.status
  FROM public.visa_evaluations ve
  WHERE length(_token) BETWEEN 1 AND 128 AND ve.access_token = _token
  LIMIT 1;
$$;

-- Public update function for client self-evaluation
CREATE OR REPLACE FUNCTION public.update_visa_eval_by_token(
  _token text, _answers jsonb, _client_name text DEFAULT NULL, _client_email text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF length(_token) < 1 OR length(_token) > 128 THEN RAISE EXCEPTION 'Invalid token'; END IF;
  UPDATE public.visa_evaluations
  SET answers = _answers,
      client_name = COALESCE(_client_name, client_name),
      client_email = COALESCE(_client_email, client_email),
      updated_at = now()
  WHERE access_token = _token;
END;
$$;

-- Index for token lookups
CREATE INDEX idx_visa_evaluations_token ON public.visa_evaluations(access_token);
CREATE INDEX idx_visa_evaluations_account ON public.visa_evaluations(account_id);
