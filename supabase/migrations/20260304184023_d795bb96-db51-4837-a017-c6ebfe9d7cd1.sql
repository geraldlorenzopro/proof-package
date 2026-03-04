
-- 1. Add max_seats column to account_app_access (0 = unlimited)
ALTER TABLE public.account_app_access
ADD COLUMN max_seats integer NOT NULL DEFAULT 0;

-- 2. Create session tracking table
CREATE TABLE public.app_active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  app_id uuid NOT NULL REFERENCES public.hub_apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_active_sessions_account_app ON public.app_active_sessions(account_id, app_id);
CREATE INDEX idx_active_sessions_user ON public.app_active_sessions(user_id, app_id);
CREATE INDEX idx_active_sessions_heartbeat ON public.app_active_sessions(last_heartbeat);

-- Enable RLS
ALTER TABLE public.app_active_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: users can manage their own sessions
CREATE POLICY "Users can view own sessions"
ON public.app_active_sessions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
ON public.app_active_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
ON public.app_active_sessions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
ON public.app_active_sessions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages sessions"
ON public.app_active_sessions FOR ALL
TO service_role
USING (true);
