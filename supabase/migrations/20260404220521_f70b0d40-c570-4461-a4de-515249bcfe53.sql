
CREATE TABLE public.intake_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,

  -- Step 1: Entry channel
  entry_channel TEXT CHECK (entry_channel IN (
    'whatsapp','instagram','referral','website','phone','walk-in','other'
  )),
  referral_source TEXT,

  -- Step 2: Client data
  client_profile_id UUID REFERENCES public.client_profiles(id),
  is_existing_client BOOLEAN DEFAULT FALSE,
  client_first_name TEXT,
  client_last_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  client_language TEXT DEFAULT 'es',

  -- Step 3: Immigration situation
  current_status TEXT,
  entry_date DATE,
  entry_method TEXT CHECK (entry_method IN (
    'visa','parole','ewi','cbp-one','asylee','refugee','other','unknown'
  )),
  has_prior_deportation BOOLEAN DEFAULT FALSE,
  has_criminal_record BOOLEAN DEFAULT FALSE,
  current_documents TEXT[] DEFAULT '{}',

  -- Step 4: Client goal
  client_goal TEXT,
  urgency_level TEXT DEFAULT 'normal' CHECK (
    urgency_level IN ('urgent','high','normal','low')
  ),
  has_pending_deadline BOOLEAN DEFAULT FALSE,
  deadline_date DATE,

  -- Step 5: AI detection
  ai_suggested_case_type TEXT,
  ai_confidence_score INTEGER,
  ai_reasoning TEXT,
  ai_flags TEXT[] DEFAULT '{}',

  -- Step 6: Result
  status TEXT DEFAULT 'in_progress' CHECK (
    status IN ('in_progress','completed','converted','abandoned')
  ),
  final_case_type TEXT,
  case_id UUID REFERENCES public.client_cases(id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.intake_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage intake sessions"
ON public.intake_sessions FOR ALL
USING (account_id IN (
  SELECT account_id FROM public.account_members
  WHERE user_id = auth.uid()
));

CREATE TRIGGER update_intake_sessions_updated_at
  BEFORE UPDATE ON public.intake_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
