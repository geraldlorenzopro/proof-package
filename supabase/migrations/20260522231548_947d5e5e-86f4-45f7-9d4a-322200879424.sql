
-- Create office_secrets table to isolate sensitive API keys from office_config
CREATE TABLE IF NOT EXISTS public.office_secrets (
  account_id uuid PRIMARY KEY,
  ghl_api_key text,
  webhook_api_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_secrets ENABLE ROW LEVEL SECURITY;

-- SELECT: only owner/admin of the account
CREATE POLICY "Owners and admins can view office secrets"
ON public.office_secrets
FOR SELECT
TO authenticated
USING (
  (account_id = user_account_id(auth.uid()))
  AND (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
  )
);

-- INSERT: only owner/admin
CREATE POLICY "Owners and admins can insert office secrets"
ON public.office_secrets
FOR INSERT
TO authenticated
WITH CHECK (
  (account_id = user_account_id(auth.uid()))
  AND (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
  )
);

-- UPDATE: only owner/admin
CREATE POLICY "Owners and admins can update office secrets"
ON public.office_secrets
FOR UPDATE
TO authenticated
USING (
  (account_id = user_account_id(auth.uid()))
  AND (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
  )
)
WITH CHECK (
  (account_id = user_account_id(auth.uid()))
  AND (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
  )
);

-- DELETE: only owner (not admin)
CREATE POLICY "Only owners can delete office secrets"
ON public.office_secrets
FOR DELETE
TO authenticated
USING (
  (account_id = user_account_id(auth.uid()))
  AND has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
);

-- updated_at trigger
CREATE TRIGGER update_office_secrets_updated_at
BEFORE UPDATE ON public.office_secrets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill existing keys from office_config (idempotent)
INSERT INTO public.office_secrets (account_id, ghl_api_key, webhook_api_key)
SELECT account_id, ghl_api_key, webhook_api_key
FROM public.office_config
WHERE ghl_api_key IS NOT NULL OR webhook_api_key IS NOT NULL
ON CONFLICT (account_id) DO UPDATE
SET ghl_api_key = COALESCE(public.office_secrets.ghl_api_key, EXCLUDED.ghl_api_key),
    webhook_api_key = COALESCE(public.office_secrets.webhook_api_key, EXCLUDED.webhook_api_key);
