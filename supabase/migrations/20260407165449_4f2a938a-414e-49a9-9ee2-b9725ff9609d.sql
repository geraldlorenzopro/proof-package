CREATE POLICY "Account members can delete notes"
ON public.case_notes
FOR DELETE
USING (account_id = user_account_id(auth.uid()) AND author_id = auth.uid());