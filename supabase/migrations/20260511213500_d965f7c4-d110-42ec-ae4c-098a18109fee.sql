CREATE INDEX IF NOT EXISTS idx_account_members_user_active_created
  ON public.account_members (user_id, is_active, created_at, account_id)
  WHERE is_active = true;

DROP POLICY IF EXISTS "Account members view tasks by visibility" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members insert tasks within visibility" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members update tasks within visibility" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members delete tasks within visibility" ON public.case_tasks;

CREATE POLICY "Account members view tasks by visibility"
ON public.case_tasks
FOR SELECT
TO authenticated
USING (
  account_id = public.user_account_id(auth.uid())
  AND public.user_can_view_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members insert tasks within visibility"
ON public.case_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  account_id = public.user_account_id(auth.uid())
  AND public.user_can_assign_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members update tasks within visibility"
ON public.case_tasks
FOR UPDATE
TO authenticated
USING (
  account_id = public.user_account_id(auth.uid())
  AND public.user_can_view_visibility(auth.uid(), account_id, visibility)
)
WITH CHECK (
  account_id = public.user_account_id(auth.uid())
  AND public.user_can_assign_visibility(auth.uid(), account_id, visibility)
);

CREATE POLICY "Account members delete tasks within visibility"
ON public.case_tasks
FOR DELETE
TO authenticated
USING (
  account_id = public.user_account_id(auth.uid())
  AND public.user_can_view_visibility(auth.uid(), account_id, visibility)
);

ANALYZE public.account_members;
ANALYZE public.case_tasks;