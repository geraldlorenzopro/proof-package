
-- Add form_package to pipeline_templates to store the list of forms for each process template
ALTER TABLE public.pipeline_templates ADD COLUMN IF NOT EXISTS form_package jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add description for display
ALTER TABLE public.pipeline_templates ADD COLUMN IF NOT EXISTS description text;

-- Create a master list of USCIS forms for reference
CREATE TABLE public.uscis_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_number text NOT NULL UNIQUE,
  form_name_en text NOT NULL,
  form_name_es text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: all authenticated users can read
ALTER TABLE public.uscis_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view forms"
  ON public.uscis_forms FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role manages forms"
  ON public.uscis_forms FOR ALL TO service_role
  USING (true);
