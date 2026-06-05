CREATE OR REPLACE FUNCTION public.tg_audit_pipeline_mutations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
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
    v_user_name := CASE WHEN v_role = 'service_role' THEN 'Service Role'
      WHEN v_role = 'anon' THEN 'Anonymous' ELSE 'System' END;
  END IF;

  IF TG_TABLE_NAME = 'client_cases' THEN
    v_old_safe := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN jsonb_build_object(
      'id', OLD.id, 'status', OLD.status, 'pipeline_stage', OLD.pipeline_stage,
      'process_stage', OLD.process_stage, 'case_type', OLD.case_type,
      'assigned_to', OLD.assigned_to, 'rfe_deadline', OLD.rfe_deadline,
      'pinned', OLD.pinned, 'deleted_at', OLD.deleted_at) ELSE NULL END;
    v_new_safe := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN jsonb_build_object(
      'id', NEW.id, 'status', NEW.status, 'pipeline_stage', NEW.pipeline_stage,
      'process_stage', NEW.process_stage, 'case_type', NEW.case_type,
      'assigned_to', NEW.assigned_to, 'rfe_deadline', NEW.rfe_deadline,
      'pinned', NEW.pinned, 'deleted_at', NEW.deleted_at) ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'case_tasks' THEN
    v_old_safe := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN jsonb_build_object(
      'id', OLD.id, 'case_id', OLD.case_id, 'status', OLD.status,
      'priority', OLD.priority, 'assigned_to', OLD.assigned_to,
      'due_date', OLD.due_date, 'task_type', OLD.task_type,
      'visibility', OLD.visibility, 'deleted_at', OLD.deleted_at) ELSE NULL END;
    v_new_safe := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN jsonb_build_object(
      'id', NEW.id, 'case_id', NEW.case_id, 'status', NEW.status,
      'priority', NEW.priority, 'assigned_to', NEW.assigned_to,
      'due_date', NEW.due_date, 'task_type', NEW.task_type,
      'visibility', NEW.visibility, 'deleted_at', NEW.deleted_at) ELSE NULL END;
  ELSIF TG_TABLE_NAME = 'case_notes' THEN
    v_old_safe := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN jsonb_build_object(
      'id', OLD.id, 'case_id', OLD.case_id, 'note_type', OLD.note_type,
      'visibility', OLD.visibility, 'author_id', OLD.author_id,
      'deleted_at', OLD.deleted_at) ELSE NULL END;
    v_new_safe := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN jsonb_build_object(
      'id', NEW.id, 'case_id', NEW.case_id, 'note_type', NEW.note_type,
      'visibility', NEW.visibility, 'author_id', NEW.author_id,
      'deleted_at', NEW.deleted_at) ELSE NULL END;
  ELSE
    v_old_safe := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN jsonb_build_object('id', OLD.id) ELSE NULL END;
    v_new_safe := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN jsonb_build_object('id', NEW.id) ELSE NULL END;
  END IF;

  INSERT INTO public.audit_logs(account_id, user_id, user_display_name, action, entity_type, entity_id, metadata)
  VALUES (v_account, v_user, v_user_name,
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP), TG_TABLE_NAME, COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME,
      'source', CASE WHEN v_user IS NULL THEN 'system' ELSE 'user' END,
      'old', v_old_safe, 'new', v_new_safe));
  RETURN COALESCE(NEW, OLD);
END $$;

-- Anti-escalation via trigger (Postgres CHECK no permite subqueries)
ALTER TABLE public.account_members DROP CONSTRAINT IF EXISTS custom_permissions_no_escalation;

CREATE OR REPLACE FUNCTION public.tg_custom_permissions_whitelist()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_bad_key text;
  v_allowed text[] := ARRAY['activar_agentes_ai','enviar_emails','crear_casos','editar_casos','ver_equipo_hub','ver_consultas'];
BEGIN
  IF NEW.custom_permissions IS NULL THEN RETURN NEW; END IF;
  SELECT key INTO v_bad_key
  FROM jsonb_object_keys(NEW.custom_permissions) AS key
  WHERE NOT (key = ANY(v_allowed))
  LIMIT 1;
  IF v_bad_key IS NOT NULL THEN
    RAISE EXCEPTION 'custom_permissions key % is not in whitelist (SOC II anti-escalation)', v_bad_key
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_custom_permissions_whitelist ON public.account_members;
CREATE TRIGGER trg_custom_permissions_whitelist
  BEFORE INSERT OR UPDATE ON public.account_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_custom_permissions_whitelist();

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_audit_logs_immutable();

CREATE OR REPLACE FUNCTION public.count_hidden_notes(p_case_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp
AS $$
DECLARE v_role text; v_total int := 0; v_visible int := 0;
BEGIN
  SELECT get_user_role_in_account(auth.uid(),
    (SELECT account_id FROM client_cases WHERE id = p_case_id)) INTO v_role;
  SELECT COUNT(*) INTO v_total FROM case_notes WHERE case_id = p_case_id AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_visible FROM case_notes WHERE case_id = p_case_id AND deleted_at IS NULL
    AND (visibility = 'team' OR visibility IS NULL
      OR (visibility = 'attorney_only' AND v_role IN ('owner','admin','attorney'))
      OR (visibility = 'admin_only' AND v_role IN ('owner','admin')));
  RETURN GREATEST(v_total - v_visible, 0);
END $$;
GRANT EXECUTE ON FUNCTION public.count_hidden_notes(uuid) TO authenticated;