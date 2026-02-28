
-- Analysis history table
CREATE TABLE public.analysis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  language text NOT NULL DEFAULT 'Español',
  result_markdown text NOT NULL,
  file_names text[] NOT NULL DEFAULT '{}',
  checklist jsonb DEFAULT '[]'::jsonb,
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  urgency_level text DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own analyses"
  ON public.analysis_history FOR ALL
  USING (auth.uid() = user_id);

-- RPC for public share access (no auth required)
CREATE OR REPLACE FUNCTION public.get_shared_analysis(_share_token text)
RETURNS TABLE (
  id uuid,
  document_type text,
  language text,
  result_markdown text,
  file_names text[],
  checklist jsonb,
  urgency_level text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.document_type, a.language, a.result_markdown, a.file_names,
         a.checklist, a.urgency_level, a.created_at
  FROM public.analysis_history a
  WHERE length(_share_token) BETWEEN 1 AND 64
    AND a.share_token = _share_token
  LIMIT 1;
$$;
