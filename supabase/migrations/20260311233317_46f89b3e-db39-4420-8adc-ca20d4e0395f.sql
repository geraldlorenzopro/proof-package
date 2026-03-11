
-- Audit log table for compliance tracking
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.ner_accounts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  user_display_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_label text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast querying
CREATE INDEX idx_audit_logs_account_created ON public.audit_logs (account_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can view audit logs (compliance requirement)
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  account_id = user_account_id(auth.uid())
  AND (has_account_role(auth.uid(), 'owner') OR has_account_role(auth.uid(), 'admin'))
);

-- Any authenticated user can insert their own audit logs
CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND account_id = user_account_id(auth.uid()));
