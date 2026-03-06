
CREATE TABLE public.cspa_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid REFERENCES public.cspa_calculations(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cspa_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert feedback
CREATE POLICY "Authenticated users can insert feedback"
  ON public.cspa_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.cspa_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON public.cspa_feedback FOR SELECT TO authenticated
  USING (has_account_role(auth.uid(), 'owner'::account_role) OR has_account_role(auth.uid(), 'admin'::account_role));
