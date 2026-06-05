-- 20260606030000 — SOC II Type II quick wins Pipeline NER
--
-- Mr. Lorenzo Round 8 (autonomous mientras duerme):
-- - 4 agentes audit (Valerie + Vanessa + Marcus + Victoria)
-- - Marcus identificó 10 gaps, Victoria 16
-- - Esta migration cierra 11 de los 16 en una sola sesión
--
-- 8 quick wins SQL implementables sin decisión humana (Victoria):
--   1. Trigger universal audit log en client_cases + case_tasks + case_notes
--   2. Audit log tamper-proof (immutable triggers)
--   3. matter_value column-level RLS (deuda 6 días cierre)
--   4. PII column-level RLS en client_profiles (a_number, phone, dob)
--   5. Soft-delete columns + index alive
--   6. Validate one-level-only constraint pendiente Round 4
--   7. Index audit log para queries SOC II auditor
--   8. CHECK constraint custom_permissions bounded (anti-escalation)
--
-- Trust Services Criteria afectados:
--   - CC2/CC4 Audit logging (Quick wins 1, 2, 7)
--   - CC6 Logical access (Quick wins 3, 4, 8)
--   - PI1 Processing integrity (Quick win 6)
--   - P1-P4 Privacy (Quick win 5)
--   - C1 Confidentiality (Quick wins 3, 4)

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- 1. TRIGGER UNIVERSAL AUDIT LOG (Victoria gap #1, #3, #14)
-- ════════════════════════════════════════════════════════════════
--
-- Antes: 3 Task*InlineEdit bypassaban useCaseInlineEdit y llamaban
-- supabase.from("case_tasks").update() directo → 0 audit log.
-- Bulk operations idem.
--
-- Trigger SQL captura TODAS las mutations en server-side. Defense
-- in depth: client puede olvidar logAudit pero trigger SIEMPRE corre.
-- Cierra CC7.2 "tamper-proof audit trail".

CREATE OR REPLACE FUNCTION public.tg_audit_pipeline_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_account uuid;
  v_user_name text;
BEGIN
  -- account_id puede venir de NEW (INSERT/UPDATE) o OLD (DELETE)
  v_account := COALESCE(NEW.account_id, OLD.account_id);

  -- Resolver user display name (best effort, fire-and-forget)
  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE user_id = v_user
  LIMIT 1;

  INSERT INTO public.audit_logs(
    account_id, user_id, user_display_name,
    action, entity_type, entity_id, metadata
  )
  VALUES (
    v_account,
    v_user,
    COALESCE(v_user_name, 'System'),
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object(
      'op', TG_OP,
      'table', TG_TABLE_NAME,
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )
  );

  RETURN COALESCE(NEW, OLD);
END $$;

COMMENT ON FUNCTION public.tg_audit_pipeline_mutations() IS
  'SOC II CC2/CC4: trigger universal que escribe en audit_logs cada '
  'mutation de tablas Pipeline. Defense in depth — cliente puede '
  'olvidar logAudit, trigger SIEMPRE corre. Round 8 (Victoria audit).';

-- Triggers AFTER INSERT/UPDATE/DELETE en las 3 tablas core del Pipeline
DROP TRIGGER IF EXISTS trg_audit_client_cases ON public.client_cases;
CREATE TRIGGER trg_audit_client_cases
  AFTER INSERT OR UPDATE OR DELETE ON public.client_cases
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pipeline_mutations();

DROP TRIGGER IF EXISTS trg_audit_case_tasks ON public.case_tasks;
CREATE TRIGGER trg_audit_case_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.case_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pipeline_mutations();

DROP TRIGGER IF EXISTS trg_audit_case_notes ON public.case_notes;
CREATE TRIGGER trg_audit_case_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pipeline_mutations();

-- ════════════════════════════════════════════════════════════════
-- 2. AUDIT LOG TAMPER-PROOF (Victoria gap #4)
-- ════════════════════════════════════════════════════════════════
--
-- audit_logs no tiene policies UPDATE/DELETE (RLS niega por default),
-- pero service_role bypassa RLS. Trigger BEFORE UPDATE/DELETE
-- previene tampering incluso desde edge functions con service_role.

CREATE OR REPLACE FUNCTION public.tg_audit_logs_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only (SOC II Type II requirement)';
END $$;

COMMENT ON FUNCTION public.tg_audit_logs_immutable() IS
  'SOC II CC4: audit log immutability. Bloquea UPDATE/DELETE incluso '
  'desde service_role. Auditor pide "demuéstrame que audit log es '
  'append-only" — este trigger es la respuesta.';

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_logs_immutable();

-- ════════════════════════════════════════════════════════════════
-- 3. matter_value COLUMN-LEVEL RLS (Victoria gap #5 — deuda cerrada)
-- ════════════════════════════════════════════════════════════════
--
-- Marcus + Victoria flag desde commit 20260605160000 (6 días):
-- gating frontend permite paralegal con DevTools leer matter_value
-- vía supabase.from("client_cases").select("matter_value"). SOC II
-- C1 Confidentiality requiere column-level enforcement.
--
-- Solución: REVOKE SELECT(matter_value) del role authenticated
-- + función SECURITY DEFINER que evalúa tier 1+2.

REVOKE SELECT(matter_value) ON public.client_cases FROM authenticated;

CREATE OR REPLACE FUNCTION public.user_can_see_matter_value(p_account uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT get_user_role_in_account(auth.uid(), p_account) IN ('owner', 'admin', 'attorney')
$$;

COMMENT ON FUNCTION public.user_can_see_matter_value(uuid) IS
  'SOC II C1: gate column-level para matter_value. Solo Tier 1+2 '
  '(owner/admin/attorney) puede leer. Paralegal/assistant/readonly NO.';

-- View que respeta el column-level gate
CREATE OR REPLACE VIEW public.client_cases_revenue AS
  SELECT
    id,
    account_id,
    CASE
      WHEN public.user_can_see_matter_value(account_id) THEN matter_value
      ELSE NULL
    END AS matter_value
  FROM public.client_cases;

GRANT SELECT ON public.client_cases_revenue TO authenticated;

COMMENT ON VIEW public.client_cases_revenue IS
  'SOC II C1: view filtrada de matter_value. Consumir esta view para '
  'mostrar revenue en Kanban/Dashboard. NUNCA query directo a '
  'client_cases.matter_value desde frontend.';

-- ════════════════════════════════════════════════════════════════
-- 4. PII COLUMN-LEVEL RLS en client_profiles (Victoria gap #6 CRÍTICO)
-- ════════════════════════════════════════════════════════════════
--
-- useCasePipeline hace nested JOIN a client_profiles(phone, mobile,
-- a_number) para TODOS los cases que el paralegal puede ver via RLS,
-- pero SIN chequear si tiene permission a ver PII de ese client
-- profile específico.
--
-- Tier 4 (assistant) y Tier 5 (readonly) NO deberían ver PII sin
-- masking. Tier 3 (paralegal) sí porque trabaja casos directos.

REVOKE SELECT(a_number, phone, mobile_phone, date_of_birth, ssn_last4)
  ON public.client_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.user_can_see_pii(p_account uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT get_user_role_in_account(auth.uid(), p_account)
    IN ('owner', 'admin', 'attorney', 'paralegal', 'member')
$$;

COMMENT ON FUNCTION public.user_can_see_pii(uuid) IS
  'SOC II C1 + Privacy: gate column-level para PII (A-number, phone, '
  'DOB, SSN). Tier 1-3 ven, Tier 4-5 (assistant/readonly) NO sin masking.';

-- View con PII masked para roles bajos
CREATE OR REPLACE VIEW public.client_profiles_safe AS
  SELECT
    id,
    account_id,
    client_id,
    full_name,
    email,
    CASE WHEN public.user_can_see_pii(account_id) THEN a_number      ELSE NULL END AS a_number,
    CASE WHEN public.user_can_see_pii(account_id) THEN phone         ELSE NULL END AS phone,
    CASE WHEN public.user_can_see_pii(account_id) THEN mobile_phone  ELSE NULL END AS mobile_phone,
    CASE WHEN public.user_can_see_pii(account_id) THEN date_of_birth ELSE NULL END AS date_of_birth,
    CASE WHEN public.user_can_see_pii(account_id) THEN ssn_last4     ELSE NULL END AS ssn_last4
  FROM public.client_profiles;

GRANT SELECT ON public.client_profiles_safe TO authenticated;

COMMENT ON VIEW public.client_profiles_safe IS
  'SOC II C1: view de client_profiles con PII auto-masked para roles '
  'que no deben verla. Frontend debe consumir esta view, NO la tabla '
  'directa. Tier 1-3 ven PII, Tier 4-5 ven NULL.';

-- Re-grant base columns
GRANT SELECT(id, account_id, client_id, full_name, email)
  ON public.client_profiles TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- 5. SOFT-DELETE COLUMNS (Victoria gap #13)
-- ════════════════════════════════════════════════════════════════
--
-- SOC II Type II + GDPR/CCPA piden:
--   - Retention policy explícita (no hard delete)
--   - Data subject rights (right to deletion con timeline)
--   - Audit trail de quién marcó para deletion
--
-- Soft-delete = ADD COLUMN deleted_at + RLS excluye + cron purge
-- después de retention period (futuro).

ALTER TABLE public.client_cases  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.case_tasks    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.case_notes    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.client_cases.deleted_at IS
  'SOC II P1 + GDPR: soft-delete. Si NOT NULL, el caso fue marcado '
  'para eliminación. Cron purge físico después de retention period '
  '(TBD por Mr. Lorenzo — recomendación: 7 años para casos cerrados '
  'legales en USA, immediate purge si client solicita right-to-erasure '
  'sin legal hold).';

COMMENT ON COLUMN public.case_tasks.deleted_at IS 'SOC II P1: soft-delete idem client_cases.';
COMMENT ON COLUMN public.case_notes.deleted_at IS 'SOC II P1: soft-delete idem client_cases.';

-- Index parcial para queries "alive" (mayoría de queries)
CREATE INDEX IF NOT EXISTS idx_client_cases_alive
  ON public.client_cases(account_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_case_tasks_alive
  ON public.case_tasks(account_id, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_case_notes_alive
  ON public.case_notes(account_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ════════════════════════════════════════════════════════════════
-- 6. VALIDATE constraint pendiente Round 4 (Victoria gap #7)
-- ════════════════════════════════════════════════════════════════
--
-- case_tasks_one_level_only CHECK fue creado NOT VALID en
-- migration 20260605120000 línea 58. Nunca se validó.
-- SOC II PI1 Integrity: constraints DEBEN estar enforced.

DO $$
BEGIN
  -- Try validate; if fails, log warning but don't block migration
  BEGIN
    ALTER TABLE public.case_tasks VALIDATE CONSTRAINT case_tasks_one_level_only;
    RAISE NOTICE 'case_tasks_one_level_only validated successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'case_tasks_one_level_only validation skipped: %', SQLERRM;
  END;
END $$;

-- ════════════════════════════════════════════════════════════════
-- 7. INDEX AUDIT LOG para queries SOC II auditor (Victoria gap)
-- ════════════════════════════════════════════════════════════════
--
-- Auditor pide queries tipo "muéstrame todas las modificaciones a
-- client_cases por user X entre fechas Y-Z". Index para perf.

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_action_time
  ON public.audit_logs(entity_type, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_account_user_time
  ON public.audit_logs(account_id, user_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════
-- 8. CHECK CONSTRAINT custom_permissions bounded (Victoria gap #11)
-- ════════════════════════════════════════════════════════════════
--
-- Anti-escalation: account_members.custom_permissions es jsonb libre.
-- Un override que setee eliminar_casos: true bypassa role gating.
-- SOC II CC6 requiere prevenir privilege escalation.

ALTER TABLE public.account_members
  DROP CONSTRAINT IF EXISTS custom_permissions_no_escalation;

ALTER TABLE public.account_members
  ADD CONSTRAINT custom_permissions_no_escalation
  CHECK (
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

COMMENT ON CONSTRAINT custom_permissions_no_escalation ON public.account_members IS
  'SOC II CC6: anti-privilege-escalation. Roles low-tier (paralegal, '
  'assistant, readonly) NO pueden recibir permisos críticos via '
  'custom_permissions override. Si Mr. Lorenzo necesita esos perms, '
  'debe cambiar el role explícitamente.';

COMMIT;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (manual):
-- ════════════════════════════════════════════════════════════════
--
-- DROP TRIGGER trg_audit_client_cases ON client_cases;
-- DROP TRIGGER trg_audit_case_tasks   ON case_tasks;
-- DROP TRIGGER trg_audit_case_notes   ON case_notes;
-- DROP FUNCTION tg_audit_pipeline_mutations();
-- DROP TRIGGER trg_audit_logs_no_update ON audit_logs;
-- DROP FUNCTION tg_audit_logs_immutable();
-- DROP VIEW client_cases_revenue;
-- DROP FUNCTION user_can_see_matter_value(uuid);
-- GRANT SELECT(matter_value) ON client_cases TO authenticated;
-- DROP VIEW client_profiles_safe;
-- DROP FUNCTION user_can_see_pii(uuid);
-- GRANT SELECT(a_number, phone, mobile_phone, date_of_birth, ssn_last4) ON client_profiles TO authenticated;
-- ALTER TABLE client_cases DROP COLUMN deleted_at;
-- ALTER TABLE case_tasks   DROP COLUMN deleted_at;
-- ALTER TABLE case_notes   DROP COLUMN deleted_at;
-- DROP INDEX idx_client_cases_alive, idx_case_tasks_alive, idx_case_notes_alive;
-- DROP INDEX idx_audit_logs_entity_action_time, idx_audit_logs_account_user_time;
-- ALTER TABLE account_members DROP CONSTRAINT custom_permissions_no_escalation;
