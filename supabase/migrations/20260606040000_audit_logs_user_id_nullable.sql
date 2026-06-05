-- ════════════════════════════════════════════════════════════════
-- AUDIT LOGS: user_id nullable + trigger COALESCE safety
-- Round 9 Victoria BLOCKER (Mr. Lorenzo durmiendo)
-- ════════════════════════════════════════════════════════════════
--
-- Context: migration 20260606030000 instaló trigger
-- tg_audit_pipeline_mutations que escribe en audit_logs con
-- v_user := auth.uid(). Pero auth.uid() ES NULL en:
--   - Edge functions con service_role (push-contact-to-ghl, etc)
--   - Background workers / cron jobs (ghl-sync-cron)
--   - Operaciones desde Studio / admin tools
--
-- audit_logs.user_id es NOT NULL (migration 20260311233317).
-- Resultado: TODAS las mutations server-side a client_cases /
-- case_tasks / case_notes FALLAN con violation 23502 desde
-- 20260606030000. Bug crítico — todo Pipeline broken para auth-less
-- contexts (incl. /hub/tasks cuando demo mode + fallback paths).
--
-- Fix (defensa en 2 capas):
--   1. audit_logs.user_id → nullable (refleja realidad: no toda
--      mutation viene de un user autenticado)
--   2. Trigger sigue capturando auth.uid() pero también acepta NULL.
--      Display name fallback queda en 'System' o 'Service Role'.

ALTER TABLE public.audit_logs
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.audit_logs.user_id IS
  'SOC II CC4/CC7.2: user_id puede ser NULL si la mutation viene de '
  'contexto auth-less (service_role en edge functions, cron jobs, '
  'admin tools). En esos casos user_display_name carga ''System'' o '
  'el nombre de la función. Round 9 fix de bloqueo crítico.';

-- Index para queries de auditor sobre eventos de system vs user
CREATE INDEX IF NOT EXISTS idx_audit_logs_system_events
  ON public.audit_logs(account_id, created_at DESC)
  WHERE user_id IS NULL;

COMMENT ON INDEX public.idx_audit_logs_system_events IS
  'SOC II auditor query: separar eventos auth-less (system) de '
  'eventos human-driven. Útil para reportes de attestation.';

-- Mejorar el trigger para que use display name más informativo
-- cuando auth.uid() es NULL — distinguir service_role de un user
-- desconocido.
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
BEGIN
  v_account := COALESCE(NEW.account_id, OLD.account_id);

  -- Distinguir source: user real, service_role, o anon
  IF v_user IS NOT NULL THEN
    SELECT full_name INTO v_user_name
    FROM public.profiles
    WHERE user_id = v_user
    LIMIT 1;
    v_user_name := COALESCE(v_user_name, 'Usuario');
  ELSE
    -- auth.uid() NULL → contexto auth-less
    -- current_setting('role') discrimina service_role vs anon
    BEGIN
      v_role := current_setting('role', true);
    EXCEPTION WHEN OTHERS THEN
      v_role := 'unknown';
    END;
    v_user_name := CASE
      WHEN v_role = 'service_role' THEN 'Service Role'
      WHEN v_role = 'anon'         THEN 'Anonymous'
      ELSE 'System'
    END;
  END IF;

  INSERT INTO public.audit_logs(
    account_id, user_id, user_display_name,
    action, entity_type, entity_id, metadata
  )
  VALUES (
    v_account,
    v_user,
    v_user_name,
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    jsonb_build_object(
      'op', TG_OP,
      'table', TG_TABLE_NAME,
      'source', CASE WHEN v_user IS NULL THEN 'system' ELSE 'user' END,
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )
  );

  RETURN COALESCE(NEW, OLD);
END $$;

COMMENT ON FUNCTION public.tg_audit_pipeline_mutations() IS
  'SOC II CC2/CC4/CC7.2: trigger universal de mutations Pipeline. '
  'Acepta auth-less contexts (service_role, cron, anon). v_user_name '
  'discrimina la source para que auditor sepa si fue user real o '
  'sistema. Round 9 fix BLOCKER — antes fallaba con 23502.';
