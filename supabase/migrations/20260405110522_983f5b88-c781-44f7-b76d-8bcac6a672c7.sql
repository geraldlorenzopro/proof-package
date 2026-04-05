
CREATE INDEX IF NOT EXISTS idx_client_cases_account ON public.client_cases (account_id);
CREATE INDEX IF NOT EXISTS idx_client_profiles_account ON public.client_profiles (account_id);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_case ON public.intake_sessions (case_id);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_account ON public.intake_sessions (account_id);
CREATE INDEX IF NOT EXISTS idx_consultations_case ON public.consultations (case_id);
CREATE INDEX IF NOT EXISTS idx_consultations_account ON public.consultations (account_id);
CREATE INDEX IF NOT EXISTS idx_account_members_user ON public.account_members (user_id);
