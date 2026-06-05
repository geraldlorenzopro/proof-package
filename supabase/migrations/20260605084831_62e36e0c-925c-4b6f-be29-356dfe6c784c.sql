BEGIN;

CREATE OR REPLACE FUNCTION public.tg_audit_pipeline_mutations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_account uuid;
  v_user_name text;
BEGIN
  v_account := COALESCE(NEW.account_id, OLD.account_id);
  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user LIMIT 1;
  INSERT INTO public.audit_logs(account_id, user_id, user_display_name, action, entity_type, entity_id, metadata)
  VALUES (
    v_account, v_user, COALESCE(v_user_name, 'System'),
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP), TG_TABLE_NAME, COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object(
      'op', TG_OP, 'table', TG_TABLE_NAME,
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_client_cases ON public.client_cases;
CREATE TRIGGER trg_audit_client_cases AFTER INSERT OR UPDATE OR DELETE ON public.client_cases
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pipeline_mutations();
DROP TRIGGER IF EXISTS trg_audit_case_tasks ON public.case_tasks;
CREATE TRIGGER trg_audit_case_tasks AFTER INSERT OR UPDATE OR DELETE ON public.case_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pipeline_mutations();
DROP TRIGGER IF EXISTS trg_audit_case_notes ON public.case_notes;
CREATE TRIGGER trg_audit_case_notes AFTER INSERT OR UPDATE OR DELETE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pipeline_mutations();

CREATE OR REPLACE FUNCTION public.tg_audit_logs_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only (SOC II Type II requirement)';
END $$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_logs_immutable();

REVOKE SELECT(matter_value) ON public.client_cases FROM authenticated;

CREATE OR REPLACE FUNCTION public.user_can_see_matter_value(p_account uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT get_user_role_in_account(auth.uid(), p_account) IN ('owner', 'admin', 'attorney')
$$;

CREATE OR REPLACE VIEW public.client_cases_revenue AS
  SELECT id, account_id,
    CASE WHEN public.user_can_see_matter_value(account_id) THEN matter_value ELSE NULL END AS matter_value
  FROM public.client_cases;
GRANT SELECT ON public.client_cases_revenue TO authenticated;

REVOKE SELECT(a_number, phone, mobile_phone, dob, ssn_last4)
  ON public.client_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.user_can_see_pii(p_account uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT get_user_role_in_account(auth.uid(), p_account)
    IN ('owner', 'admin', 'attorney', 'paralegal', 'member')
$$;

CREATE OR REPLACE VIEW public.client_profiles_safe AS
  SELECT id, account_id, first_name, last_name, email,
    CASE WHEN public.user_can_see_pii(account_id) THEN a_number     ELSE NULL END AS a_number,
    CASE WHEN public.user_can_see_pii(account_id) THEN phone        ELSE NULL END AS phone,
    CASE WHEN public.user_can_see_pii(account_id) THEN mobile_phone ELSE NULL END AS mobile_phone,
    CASE WHEN public.user_can_see_pii(account_id) THEN dob          ELSE NULL END AS dob,
    CASE WHEN public.user_can_see_pii(account_id) THEN ssn_last4    ELSE NULL END AS ssn_last4
  FROM public.client_profiles;
GRANT SELECT ON public.client_profiles_safe TO authenticated;

ALTER TABLE public.client_cases ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.case_tasks   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.case_notes   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_client_cases_alive ON public.client_cases(account_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_case_tasks_alive ON public.case_tasks(account_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_case_notes_alive ON public.case_notes(account_id, created_at DESC) WHERE deleted_at IS NULL;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.case_tasks VALIDATE CONSTRAINT case_tasks_one_level_only;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'validate skipped: %', SQLERRM;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_action_time ON public.audit_logs(entity_type, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account_user_time ON public.audit_logs(account_id, user_id, created_at DESC);

ALTER TABLE public.account_members DROP CONSTRAINT IF EXISTS custom_permissions_no_escalation;
ALTER TABLE public.account_members ADD CONSTRAINT custom_permissions_no_escalation CHECK (
  NOT (
    role IN ('paralegal', 'assistant', 'readonly')
    AND (
      (custom_permissions->>'eliminar_casos')::boolean IS TRUE
      OR (custom_permissions->>'eliminar_clientes')::boolean IS TRUE
      OR (custom_permissions->>'ver_revenue')::boolean IS TRUE
      OR (custom_permissions->>'configurar_firma')::boolean IS TRUE
    )
  )
);

COMMIT;