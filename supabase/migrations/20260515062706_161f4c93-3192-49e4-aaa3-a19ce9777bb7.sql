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
  GREATEST(0, EXTRACT(DAY FROM NOW() - c.created_at)::int) AS days_open,
  GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(c.stage_entered_at, c.created_at))::int) AS days_in_stage,
  CASE WHEN c.closed_at IS NOT NULL
    THEN GREATEST(0, EXTRACT(DAY FROM c.closed_at - c.created_at)::int)
    ELSE NULL END AS total_days_open,
  CASE WHEN c.status NOT IN ('completed', 'archived', 'cancelled')
      AND c.updated_at < NOW() - INTERVAL '7 days'
    THEN TRUE ELSE FALSE END AS is_stale,
  COALESCE((SELECT COUNT(*) FROM public.case_tasks t WHERE t.case_id = c.id AND t.status = 'pending'), 0)::int AS pending_tasks_count,
  COALESCE((SELECT COUNT(*) FROM public.case_tasks t WHERE t.case_id = c.id AND t.status = 'pending' AND t.due_date IS NOT NULL AND t.due_date < NOW()), 0)::int AS overdue_tasks_count,
  COALESCE((SELECT COUNT(*) FROM public.case_documents d WHERE d.case_id = c.id), 0)::int AS documents_count
FROM public.client_cases c;

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_metrics_daily_pk ON public.case_metrics_daily(case_id);
CREATE INDEX IF NOT EXISTS idx_case_metrics_daily_account ON public.case_metrics_daily(account_id);
CREATE INDEX IF NOT EXISTS idx_case_metrics_daily_assigned ON public.case_metrics_daily(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_metrics_daily_stale ON public.case_metrics_daily(account_id, is_stale) WHERE is_stale = TRUE;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.firm_metrics_daily AS
SELECT
  a.id AS account_id,
  date_trunc('day', NOW())::date AS snapshot_date,
  COUNT(*) FILTER (WHERE c.status IS NOT NULL AND c.status NOT IN ('completed', 'archived', 'cancelled'))::int AS active_cases,
  COUNT(*) FILTER (WHERE c.status = 'completed' AND c.closed_at > NOW() - INTERVAL '30 days')::int AS closed_30d,
  COUNT(*) FILTER (WHERE c.status = 'completed' AND c.closed_at > NOW() - INTERVAL '90 days')::int AS closed_90d,
  COUNT(*) FILTER (WHERE c.status NOT IN ('completed', 'archived', 'cancelled') AND c.updated_at < NOW() - INTERVAL '7 days')::int AS stale_cases,
  AVG(CASE WHEN c.status = 'completed' AND c.closed_at > NOW() - INTERVAL '90 days' AND c.closed_at > c.created_at
      THEN EXTRACT(DAY FROM c.closed_at - c.created_at) ELSE NULL END)::int AS avg_close_days,
  COUNT(DISTINCT c.assigned_to) FILTER (WHERE c.assigned_to IS NOT NULL AND c.status NOT IN ('completed', 'archived', 'cancelled'))::int AS active_paralegals,
  COUNT(*)::int AS total_cases_ever
FROM public.ner_accounts a
LEFT JOIN public.client_cases c ON c.account_id = a.id
GROUP BY a.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_metrics_daily_pk ON public.firm_metrics_daily(account_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.paralegal_metrics_daily AS
SELECT
  am.account_id,
  am.user_id,
  date_trunc('day', NOW())::date AS snapshot_date,
  COUNT(*) FILTER (WHERE c.assigned_to = am.user_id AND c.status NOT IN ('completed', 'archived', 'cancelled'))::int AS active_cases,
  COUNT(*) FILTER (WHERE c.assigned_to = am.user_id AND c.status = 'completed' AND c.closed_at > NOW() - INTERVAL '30 days')::int AS closed_30d,
  COUNT(*) FILTER (WHERE c.assigned_to = am.user_id AND c.status NOT IN ('completed', 'archived', 'cancelled') AND c.updated_at < NOW() - INTERVAL '7 days')::int AS stale_cases,
  AVG(CASE WHEN c.assigned_to = am.user_id AND c.status = 'completed' AND c.closed_at > NOW() - INTERVAL '90 days' AND c.closed_at > c.created_at
      THEN EXTRACT(DAY FROM c.closed_at - c.created_at) ELSE NULL END)::int AS avg_close_days
FROM public.account_members am
LEFT JOIN public.client_cases c ON c.account_id = am.account_id
WHERE am.is_active = true
GROUP BY am.account_id, am.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_paralegal_metrics_daily_pk ON public.paralegal_metrics_daily(account_id, user_id);

CREATE OR REPLACE FUNCTION public.refresh_metrics_mvs()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_start TIMESTAMPTZ := NOW();
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.case_metrics_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.firm_metrics_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.paralegal_metrics_daily;
  RETURN 'Refreshed in ' || (NOW() - v_start)::TEXT;
END;
$$;

COMMENT ON FUNCTION public.refresh_metrics_mvs() IS 'Refresh diario de metrics MVs vía pg_cron';