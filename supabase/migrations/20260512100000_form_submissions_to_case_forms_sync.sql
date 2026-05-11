-- ═══════════════════════════════════════════════════════════════════════════
-- Auto-sync form_submissions → case_forms
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problema: cuando un paralegal completa un formulario en form_submissions
-- (status='completed'), no aparece en case_forms (la tabla de tracking USCIS
-- por caso). Esto significa que el receipt_number, filed_date, approved_date
-- NO se trackean automáticamente.
--
-- Solución: trigger AFTER INSERT/UPDATE en form_submissions que upserts
-- la row correspondiente en case_forms.
--
-- Lógica:
--   - Si form_submissions.case_id IS NULL → no hacer nada (form solo)
--   - Si status='draft' → upsert case_forms con status='pending' (placeholder)
--   - Si status='completed' → upsert case_forms con status='ready_to_file'
--   - Si status='sent' → upsert case_forms con status='filed', filed_date=NOW()
--
-- El receipt_number, approved_date, denied_date siguen siendo entry manual
-- desde el CaseFormsPanel (el USCIS notice los entrega por separado).

CREATE OR REPLACE FUNCTION public.sync_form_submission_to_case_form()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_form_status TEXT;
BEGIN
  -- Skip si no está vinculado a un caso
  IF NEW.case_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mapear status: form_submissions → case_forms
  v_case_form_status := CASE
    WHEN NEW.status = 'draft' THEN 'pending'
    WHEN NEW.status = 'completed' THEN 'ready_to_file'
    WHEN NEW.status = 'sent' THEN 'filed'
    ELSE 'pending'
  END;

  -- Upsert en case_forms (UNIQUE constraint en case_id + form_type)
  INSERT INTO public.case_forms (
    case_id, account_id, form_type, status,
    filed_date, created_at, updated_at
  ) VALUES (
    NEW.case_id,
    NEW.account_id,
    NEW.form_type,
    v_case_form_status,
    CASE WHEN NEW.status = 'sent' THEN NOW()::date ELSE NULL END,
    NOW(),
    NOW()
  )
  ON CONFLICT (case_id, form_type) DO UPDATE
  SET
    status = EXCLUDED.status,
    filed_date = COALESCE(case_forms.filed_date, EXCLUDED.filed_date),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_form_submission_to_case_form_trigger ON public.form_submissions;
CREATE TRIGGER sync_form_submission_to_case_form_trigger
  AFTER INSERT OR UPDATE OF status ON public.form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_form_submission_to_case_form();

COMMENT ON FUNCTION public.sync_form_submission_to_case_form() IS
  'Sync automático form_submissions → case_forms. Cuando un paralegal cambia el status del form, case_forms se actualiza para que el pipeline view muestre la realidad. receipt_number, approved_date y denied_date siguen siendo entry manual (post-USCIS notice).';
