
-- Smart Forms: form submissions table
CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.ner_accounts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  case_id UUID REFERENCES public.client_cases(id) ON DELETE SET NULL,
  form_type TEXT NOT NULL DEFAULT 'i-765',
  form_version TEXT NOT NULL DEFAULT '08/21/25',
  status TEXT NOT NULL DEFAULT 'draft',
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_name TEXT,
  client_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_form_submissions_account ON public.form_submissions(account_id);
CREATE INDEX idx_form_submissions_user ON public.form_submissions(user_id);
CREATE INDEX idx_form_submissions_type ON public.form_submissions(form_type);

-- Auto-update updated_at
CREATE TRIGGER set_form_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Users can only access submissions from their account
CREATE POLICY "Users can view own account submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (account_id = public.user_account_id(auth.uid()));

CREATE POLICY "Users can insert own account submissions"
  ON public.form_submissions FOR INSERT TO authenticated
  WITH CHECK (account_id = public.user_account_id(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can update own account submissions"
  ON public.form_submissions FOR UPDATE TO authenticated
  USING (account_id = public.user_account_id(auth.uid()));

CREATE POLICY "Users can delete own account submissions"
  ON public.form_submissions FOR DELETE TO authenticated
  USING (account_id = public.user_account_id(auth.uid()));
