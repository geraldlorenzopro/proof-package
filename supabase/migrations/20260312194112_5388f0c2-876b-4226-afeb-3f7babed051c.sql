
-- case_forms: tracks which USCIS forms are part of a case
CREATE TABLE public.case_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id),
  form_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  receipt_number text,
  filed_date date,
  receipt_date date,
  approved_date date,
  denied_date date,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, form_type)
);

ALTER TABLE public.case_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view case forms" ON public.case_forms
  FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert case forms" ON public.case_forms
  FOR INSERT TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can update case forms" ON public.case_forms
  FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can delete case forms" ON public.case_forms
  FOR DELETE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- form_field_registry: master catalog of all immigration questionnaire fields
CREATE TABLE public.form_field_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL UNIQUE,
  label_en text NOT NULL,
  label_es text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  field_group text NOT NULL DEFAULT 'general',
  field_subgroup text,
  options jsonb DEFAULT '[]'::jsonb,
  help_text_en text,
  help_text_es text,
  validation_rules jsonb DEFAULT '{}'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_field_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view field registry" ON public.form_field_registry
  FOR SELECT TO authenticated USING (true);

-- form_field_mappings: which fields each form type requires
CREATE TABLE public.form_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type text NOT NULL,
  field_key text NOT NULL REFERENCES public.form_field_registry(field_key) ON DELETE CASCADE,
  pdf_field_name text,
  part_label text,
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_type, field_key)
);

ALTER TABLE public.form_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view field mappings" ON public.form_field_mappings
  FOR SELECT TO authenticated USING (true);

-- case_questionnaire_answers: stores unified questionnaire responses per case
CREATE TABLE public.case_questionnaire_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id),
  field_key text NOT NULL REFERENCES public.form_field_registry(field_key),
  value text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, field_key)
);

ALTER TABLE public.case_questionnaire_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view answers" ON public.case_questionnaire_answers
  FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert answers" ON public.case_questionnaire_answers
  FOR INSERT TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can update answers" ON public.case_questionnaire_answers
  FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can delete answers" ON public.case_questionnaire_answers
  FOR DELETE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- Add updated_at triggers
CREATE TRIGGER update_case_forms_updated_at BEFORE UPDATE ON public.case_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_questionnaire_answers_updated_at BEFORE UPDATE ON public.case_questionnaire_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
