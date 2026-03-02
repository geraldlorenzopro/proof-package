
CREATE TABLE public.vawa_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL,
  client_name text NOT NULL,
  client_email text,
  screener_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  screener_result jsonb,
  checklist_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vawa_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage their vawa cases"
  ON public.vawa_cases FOR ALL
  USING (auth.uid() = professional_id);

CREATE TRIGGER update_vawa_cases_updated_at
  BEFORE UPDATE ON public.vawa_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
