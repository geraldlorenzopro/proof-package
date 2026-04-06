CREATE TABLE public.email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES ner_accounts(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  template_type TEXT NOT NULL CHECK (
    template_type IN (
      'welcome', 'questionnaire', 'document_checklist',
      'document_received', 'payment_confirmed', 'case_update',
      'appointment_reminder', 'case_approved', 'firm_welcome'
    )
  ),
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','failed','pending')),
  ghl_message_id TEXT,
  case_id UUID REFERENCES client_cases(id),
  file_number TEXT,
  metadata JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view email logs"
ON public.email_logs FOR SELECT
USING (account_id IN (
  SELECT account_id FROM account_members
  WHERE user_id = auth.uid()
));

CREATE POLICY "Service can insert email logs"
ON public.email_logs FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_email_logs_account ON public.email_logs(account_id);
CREATE INDEX idx_email_logs_case ON public.email_logs(case_id);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at DESC);