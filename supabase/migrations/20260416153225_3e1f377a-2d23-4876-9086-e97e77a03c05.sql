
-- Table to store GHL team members and map them to NER account_members
CREATE TABLE public.ghl_user_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  ghl_user_id text NOT NULL,
  ghl_user_name text,
  ghl_user_email text,
  ghl_user_role text,
  ghl_user_phone text,
  mapped_user_id uuid, -- FK to account_members.user_id (nullable until mapped)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, ghl_user_id)
);

ALTER TABLE public.ghl_user_mappings ENABLE ROW LEVEL SECURITY;

-- Team members can view GHL user mappings for their account
CREATE POLICY "Account members can view ghl user mappings"
  ON public.ghl_user_mappings FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- Owners and admins can manage GHL user mappings
CREATE POLICY "Admins can manage ghl user mappings"
  ON public.ghl_user_mappings FOR ALL TO authenticated
  USING (
    account_id = user_account_id(auth.uid())
    AND (
      has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
      OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    )
  )
  WITH CHECK (
    account_id = user_account_id(auth.uid())
    AND (
      has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
      OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    )
  );

-- Service role full access
CREATE POLICY "Service role manages ghl user mappings"
  ON public.ghl_user_mappings FOR ALL TO public
  USING (auth.role() = 'service_role'::text);
