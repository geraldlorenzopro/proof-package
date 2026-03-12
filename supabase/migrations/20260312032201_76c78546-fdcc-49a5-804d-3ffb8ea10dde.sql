
-- Table to track USCIS deadlines per case
CREATE TABLE public.case_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.client_cases(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  case_type text NOT NULL DEFAULT '',
  deadline_type text NOT NULL,
  deadline_date date NOT NULL,
  receipt_number text,
  source_analysis_id uuid REFERENCES public.analysis_history(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.case_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view deadlines"
  ON public.case_deadlines FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert deadlines"
  ON public.case_deadlines FOR INSERT TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Account members can update deadlines"
  ON public.case_deadlines FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can delete deadlines"
  ON public.case_deadlines FOR DELETE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_case_deadlines_account_status ON public.case_deadlines(account_id, status);
CREATE INDEX idx_case_deadlines_date ON public.case_deadlines(deadline_date);
