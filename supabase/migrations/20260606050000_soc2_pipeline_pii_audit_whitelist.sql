-- ════════════════════════════════════════════════════════════════
-- SOC II Round 9.19 · Victoria audit BLOCKERS
-- ════════════════════════════════════════════════════════════════
--
-- 3 bugs CRÍTICOS introducidos por Round 8 que rompen prod:
--
-- 1. tg_audit_pipeline_mutations usaba to_jsonb(NEW/OLD) → graba PII +
--    matter_value en plaintext en audit_logs.metadata. Auditor:
--    "audit_logs.metadata.new.matter_value = $80,000" = backdoor de PII.
--    Fix: whitelist explícito de cols seguras (sin PII, sin revenue).
--
-- 2. custom_permissions_no_escalation usaba BLACKLIST de 4 keys.
--    Paralegal con custom_permissions = {gestionar_usuarios: true}
--    escapaba el check. usePermissions declara 14 perms — blacklist
--    cubre solo 4. Fix: WHITELIST de perms permitidos en override
--    (los seguros + no-explosivos).
--
-- 3. tg_audit_logs_immutable no bloquea TRUNCATE. Superuser/service_role
--    podría TRUNCATE audit_logs;. Fix: agregar TRUNCATE al trigger.

-- ════════════════════════════════════════════════════════════════
-- BLOCKER #1 — Audit trigger whitelist (no PII leak)
-- ════════════════════════════════════════════════════════════════

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
  v_role text;
  v_old_safe jsonb;
  v_new_safe jsonb;
BEGIN
  v_account := COALESCE(NEW.account_id, OLD.account_id);

  IF v_user IS NOT NULL THEN
    SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user LIMIT 1;
    v_user_name := COALESCE(v_user_name, 'Usuario');
  ELSE
    BEGIN v_role := current_setting('role', true); EXCEPTION WHEN OTHERS THEN v_role := 'unknown'; END;
    v_user_name := CASE
      WHEN v_role = 'service_role' THEN 'Service Role'
      WHEN v_role = 'anon'         THEN 'Anonymous'
      ELSE 'System'
    END;
  END IF;

  -- Round 9.19: WHITELIST de campos por tabla. Excluye PII + matter_value.
  -- Audit log mantiene QUÉ cambió (status, stage, assigned_to) sin leak
  -- de CONTENIDO sensible (a_number, phone, matter_value, body de notas).
  IF TG_TABLE_NAME = 'client_cases' THEN
    v_old_safe := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN jsonb_build_object(
      'id', OLD.id, 'status', OLD.status, 'pipeline_stage', OLD.pipeline_stage,
      'process_stage', OLD.process_stage, 'case_type', OLD.case_type,
      'assigned_to', OLD.assigned_to, 'rfe_deadline', OLD.rfe_deadline,
      'pinned', OLD.pinned, 'deleted_at', OLD.deleted_at
    ) ELSE NULL END;
    v_new_safe := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN jsonb_build_object(
      'id', NEW.id, 'status', NEW.status, 'pipeline_stage', NEW.pipeline_stage,
      'process_stage', NEW.process_stage, 'case_type', NEW.case_type,
      'assigned_to', NEW.assigned_to, 'rfe_deadline', NEW.rfe_deadline,
      'pinned', NEW.pinned, 'deleted_at', NEW.deleted_at
    ) ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'case_tasks' THEN
    v_old_safe := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN jsonb_build_object(
      'id', OLD.id, 'case_id', OLD.case_id, 'status', OLD.status,
      'priority', OLD.priority, 'assigned_to', OLD.assigned_to,
      'due_date', OLD.due_date, 'task_type', OLD.task_type,
      'visibility', OLD.visibility, 'deleted_at', OLD.deleted_at
    ) ELSE NULL END;
    v_new_safe := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN jsonb_build_object(
      'id', NEW.id, 'case_id', NEW.case_id, 'status', NEW.status,
      'priority', NEW.priority, 'assigned_to', NEW.assigned_to,
      'due_date', NEW.due_date, 'task_type', NEW.task_type,
      'visibility', NEW.visibility, 'deleted_at', NEW.deleted_at
    ) ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'case_notes' THEN
    -- Nota: NO logueamos `body`. Solo metadata estructural.
    v_old_safe := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN jsonb_build_object(
      'id', OLD.id, 'case_id', OLD.case_id, 'note_type', OLD.note_type,
      'visibility', OLD.visibility, 'author_id', OLD.author_id,
      'deleted_at', OLD.deleted_at
    ) ELSE NULL END;
    v_new_safe := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN jsonb_build_object(
      'id', NEW.id, 'case_id', NEW.case_id, 'note_type', NEW.note_type,
      'visibility', NEW.visibility, 'author_id', NEW.author_id,
      'deleted_at', NEW.deleted_at
    ) ELSE NULL END;
  ELSE
    -- Fallback para tablas no enumeradas: solo id.
    v_old_safe := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN jsonb_build_object('id', OLD.id) ELSE NULL END;
    v_new_safe := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN jsonb_build_object('id', NEW.id) ELSE NULL END;
  END IF;

  INSERT INTO public.audit_logs(
    account_id, user_id, user_display_name,
    action, entity_type, entity_id, metadata
  )
  VALUES (
    v_account, v_user, v_user_name,
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object(
      'op', TG_OP,
      'table', TG_TABLE_NAME,
      'source', CASE WHEN v_user IS NULL THEN 'system' ELSE 'user' END,
      'old', v_old_safe,
      'new', v_new_safe
    )
  );

  RETURN COALESCE(NEW, OLD);
