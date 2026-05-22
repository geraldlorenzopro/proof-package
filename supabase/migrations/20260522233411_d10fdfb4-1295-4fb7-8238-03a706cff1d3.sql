
-- ============================================================
-- Security hardening batch
-- ============================================================

-- ─── Issue #2: USCIS/NVC credentials exposed in client_cases ───
-- Las 5 columnas están vacías (0 rows) y no se referencian en
-- código. Se mueven a public.case_secrets con RLS restrictiva
-- (owner/admin/attorney). Drop directo de las columnas viejas
-- (sin necesidad de backfill).

CREATE TABLE IF NOT EXISTS public.case_secrets (
  case_id uuid PRIMARY KEY REFERENCES public.client_cases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  uscis_email text,
  uscis_password text,
  uscis_recovery_codes text,
  nvc_cas_password text,
  nvc_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_secrets_account_id ON public.case_secrets(account_id);

ALTER TABLE public.case_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_secrets_select_privileged"
  ON public.case_secrets FOR SELECT TO authenticated
  USING (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'attorney'::account_role, account_id)
  );

CREATE POLICY "case_secrets_insert_privileged"
  ON public.case_secrets FOR INSERT TO authenticated
  WITH CHECK (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'attorney'::account_role, account_id)
  );

CREATE POLICY "case_secrets_update_privileged"
  ON public.case_secrets FOR UPDATE TO authenticated
  USING (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'attorney'::account_role, account_id)
  )
  WITH CHECK (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'attorney'::account_role, account_id)
  );

CREATE POLICY "case_secrets_delete_owner_admin"
  ON public.case_secrets FOR DELETE TO authenticated
  USING (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
    OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
  );

CREATE TRIGGER trg_case_secrets_updated_at
  BEFORE UPDATE ON public.case_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_cases
  DROP COLUMN IF EXISTS uscis_email,
  DROP COLUMN IF EXISTS uscis_password,
  DROP COLUMN IF EXISTS uscis_recovery_codes,
  DROP COLUMN IF EXISTS nvc_cas_password,
  DROP COLUMN IF EXISTS nvc_invoice_id;


-- ─── Issue #5: case-outputs bucket sin policies ───
-- Bucket privado existente sin ninguna policy en storage.objects.
-- Se agregan 4 policies scoped a account membership.

CREATE POLICY "account_members_select_case_outputs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-outputs'
    AND EXISTS (
      SELECT 1 FROM public.client_cases cc
      JOIN public.account_members am ON am.account_id = cc.account_id
      WHERE am.user_id = auth.uid()
        AND cc.id::text = (storage.foldername(objects.name))[1]
    )
  );

CREATE POLICY "account_members_insert_case_outputs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-outputs'
    AND EXISTS (
      SELECT 1 FROM public.client_cases cc
      JOIN public.account_members am ON am.account_id = cc.account_id
      WHERE am.user_id = auth.uid()
        AND cc.id::text = (storage.foldername(objects.name))[1]
    )
  );

CREATE POLICY "account_members_update_case_outputs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'case-outputs'
    AND EXISTS (
      SELECT 1 FROM public.client_cases cc
      JOIN public.account_members am ON am.account_id = cc.account_id
      WHERE am.user_id = auth.uid()
        AND cc.id::text = (storage.foldername(objects.name))[1]
    )
  )
  WITH CHECK (
    bucket_id = 'case-outputs'
    AND EXISTS (
      SELECT 1 FROM public.client_cases cc
      JOIN public.account_members am ON am.account_id = cc.account_id
      WHERE am.user_id = auth.uid()
        AND cc.id::text = (storage.foldername(objects.name))[1]
    )
  );

CREATE POLICY "account_members_delete_case_outputs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'case-outputs'
    AND EXISTS (
      SELECT 1 FROM public.client_cases cc
      JOIN public.account_members am ON am.account_id = cc.account_id
      WHERE am.user_id = auth.uid()
        AND cc.id::text = (storage.foldername(objects.name))[1]
    )
  );


-- ─── Issue #9: function search_path mutable ───
-- prevent_duplicate_ghl_task es la única función sin SET search_path.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_ghl_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.ghl_task_id IS NOT NULL AND NEW.status != 'archived' THEN
    IF EXISTS (
      SELECT 1 FROM public.case_tasks
      WHERE ghl_task_id = NEW.ghl_task_id
        AND account_id = NEW.account_id
        AND status != 'archived'
    ) THEN
      RAISE NOTICE 'Duplicate ghl_task_id skipped: % (account: %)', NEW.ghl_task_id, NEW.account_id;
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;


-- ─── Issue #10: materialized views expuestas en Data API ───
-- Revocar SELECT a anon/authenticated; solo service_role lee.
-- Las MVs se acceden vía RPCs SECURITY DEFINER (get_firm_metrics, etc).

REVOKE ALL ON public.case_metrics_daily FROM anon, authenticated;
REVOKE ALL ON public.firm_metrics_daily FROM anon, authenticated;
REVOKE ALL ON public.paralegal_metrics_daily FROM anon, authenticated;


-- ─── Issue #12: event_rate_limits RLS sin policy ───
-- Tabla interna del sistema; solo service_role debe leer/escribir.
-- Policy explícita FOR ALL USING (false) deja claro el intent.

CREATE POLICY "event_rate_limits_deny_all_clients"
  ON public.event_rate_limits FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
