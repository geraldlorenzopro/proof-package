
-- 1. Add account_id and assigned_to to client_cases
ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.ner_accounts(id),
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- 2. Add account_id and assigned_to to vawa_cases
ALTER TABLE public.vawa_cases
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.ner_accounts(id),
  ADD COLUMN IF NOT EXISTS assigned_to uuid;

-- 3. Backfill account_id from professional_id for existing data
UPDATE public.client_cases
SET account_id = user_account_id(professional_id)
WHERE account_id IS NULL;

UPDATE public.vawa_cases
SET account_id = user_account_id(professional_id)
WHERE account_id IS NULL;

-- 4. Backfill assigned_to = professional_id for existing data
UPDATE public.client_cases SET assigned_to = professional_id WHERE assigned_to IS NULL;
UPDATE public.vawa_cases SET assigned_to = professional_id WHERE assigned_to IS NULL;

-- 5. Drop old RLS on client_cases and replace with account-level
DROP POLICY IF EXISTS "Professionals can manage their cases" ON public.client_cases;

CREATE POLICY "Account members can view cases"
  ON public.client_cases FOR SELECT
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert cases"
  ON public.client_cases FOR INSERT
  TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can update cases"
  ON public.client_cases FOR UPDATE
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can delete cases"
  ON public.client_cases FOR DELETE
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- 6. Drop old RLS on vawa_cases and replace with account-level
DROP POLICY IF EXISTS "Professionals can manage their vawa cases" ON public.vawa_cases;

CREATE POLICY "Account members can view vawa cases"
  ON public.vawa_cases FOR SELECT
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert vawa cases"
  ON public.vawa_cases FOR INSERT
  TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can update vawa cases"
  ON public.vawa_cases FOR UPDATE
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can delete vawa cases"
  ON public.vawa_cases FOR DELETE
  TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- 7. Update evidence_items RLS to also work via account
DROP POLICY IF EXISTS "Professionals can manage evidence for their cases" ON public.evidence_items;

CREATE POLICY "Account members can manage evidence"
  ON public.evidence_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_cases
      WHERE client_cases.id = evidence_items.case_id
        AND client_cases.account_id = user_account_id(auth.uid())
    )
  );
