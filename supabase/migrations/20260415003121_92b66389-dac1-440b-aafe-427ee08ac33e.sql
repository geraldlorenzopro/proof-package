
-- Add ghl_api_key to office_config
ALTER TABLE office_config
ADD COLUMN IF NOT EXISTS ghl_api_key text;

-- Create sync log table
CREATE TABLE IF NOT EXISTS public.ghl_sync_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL UNIQUE REFERENCES ner_accounts(id) ON DELETE CASCADE,
  last_synced_at timestamptz,
  contacts_created integer DEFAULT 0,
  contacts_updated integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ghl_sync_log ENABLE ROW LEVEL SECURITY;

-- Team members can view their own sync log
CREATE POLICY "Account members can view sync log"
ON public.ghl_sync_log
FOR SELECT
TO authenticated
USING (account_id IN (
  SELECT account_id FROM account_members WHERE user_id = auth.uid()
));

-- Service role full access (for cron job)
CREATE POLICY "Service role manages sync log"
ON public.ghl_sync_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
