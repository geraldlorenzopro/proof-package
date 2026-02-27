
-- Allow owners/admins to UPDATE accounts (toggle active, change plan, etc.)
CREATE POLICY "Owners and admins can update accounts"
  ON public.ner_accounts
  FOR UPDATE
  TO authenticated
  USING (
    has_account_role(auth.uid(), 'owner') 
    OR has_account_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    has_account_role(auth.uid(), 'owner') 
    OR has_account_role(auth.uid(), 'admin')
  );
