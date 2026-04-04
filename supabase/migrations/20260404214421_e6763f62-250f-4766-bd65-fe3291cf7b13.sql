
-- TABLA 1: office_config
CREATE TABLE public.office_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  firm_name TEXT,
  firm_logo_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  preferred_language TEXT DEFAULT 'es',
  attorney_name TEXT,
  bar_number TEXT,
  bar_state TEXT,
  firm_address TEXT,
  firm_phone TEXT,
  firm_email TEXT,
  firm_fax TEXT,
  attorney_signature_url TEXT,
  preferred_channel TEXT DEFAULT 'whatsapp',
  ghl_location_id TEXT,
  ghl_last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

ALTER TABLE public.office_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view office config"
ON public.office_config FOR SELECT
USING (account_id IN (
  SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
));

CREATE POLICY "Owners and admins can manage office config"
ON public.office_config FOR ALL
USING (account_id IN (
  SELECT account_id FROM public.account_members
  WHERE user_id = auth.uid() AND role IN ('owner','admin')
));

CREATE TRIGGER update_office_config_updated_at
  BEFORE UPDATE ON public.office_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TABLA 2: consultation_types
CREATE TABLE public.consultation_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  price DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consultation_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view consultation types"
ON public.consultation_types FOR SELECT
USING (account_id IN (
  SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
));

CREATE POLICY "Owners and admins can manage consultation types"
ON public.consultation_types FOR ALL
USING (account_id IN (
  SELECT account_id FROM public.account_members
  WHERE user_id = auth.uid() AND role IN ('owner','admin')
));

-- TABLA 3: active_case_types
CREATE TABLE public.active_case_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  case_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  main_form TEXT,
  icon TEXT DEFAULT '📋',
  is_active BOOLEAN DEFAULT TRUE,
  is_custom BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, case_type)
);

ALTER TABLE public.active_case_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view active case types"
ON public.active_case_types FOR SELECT
USING (account_id IN (
  SELECT account_id FROM public.account_members WHERE user_id = auth.uid()
));

CREATE POLICY "Owners and admins can manage case types"
ON public.active_case_types FOR ALL
USING (account_id IN (
  SELECT account_id FROM public.account_members
  WHERE user_id = auth.uid() AND role IN ('owner','admin')
));
