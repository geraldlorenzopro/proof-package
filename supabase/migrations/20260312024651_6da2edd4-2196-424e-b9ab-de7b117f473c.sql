
-- FIX 1: ner_accounts — restrict owners/admins to their own account
DROP POLICY IF EXISTS "Owners and admins can view all accounts" ON public.ner_accounts;
CREATE POLICY "Owners and admins can view all accounts"
  ON public.ner_accounts FOR SELECT TO authenticated
  USING (
    id = public.user_account_id(auth.uid())
    AND (public.has_account_role(auth.uid(), 'owner') OR public.has_account_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "Owners and admins can update accounts" ON public.ner_accounts;
CREATE POLICY "Owners and admins can update accounts"
  ON public.ner_accounts FOR UPDATE TO authenticated
  USING (
    id = public.user_account_id(auth.uid())
    AND (public.has_account_role(auth.uid(), 'owner') OR public.has_account_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    id = public.user_account_id(auth.uid())
    AND (public.has_account_role(auth.uid(), 'owner') OR public.has_account_role(auth.uid(), 'admin'))
  );

-- FIX 2: account_app_access — scope admin view to own account
DROP POLICY IF EXISTS "Owners and admins can view all app access" ON public.account_app_access;
CREATE POLICY "Owners and admins can view own account app access"
  ON public.account_app_access FOR SELECT TO authenticated
  USING (
    account_id = public.user_account_id(auth.uid())
    AND (public.has_account_role(auth.uid(), 'owner') OR public.has_account_role(auth.uid(), 'admin'))
  );

-- FIX 3: cspa_feedback — scope admin view via user's account membership
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.cspa_feedback;
CREATE POLICY "Admins can view account feedback"
  ON public.cspa_feedback FOR SELECT TO authenticated
  USING (
    (public.has_account_role(auth.uid(), 'owner') OR public.has_account_role(auth.uid(), 'admin'))
    AND EXISTS (
      SELECT 1 FROM public.cspa_calculations cc
      JOIN public.account_members am ON am.user_id = cc.professional_id
      WHERE cc.id = cspa_feedback.calculation_id
        AND am.account_id = public.user_account_id(auth.uid())
    )
  );
