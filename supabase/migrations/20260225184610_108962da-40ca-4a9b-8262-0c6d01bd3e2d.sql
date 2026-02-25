-- Tighten evidence_items: require valid case_id on INSERT
DROP POLICY IF EXISTS "Anyone can insert evidence" ON public.evidence_items;
CREATE POLICY "Anyone can insert evidence with valid case"
  ON public.evidence_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.client_cases WHERE id = case_id)
  );

-- Tighten evidence_items: require valid case_id on UPDATE
DROP POLICY IF EXISTS "Anyone can update evidence" ON public.evidence_items;
CREATE POLICY "Anyone can update evidence with valid case"
  ON public.evidence_items FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.client_cases WHERE id = case_id)
  );

-- Tighten cspa_calculations: require non-empty fields on INSERT
DROP POLICY IF EXISTS "Anyone can insert calculations" ON public.cspa_calculations;
CREATE POLICY "Anyone can insert calculations with valid data"
  ON public.cspa_calculations FOR INSERT
  WITH CHECK (
    length(client_name) > 0 AND
    length(client_email) > 3 AND
    length(category) > 0 AND
    length(chargeability) > 0
  );