
-- FIX: cspa_feedback INSERT — restrict user_id and calculation_id to own data
DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.cspa_feedback;
CREATE POLICY "Authenticated users can insert own feedback"
  ON public.cspa_feedback FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (calculation_id IS NULL OR EXISTS (
      SELECT 1 FROM public.cspa_calculations WHERE id = calculation_id AND professional_id = auth.uid()
    ))
  );