END $$;

COMMENT ON FUNCTION public.tg_audit_pipeline_mutations() IS
  'SOC II CC2/CC4 + C1.1: trigger universal Pipeline mutations. R9.19: '
  'whitelist explícito de cols por tabla — audit_logs.metadata NUNCA '
  'almacena PII (a_number/phone/dob), matter_value, ni body de notas. '
  'Auditor pediría "muéstrame audit_log de últimos 90d" y el row dump '
  'sería leak; ahora solo se ve qué CAMPO cambió, no el contenido.';

-- ════════════════════════════════════════════════════════════════
-- BLOCKER #2 — Permission escalation whitelist (no blacklist fugaz)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.account_members
  DROP CONSTRAINT IF EXISTS custom_permissions_no_escalation;

-- Whitelist: claves SEGURAS que custom_permissions PUEDE override.
-- Resto (gestionar_usuarios, eliminar_casos, ver_audit_logs, ver_revenue,
-- configurar_firma, etc.) NO se puede setear via custom — solo via role.
ALTER TABLE public.account_members
  ADD CONSTRAINT custom_permissions_no_escalation
  CHECK (
    custom_permissions IS NULL
    OR (
      SELECT bool_and(
        key IN (
          'activar_agentes_ai',
          'enviar_emails',
          'crear_casos',
          'editar_casos',
          'ver_equipo_hub',
          'ver_consultas'
        )
      )
      FROM jsonb_object_keys(custom_permissions) AS key
    )
  );

COMMENT ON CONSTRAINT custom_permissions_no_escalation ON public.account_members IS
  'SOC II CC6.1 + ABA 1.6: WHITELIST de keys permitidas en custom_permissions. '
  'Round 9.19 cambio R8 blacklist (4 keys cubría) → whitelist (6 keys ok). '
  'Anti-escalation: paralegal NUNCA puede ganar ver_audit_logs ni '
  'gestionar_usuarios via custom override — solo via cambio de role.';

-- ════════════════════════════════════════════════════════════════
-- BLOCKER #3 — Bloquear TRUNCATE en audit_logs
-- ════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
  BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_audit_logs_immutable();

COMMENT ON TRIGGER trg_audit_logs_no_truncate ON public.audit_logs IS
  'SOC II CC4: tg_audit_logs_immutable solo cubría UPDATE/DELETE. '
  'TRUNCATE bypassa esos triggers — un superuser/service_role podía '
  '`TRUNCATE audit_logs;` sin audit. Round 9.19 cierra el gap.';

-- ════════════════════════════════════════════════════════════════
-- RPC count_hidden_notes — UX señal de confidentiality (Valerie)
-- ════════════════════════════════════════════════════════════════
--
-- CLAUDE.md UX rule: "Transparencia agregada en case detail. Paralegal
-- ve contador 🔒 N privadas en header del panel". RLS bloquea
-- attorney_only/admin_only notes para paralegal → un SELECT count(*)
-- desde frontend devuelve solo lo que ve, no el total.
--
-- Esta RPC SECURITY DEFINER retorna las notes que el user actual NO
-- puede ver. Permite que paralegal sepa "hay 3 notas attorney_only"
-- sin acceso al contenido. Compliance signal visible al user + auditor.

CREATE OR REPLACE FUNCTION public.count_hidden_notes(p_case_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_total int := 0;
  v_visible int := 0;
BEGIN
  -- Resolver role del user actual
  SELECT get_user_role_in_account(auth.uid(),
    (SELECT account_id FROM client_cases WHERE id = p_case_id))
  INTO v_role;

  -- Total de notas (bypass RLS porque SECURITY DEFINER)
  SELECT COUNT(*) INTO v_total
  FROM case_notes
  WHERE case_id = p_case_id
    AND deleted_at IS NULL;

  -- Total VISIBLE para el role del user
  SELECT COUNT(*) INTO v_visible
  FROM case_notes
  WHERE case_id = p_case_id
    AND deleted_at IS NULL
    AND (
      visibility = 'team' OR visibility IS NULL
      OR (visibility = 'attorney_only' AND v_role IN ('owner','admin','attorney'))
      OR (visibility = 'admin_only' AND v_role IN ('owner','admin'))
    );

  RETURN GREATEST(v_total - v_visible, 0);
END $$;

GRANT EXECUTE ON FUNCTION public.count_hidden_notes(uuid) TO authenticated;

COMMENT ON FUNCTION public.count_hidden_notes(uuid) IS
  'SOC II + ABA 1.6 + CLAUDE.md UX rule: retorna count de notas que '
  'el current user NO puede ver por visibility gate. Para badge '
  '"🔒 N privadas" en CasePeekPanel header. Auditor ve evidencia '
  'de hierarchical visibility model en UI sin exponer contenido.';
