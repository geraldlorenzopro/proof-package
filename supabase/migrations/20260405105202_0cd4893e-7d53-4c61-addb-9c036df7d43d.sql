CREATE TABLE public.consultations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES ner_accounts(id) ON DELETE CASCADE,
  case_id UUID REFERENCES client_cases(id) ON DELETE SET NULL,
  client_profile_id UUID REFERENCES client_profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,

  raw_notes TEXT,

  ai_summary TEXT,
  ai_eligibility_assessment TEXT,
  ai_recommended_case_type TEXT,
  ai_flags TEXT[] DEFAULT '{}',
  ai_action_items TEXT[] DEFAULT '{}',
  ai_strengths TEXT[] DEFAULT '{}',
  ai_risks TEXT[] DEFAULT '{}',

  derivatives JSONB DEFAULT '[]',

  decision TEXT CHECK (decision IN (
    'contracted','thinking','no_contract',
    'referred_attorney','no_show','rescheduled'
  )),
  decision_notes TEXT,
  contract_amount DECIMAL(10,2),
  follow_up_date DATE,

  status TEXT DEFAULT 'active' CHECK (
    status IN ('active','completed','abandoned')
  ),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage consultations"
ON public.consultations FOR ALL
USING (account_id IN (
  SELECT account_id FROM account_members
  WHERE user_id = auth.uid()
));

CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();