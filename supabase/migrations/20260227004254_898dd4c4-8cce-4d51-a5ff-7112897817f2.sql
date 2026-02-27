
-- Multi-tenant tool usage tracking for SaaS analytics & billing
CREATE TABLE public.tool_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tool_slug text NOT NULL,
  action text NOT NULL DEFAULT 'use',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast queries by account, tool, and time range
CREATE INDEX idx_tool_usage_account ON public.tool_usage_logs(account_id);
CREATE INDEX idx_tool_usage_tool ON public.tool_usage_logs(tool_slug);
CREATE INDEX idx_tool_usage_created ON public.tool_usage_logs(created_at DESC);
CREATE INDEX idx_tool_usage_account_tool_date ON public.tool_usage_logs(account_id, tool_slug, created_at DESC);

-- Enable RLS
ALTER TABLE public.tool_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own logs
CREATE POLICY "Users can insert own usage logs"
  ON public.tool_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view logs from their account
CREATE POLICY "Members can view account usage logs"
  ON public.tool_usage_logs FOR SELECT
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- Service role full access (for admin dashboards, billing)
CREATE POLICY "Service role manages usage logs"
  ON public.tool_usage_logs FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role'::text);
