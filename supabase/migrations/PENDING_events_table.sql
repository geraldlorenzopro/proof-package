-- ═══════════════════════════════════════════════════════════════════
-- EVENTS TABLE — UNIVERSAL EVENT LOG (5° plano fundacional)
-- ═══════════════════════════════════════════════════════════════════
--
-- Estado: PENDIENTE DE APROBACIÓN — NO APLICAR HASTA OK DE MR. LORENZO
--
-- Por qué PENDING_ prefix:
--   Esta migration NO está nombrada con timestamp porque NO está aprobada
--   para deploy. Cuando Mr. Lorenzo apruebe:
--     1. Renombrar a 20260514HHMMSS_events_table.sql (timestamp real)
--     2. Pedir a Lovable: "pull main <SHA> y aplicá la migration"
--     3. Empezar a instrumentar pantallas con useTrackPageView()
--
-- Contexto:
--   Decisión 2026-05-14 "todo debe ser medible" — ver
--   .ai/master/MEASUREMENT-FRAMEWORK.md
--
-- Migration safety:
--   - Tabla NUEVA, no toca data existente
--   - RLS habilitado desde día 1 (multi-tenant por account_id)
--   - JSONB properties column flexible para evolución sin migrations futuras
--   - Indexes en (account_id, occurred_at DESC), event_name, case_id
--   - Retention policy: 24 meses raw → agregaciones a tablas dedicadas
--   - PII guard: nunca aceptamos full names, A-numbers, SSN en properties
--     (validación a nivel aplicación, ver src/lib/analytics.ts)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant: cada event pertenece a una firma.
  -- nullable solo para eventos pre-auth (auth.signup_started, etc.)
  account_id UUID REFERENCES public.ner_accounts(id) ON DELETE CASCADE,

  -- Quien disparó el evento. Nullable porque:
  --   - aplicantes públicos disparan eventos vía token (sin user_id)
  --   - eventos de sistema (cron jobs) no tienen user
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Caso al que se asocia el evento (opcional)
  case_id UUID REFERENCES public.client_cases(id) ON DELETE CASCADE,

  -- Nombre del evento siguiendo taxonomy <category>.<entity>.<action>
  -- Ej: 'case.created', 'ai.invoked', 'applicant.intake_completed'
  event_name TEXT NOT NULL,

  -- Categoría derivada del prefijo (case, ai, applicant, perf, billing, etc.)
  -- Almacenada explícitamente para facilitar GROUP BY y RLS por categoría.
  event_category TEXT NOT NULL,

  -- Propiedades arbitrarias del evento.
  -- IMPORTANTE: NUNCA contener PII directa.
  --   ✅ OK: { duration_ms: 540, tool: 'felix', success: true }
  --   ❌ NO: { client_name: 'Patricia Alvarado', ssn: '...' }
  -- Validación a nivel aplicación en src/lib/analytics.ts
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Cuándo ocurrió. Default NOW() para eventos client-side que no especifican.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identificador de sesión del cliente (sessionStorage uuid).
  -- Permite reconstruir flujos sin user_id (aplicante público).
  client_session_id TEXT,

  -- Geo + UA opcionales para anomaly detection y debugging
  ip_country TEXT,
  user_agent TEXT
);

-- Indexes para queries comunes
CREATE INDEX IF NOT EXISTS idx_events_account_time
  ON public.events(account_id, occurred_at DESC)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_name
  ON public.events(event_name);

CREATE INDEX IF NOT EXISTS idx_events_category
  ON public.events(event_category);

CREATE INDEX IF NOT EXISTS idx_events_case
  ON public.events(case_id)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_user_time
  ON public.events(user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_session
  ON public.events(client_session_id)
  WHERE client_session_id IS NOT NULL;

-- ═══ RLS — multi-tenant ═══
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- SELECT: solo miembros activos del account pueden leer sus eventos.
-- NER admin platform-wide tiene cross-account access vía service_role
-- (sin RLS).
CREATE POLICY "events_select_own_account"
  ON public.events
  FOR SELECT
  USING (
    account_id IS NOT NULL
    AND account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- INSERT: cualquier usuario autenticado puede insertar eventos en su account.
-- Eventos sin account_id (pre-auth) usan service_role o anon key sin RLS.
CREATE POLICY "events_insert_own_account"
  ON public.events
  FOR INSERT
  WITH CHECK (
    -- Caso 1: evento autenticado dentro del account del usuario
    (account_id IS NOT NULL AND account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    ))
    OR
    -- Caso 2: evento pre-auth o de aplicante público sin account_id
    -- (validado a nivel aplicación via token signed)
    (account_id IS NULL AND user_id IS NULL)
  );

-- NO UPDATE policy: eventos son inmutables (audit log).
-- NO DELETE policy de usuario regular. Solo retention job (service_role).

-- ═══ Retention helper (manual por ahora, cron post-MVP) ═══
-- Función para borrar eventos raw > 24 meses, manteniendo agregados.
CREATE OR REPLACE FUNCTION public.events_retention_cleanup()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  DELETE FROM public.events
  WHERE occurred_at < NOW() - INTERVAL '24 months';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.events_retention_cleanup() IS
  'Borra events > 24 meses. Run via pg_cron monthly o manual desde admin.';

-- ═══ Rollback plan ═══
-- DROP TABLE IF EXISTS public.events CASCADE;
-- DROP FUNCTION IF EXISTS public.events_retention_cleanup();
-- (rollback safe: tabla nueva, sin dependencias externas)
