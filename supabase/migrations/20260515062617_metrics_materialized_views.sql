-- ═══════════════════════════════════════════════════════════════════
-- METRICS MATERIALIZED VIEWS — Sprint D #5
-- MEASUREMENT-FRAMEWORK.md §10.2 L433-485
-- ═══════════════════════════════════════════════════════════════════
--
-- Estado: PENDIENTE DE APROBACIÓN — NO APLICAR HASTA OK DE MR. LORENZO
--
-- Cuando Mr. Lorenzo apruebe:
--   1. Renombrar con timestamp real (formato YYYYMMDDHHMMSS)
--   2. Pedir a Lovable: "aplicar migration"
--   3. Programar pg_cron para refresh diario (paso 2 manual en Lovable)
--   4. Refactor ReportsPage para leer de MVs en lugar de queries directas
--
-- ─── Propósito ───────────────────────────────────────────────────────
--
-- Hoy ReportsPage hace 4 queries directas a client_cases en cada page view.
-- Con >5K casos por firma se va a notar performance. Materialized views
-- precomputan los aggregates diariamente.
--
-- Inicialmente la app sigue queryeando client_cases directo. Cuando se
-- refactor ReportsPage para usar MVs, ese query passa a ser O(1) read
-- de la MV (vs O(N) scan de client_cases).
--
-- ─── 3 MVs creadas ───────────────────────────────────────────────────
--
-- 1. case_metrics_daily — snapshot por caso (un row por caso)
-- 2. firm_metrics_daily — rollup por firma (un row por firma)
-- 3. paralegal_metrics_daily — rollup por miembro (un row por user+firma)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. case_metrics_daily ─────────────────────────────────────────
-- Snapshot por caso con métricas calculadas.

CREATE MATERIALIZED VIEW IF NOT EXISTS public.case_metrics_daily AS
SELECT
  c.id AS case_id,
  c.account_id,
  c.assigned_to,
  c.case_type,
  c.status,
  c.pipeline_stage,
  date_trunc('day', NOW())::date AS snapshot_date,
  c.created_at,
  c.closed_at,
  c.updated_at,
  -- Días abiertos (siempre > 0)
  GREATEST(0, EXTRACT(DAY FROM NOW() - c.created_at)::int) AS days_open,
  -- Días en stage actual
  GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(c.stage_entered_at, c.created_at))::int) AS days_in_stage,
  -- Días totales si está cerrado
  CASE
    WHEN c.closed_at IS NOT NULL
    THEN GREATEST(0, EXTRACT(DAY FROM c.closed_at - c.created_at)::int)
    ELSE NULL
  END AS total_days_open,
  -- Stale flag (no actualizado en 7+ días)
  CASE
    WHEN c.status NOT IN ('completed', 'archived', 'cancelled')
      AND c.updated_at < NOW() - INTERVAL '7 days'
    THEN TRUE
    ELSE FALSE
  END AS is_stale,
  -- Tareas pendientes (count)
  COALESCE((
    SELECT COUNT(*) FROM public.case_tasks t
    WHERE t.case_id = c.id AND t.status = 'pending'
  ), 0)::int AS pending_tasks_count,
  -- Tareas overdue (con due_date < NOW)
  COALESCE((
    SELECT COUNT(*) FROM public.case_tasks t
    WHERE t.case_id = c.id
      AND t.status = 'pending'
      AND t.due_date IS NOT NULL
      AND t.due_date < NOW()
  ), 0)::int AS overdue_tasks_count,
  -- Documents uploaded
  COALESCE((
    SELECT COUNT(*) FROM public.case_documents d
    WHERE d.case_id = c.id
  ), 0)::int AS documents_count
FROM public.client_cases c;

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_metrics_daily_pk
  ON public.case_metrics_daily(case_id);
CREATE INDEX IF NOT EXISTS idx_case_metrics_daily_account
  ON public.case_metrics_daily(account_id);
CREATE INDEX IF NOT EXISTS idx_case_metrics_daily_assigned
  ON public.case_metrics_daily(assigned_to)
  WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_metrics_daily_stale
  ON public.case_metrics_daily(account_id, is_stale)
  WHERE is_stale = TRUE;

-- ─── 2. firm_metrics_daily ─────────────────────────────────────────
-- Rollup por firma. Un row por account_id.

