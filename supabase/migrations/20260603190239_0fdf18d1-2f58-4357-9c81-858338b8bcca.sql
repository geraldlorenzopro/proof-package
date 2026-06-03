CREATE POLICY "Account members can view teammate profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members caller
      JOIN public.account_members target
        ON caller.account_id = target.account_id
      WHERE caller.user_id = auth.uid()
        AND target.user_id = profiles.user_id
        AND caller.is_active = true
        AND target.is_active = true
    )
  );