CREATE TABLE public.backup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('incremental', 'full', 'on_demand')),
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'single_account')),
  account_id UUID NULL REFERENCES public.ner_accounts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'partial')),
  s3_key TEXT NULL,
  s3_bucket TEXT NULL,
  size_bytes BIGINT NULL,
  rows_exported INTEGER NULL,
  tables_included TEXT[] NULL,
  duration_ms INTEGER NULL,
  error_message TEXT NULL,
  triggered_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source TEXT NOT NULL DEFAULT 'cron' CHECK (trigger_source IN ('cron', 'manual', 'github_action')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_backup_logs_created_at ON public.backup_logs(created_at DESC);
CREATE INDEX idx_backup_logs_status ON public.backup_logs(status);
CREATE INDEX idx_backup_logs_account_id ON public.backup_logs(account_id) WHERE account_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all backup logs"
ON public.backup_logs FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "Platform admins can insert backup logs"
ON public.backup_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins can update backup logs"
ON public.backup_logs FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());