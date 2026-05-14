-- Universal event log (5° plano fundacional MEASUREMENT-FRAMEWORK.md)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.client_cases(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_session_id TEXT,
  ip_country TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_account_time
  ON public.events(account_id, occurred_at DESC)
  WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_name ON public.events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_case ON public.events(case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_user_time ON public.events(user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_session ON public.events(client_session_id) WHERE client_session_id IS NOT NULL;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_own_account"
  ON public.events FOR SELECT
  USING (
    account_id IS NOT NULL
    AND account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "events_insert_own_account"
  ON public.events FOR INSERT
  WITH CHECK (
    (account_id IS NOT NULL AND account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    ))
    OR (account_id IS NULL AND user_id IS NULL)
  );

CREATE OR REPLACE FUNCTION public.events_retention_cleanup()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  DELETE FROM public.events WHERE occurred_at < NOW() - INTERVAL '24 months';
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.events_retention_cleanup() IS
  'Borra events > 24 meses. Run via pg_cron monthly o manual desde admin.';