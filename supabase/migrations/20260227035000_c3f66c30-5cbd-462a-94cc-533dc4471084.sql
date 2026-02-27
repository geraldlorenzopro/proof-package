
-- Allow owners/admins to see ALL accounts in admin panel
CREATE POLICY "Owners and admins can view all accounts"
  ON public.ner_accounts
  FOR SELECT
  TO authenticated
  USING (
    has_account_role(auth.uid(), 'owner') 
    OR has_account_role(auth.uid(), 'admin')
  );
