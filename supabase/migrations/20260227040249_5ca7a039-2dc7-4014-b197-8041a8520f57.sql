
-- Allow owners/admins to view ALL app access records for admin panel
CREATE POLICY "Owners and admins can view all app access"
  ON public.account_app_access
  FOR SELECT
  TO authenticated
  USING (
    has_account_role(auth.uid(), 'owner') 
    OR has_account_role(auth.uid(), 'admin')
  );