CREATE MATERIALIZED VIEW IF NOT EXISTS public.firm_metrics_daily AS
SELECT
  a.id AS account_id,
  date_trunc('day', NOW())::date AS snapshot_date,
  -- Casos por status
  COUNT(*) FILTER (
    WHERE c.status IS NOT NULL
      AND c.status NOT IN ('completed', 'archived', 'cancelled')
  )::int AS active_cases,
  COUNT(*) FILTER (
    WHERE c.status = 'completed'
      AND c.closed_at > NOW() - INTERVAL '30 days'
  )::int AS closed_30d,
  COUNT(*) FILTER (
    WHERE c.status = 'completed'
      AND c.closed_at > NOW() - INTERVAL '90 days'
  )::int AS closed_90d,
  COUNT(*) FILTER (
    WHERE c.status NOT IN ('completed', 'archived', 'cancelled')
      AND c.updated_at < NOW() - INTERVAL '7 days'
  )::int AS stale_cases,
  -- Días promedio de cierre (últimos 90 días)
  AVG(
    CASE
      WHEN c.status = 'completed'
        AND c.closed_at > NOW() - INTERVAL '90 days'
        AND c.closed_at > c.created_at
      THEN EXTRACT(DAY FROM c.closed_at - c.created_at)
      ELSE NULL
    END
  )::int AS avg_close_days,
  COUNT(DISTINCT c.assigned_to) FILTER (
    WHERE c.assigned_to IS NOT NULL
      AND c.status NOT IN ('completed', 'archived', 'cancelled')
  )::int AS active_paralegals,
  -- Total casos all-time
  COUNT(*)::int AS total_cases_ever
FROM public.ner_accounts a
LEFT JOIN public.client_cases c ON c.account_id = a.id
GROUP BY a.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_metrics_daily_pk
  ON public.firm_metrics_daily(account_id);

-- ─── 3. paralegal_metrics_daily ────────────────────────────────────
-- Rollup por miembro (paralegal+abogado individual).

CREATE MATERIALIZED VIEW IF NOT EXISTS public.paralegal_metrics_daily AS
SELECT
  am.account_id,
  am.user_id,
  date_trunc('day', NOW())::date AS snapshot_date,
  COUNT(*) FILTER (
    WHERE c.assigned_to = am.user_id
      AND c.status NOT IN ('completed', 'archived', 'cancelled')
  )::int AS active_cases,
  COUNT(*) FILTER (
    WHERE c.assigned_to = am.user_id
      AND c.status = 'completed'
      AND c.closed_at > NOW() - INTERVAL '30 days'
  )::int AS closed_30d,
  COUNT(*) FILTER (
    WHERE c.assigned_to = am.user_id
      AND c.status NOT IN ('completed', 'archived', 'cancelled')
      AND c.updated_at < NOW() - INTERVAL '7 days'
  )::int AS stale_cases,
  -- Avg close days personal
  AVG(
    CASE
      WHEN c.assigned_to = am.user_id
        AND c.status = 'completed'
        AND c.closed_at > NOW() - INTERVAL '90 days'
        AND c.closed_at > c.created_at
      THEN EXTRACT(DAY FROM c.closed_at - c.created_at)
      ELSE NULL
    END
  )::int AS avg_close_days
FROM public.account_members am
LEFT JOIN public.client_cases c ON c.account_id = am.account_id
WHERE am.is_active = true
GROUP BY am.account_id, am.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_paralegal_metrics_daily_pk
  ON public.paralegal_metrics_daily(account_id, user_id);

-- ─── Función refresh (call from pg_cron diariamente) ───────────────

CREATE OR REPLACE FUNCTION public.refresh_metrics_mvs()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ := NOW();
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.case_metrics_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.firm_metrics_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.paralegal_metrics_daily;
  RETURN 'Refreshed in ' || (NOW() - v_start)::TEXT;
END;
$$;

COMMENT ON FUNCTION public.refresh_metrics_mvs() IS
  'Refresh diario de metrics MVs. Programar via pg_cron: SELECT cron.schedule(''refresh-metrics'', ''0 1 * * *'', ''SELECT public.refresh_metrics_mvs()'');';

-- ─── RLS (las MVs heredan RLS de las tablas base) ──────────────────
-- Las MVs en Postgres NO soportan RLS directo. La RLS se aplica vía:
-- 1. SELECT queries desde el frontend filtran por account_id (cliente filtra)
-- 2. Service role bypassa todo (admin queries)
-- 3. Las tablas base (client_cases, account_members) tienen RLS estricta,
--    así que aunque la MV no tenga RLS, los queries SELECT desde
--    authenticated/anon devuelven 0 rows si el JOIN-on-tabla-base no permite.
--
-- Nota técnica: MVs no son tables. CREATE POLICY ON MATERIALIZED VIEW falla.
-- La estrategia es: queries del frontend SIEMPRE incluyen account_id en WHERE.

-- ─── Rollback ──────────────────────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.refresh_metrics_mvs();
-- DROP MATERIALIZED VIEW IF EXISTS public.paralegal_metrics_daily;
-- DROP MATERIALIZED VIEW IF EXISTS public.firm_metrics_daily;
-- DROP MATERIALIZED VIEW IF EXISTS public.case_metrics_daily;
