
-- 1. AI Agents registry
CREATE TABLE public.ai_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  personality TEXT NOT NULL,
  edge_function TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  credit_cost INTEGER NOT NULL DEFAULT 3,
  max_tokens INTEGER DEFAULT 2048,
  category TEXT DEFAULT 'paralegal',
  available_plans TEXT[] DEFAULT '{professional,elite,enterprise}',
  compatible_case_types TEXT[] DEFAULT '{all}',
  color TEXT DEFAULT 'blue',
  is_active BOOLEAN DEFAULT TRUE,
  is_beta BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  auto_trigger BOOLEAN DEFAULT FALSE,
  trigger_on TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read agents"
ON public.ai_agents FOR SELECT
TO authenticated USING (true);

-- 2. AI Agent Sessions
CREATE TABLE public.ai_agent_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id),
  case_id UUID REFERENCES public.client_cases(id),
  agent_slug TEXT NOT NULL,
  triggered_by UUID NOT NULL,
  status TEXT DEFAULT 'running',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  output_text TEXT,
  credits_used INTEGER DEFAULT 0,
  model_used TEXT,
  tokens_used INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can manage sessions"
ON public.ai_agent_sessions FOR ALL
TO authenticated
USING (account_id IN (
  SELECT account_id FROM public.account_members
  WHERE user_id = auth.uid()
));

-- 3. AI Credits per account
CREATE TABLE public.ai_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER DEFAULT 0,
  monthly_allowance INTEGER DEFAULT 0,
  used_this_month INTEGER DEFAULT 0,
  rollover_balance INTEGER DEFAULT 0,
  reset_date DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view credits"
ON public.ai_credits FOR SELECT
TO authenticated
USING (account_id IN (
  SELECT account_id FROM public.account_members
  WHERE user_id = auth.uid()
));

CREATE POLICY "Service can manage credits"
ON public.ai_credits FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- 4. AI Credit Transactions
CREATE TABLE public.ai_credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id),
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  agent_slug TEXT,
  case_id UUID REFERENCES public.client_cases(id),
  session_id UUID REFERENCES public.ai_agent_sessions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view transactions"
ON public.ai_credit_transactions FOR SELECT
TO authenticated
USING (account_id IN (
  SELECT account_id FROM public.account_members
  WHERE user_id = auth.uid()
));

CREATE POLICY "Service can manage transactions"
ON public.ai_credit_transactions FOR ALL
TO service_role
USING (true) WITH CHECK (true);
