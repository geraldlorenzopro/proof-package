
-- FIX: tool_usage_logs INSERT — restrict account_id to user's own account
DROP POLICY IF EXISTS "Users can insert own usage logs" ON public.tool_usage_logs;
CREATE POLICY "Users can insert own usage logs"
  ON public.tool_usage_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (account_id IS NULL OR account_id = public.user_account_id(auth.uid()))
  );

-- FIX: Create a scoped version of has_account_role that checks against a specific account
CREATE OR REPLACE FUNCTION public.has_account_role_in(_user_id uuid, _role account_role, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id AND role = _role AND account_id = _account_id
  )
$$;

-- FIX: audit_logs — use scoped role check
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    account_id = public.user_account_id(auth.uid())
    AND public.has_account_role_in(auth.uid(), 'owner', account_id)
    OR (
      account_id = public.user_account_id(auth.uid())
      AND public.has_account_role_in(auth.uid(), 'admin', account_id)
    )
  );

-- FIX: app_role_access — use scoped role check  
DROP POLICY IF EXISTS "Admins can view app role access" ON public.app_role_access;
CREATE POLICY "Admins can view app role access"
  ON public.app_role_access FOR SELECT TO authenticated
  USING (
    account_id = public.user_account_id(auth.uid())
    AND (public.has_account_role_in(auth.uid(), 'owner', account_id) OR public.has_account_role_in(auth.uid(), 'admin', account_id))
  );

DROP POLICY IF EXISTS "Admins can insert app role access" ON public.app_role_access;
CREATE POLICY "Admins can insert app role access"
  ON public.app_role_access FOR INSERT TO authenticated
  WITH CHECK (
    account_id = public.user_account_id(auth.uid())
    AND (public.has_account_role_in(auth.uid(), 'owner', account_id) OR public.has_account_role_in(auth.uid(), 'admin', account_id))
  );

DROP POLICY IF EXISTS "Admins can delete app role access" ON public.app_role_access;
CREATE POLICY "Admins can delete app role access"
  ON public.app_role_access FOR DELETE TO authenticated
  USING (
    account_id = public.user_account_id(auth.uid())
    AND (public.has_account_role_in(auth.uid(), 'owner', account_id) OR public.has_account_role_in(auth.uid(), 'admin', account_id))
  );

-- FIX: ner_accounts — use scoped role check
DROP POLICY IF EXISTS "Owners and admins can view all accounts" ON public.ner_accounts;
CREATE POLICY "Owners and admins can view own account"
  ON public.ner_accounts FOR SELECT TO authenticated
  USING (
    id = public.user_account_id(auth.uid())
    AND (public.has_account_role_in(auth.uid(), 'owner', id) OR public.has_account_role_in(auth.uid(), 'admin', id))
  );

DROP POLICY IF EXISTS "Owners and admins can update accounts" ON public.ner_accounts;
CREATE POLICY "Owners and admins can update own account"
  ON public.ner_accounts FOR UPDATE TO authenticated
  USING (
    id = public.user_account_id(auth.uid())
    AND (public.has_account_role_in(auth.uid(), 'owner', id) OR public.has_account_role_in(auth.uid(), 'admin', id))
  )
  WITH CHECK (
    id = public.user_account_id(auth.uid())
    AND (public.has_account_role_in(auth.uid(), 'owner', id) OR public.has_account_role_in(auth.uid(), 'admin', id))
  );

-- FIX: account_app_access — use scoped role check
DROP POLICY IF EXISTS "Owners and admins can view own account app access" ON public.account_app_access;
CREATE POLICY "Owners and admins can view own account app access"
  ON public.account_app_access FOR SELECT TO authenticated
  USING (
    account_id = public.user_account_id(auth.uid())
    AND (public.has_account_role_in(auth.uid(), 'owner', account_id) OR public.has_account_role_in(auth.uid(), 'admin', account_id))
  );

-- FIX: cspa_feedback — use scoped check
DROP POLICY IF EXISTS "Admins can view account feedback" ON public.cspa_feedback;
CREATE POLICY "Admins can view account feedback"
  ON public.cspa_feedback FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cspa_calculations cc
      JOIN public.account_members am ON am.user_id = cc.professional_id
      WHERE cc.id = cspa_feedback.calculation_id
        AND am.account_id = public.user_account_id(auth.uid())
        AND (am.role = 'owner' OR am.role = 'admin')
    )
  );
