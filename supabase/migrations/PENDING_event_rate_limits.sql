-- ═══════════════════════════════════════════════════════════════════
-- EVENT_RATE_LIMITS TABLE — Ola 3.2.b
-- ═══════════════════════════════════════════════════════════════════
--
-- Estado: PENDIENTE DE APROBACIÓN — NO APLICAR HASTA OK DE MR. LORENZO
--
-- Cuando Mr. Lorenzo apruebe:
--   1. Renombrar a 20260514HHMMSS_event_rate_limits.sql (timestamp real)
--   2. Pedir a Lovable: "pull main <SHA> y aplicá la migration + deploya
--      la edge function track-public-event"
--
-- ─── Propósito ───────────────────────────────────────────────────────
--
-- Backing store para rate limiting de la edge function track-public-event
-- (Ola 3.2.b). La edge function maneja eventos pre-auth (signup intent,
-- applicant intake con token) que NO pueden ir directo a la tabla `events`
-- porque la RLS post-Ola 3.1 requiere auth.uid() válido.
--
-- Sin rate limit, un atacante con la anon key podría saturar la edge fn.
--
-- ─── Diseño ──────────────────────────────────────────────────────────
--
-- Sliding window por IP + endpoint:
--   - key: hash(ip + event_category) — string
--   - window_start: timestamp del inicio de la ventana de 60s
--   - count: número de requests en esa ventana
--
-- Cleanup: la propia edge fn borra entries > 5 min cada N requests
-- (lazy), o un cron pg_cron mensual si crece mucho.
--
-- ─── Schema safety ───────────────────────────────────────────────────
--
-- - Tabla NUEVA, no toca data existente
-- - Sin RLS (solo service_role la accede)
-- - Index único en (key) para upserts rápidos
-- - Sin foreign keys (rate limit no debe romper si user/account se borra)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.event_rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count INT NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_rate_limits_window
  ON public.event_rate_limits(window_start DESC);

-- RLS bloquea acceso desde anon/authenticated. Solo service_role
-- (la edge function track-public-event) puede operar sobre esta tabla.
ALTER TABLE public.event_rate_limits ENABLE ROW LEVEL SECURITY;

-- Sin policies → nadie excepto service_role puede leer/escribir.

-- Helper: cleanup de entries viejas (>5 min). Llamado lazy desde la
-- edge function (1 de cada N requests).
CREATE OR REPLACE FUNCTION public.cleanup_event_rate_limits()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM public.event_rate_limits
  WHERE last_seen_at < NOW() - INTERVAL '5 minutes';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_event_rate_limits() IS
  'Borra entries de rate limit > 5 min. Llamado lazy desde edge fn.';

-- ═══ Rollback plan ═══
-- DROP FUNCTION IF EXISTS public.cleanup_event_rate_limits();
-- DROP TABLE IF EXISTS public.event_rate_limits CASCADE;
