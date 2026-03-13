
CREATE OR REPLACE FUNCTION public.get_firm_metrics(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_id uuid;
  _case_velocity jsonb;
  _bottlenecks jsonb;
  _team_productivity jsonb;
  _task_metrics jsonb;
  _pipeline_distribution jsonb;
  _monthly_trend jsonb;
BEGIN
  _account_id := user_account_id(auth.uid());
  IF _account_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_account');
  END IF;

  IF _days < 1 THEN _days := 1; END IF;
  IF _days > 365 THEN _days := 365; END IF;

  -- CASE VELOCITY: avg days per stage (using subquery to avoid window-in-aggregate)
  SELECT COALESCE(jsonb_agg(row_to_json(v)), '[]'::jsonb) INTO _case_velocity
  FROM (
    SELECT 
      sub.to_stage as stage,
      COUNT(*) as transitions,
      ROUND(AVG(sub.days_in_stage)::numeric, 1) as avg_days_in_stage
    FROM (
      SELECT 
        h.to_stage,
        EXTRACT(EPOCH FROM (
          COALESCE(
            LEAD(h.created_at) OVER (PARTITION BY h.case_id ORDER BY h.created_at),
            now()
          ) - h.created_at
        )) / 86400 as days_in_stage
      FROM case_stage_history h
      WHERE h.account_id = _account_id
        AND h.created_at >= now() - (_days || ' days')::interval
    ) sub
    GROUP BY sub.to_stage
    ORDER BY avg_days_in_stage DESC
  ) v;

  -- BOTTLENECKS: cases stuck >7 days in current stage
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _bottlenecks
  FROM (
    SELECT 
      cc.pipeline_stage as stage,
      COUNT(*) as stuck_cases,
      ROUND(AVG(EXTRACT(EPOCH FROM (now() - cc.stage_entered_at)) / 86400)::numeric, 1) as avg_days_stuck,
      cc.ball_in_court
    FROM client_cases cc
    WHERE cc.account_id = _account_id
      AND cc.status != 'completed'
      AND cc.stage_entered_at < now() - interval '7 days'
    GROUP BY cc.pipeline_stage, cc.ball_in_court
    ORDER BY stuck_cases DESC
    LIMIT 10
  ) t;

  -- TEAM PRODUCTIVITY
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _team_productivity
  FROM (
    SELECT 
      COALESCE(p.full_name, 'Sin asignar') as member_name,
      cc.assigned_to as member_id,
      COUNT(*) FILTER (WHERE cc.status != 'completed') as active_cases,
      COUNT(*) FILTER (WHERE cc.status = 'completed' AND cc.updated_at >= now() - (_days || ' days')::interval) as completed_in_period,
      COUNT(*) as total_cases
    FROM client_cases cc
    LEFT JOIN profiles p ON p.user_id = cc.assigned_to
    WHERE cc.account_id = _account_id
    GROUP BY cc.assigned_to, p.full_name
    ORDER BY active_cases DESC
    LIMIT 20
  ) t;

  -- TASK METRICS
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'completed', COUNT(*) FILTER (WHERE ct.status = 'completed'),
    'pending', COUNT(*) FILTER (WHERE ct.status = 'pending'),
    'overdue', COUNT(*) FILTER (WHERE ct.status != 'completed' AND ct.due_date < CURRENT_DATE),
    'completion_rate', CASE WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE ct.status = 'completed')::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0 END
  ) INTO _task_metrics
  FROM case_tasks ct
  WHERE ct.account_id = _account_id
    AND ct.created_at >= now() - (_days || ' days')::interval;

  -- PIPELINE DISTRIBUTION
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _pipeline_distribution
  FROM (
    SELECT 
      COALESCE(cc.pipeline_stage, 'sin-etapa') as stage,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE cc.ball_in_court = 'team') as team_action,
      COUNT(*) FILTER (WHERE cc.ball_in_court = 'client') as client_action
    FROM client_cases cc
    WHERE cc.account_id = _account_id
      AND cc.status != 'completed'
    GROUP BY cc.pipeline_stage
    ORDER BY count DESC
  ) t;

  -- MONTHLY TREND (last 6 months)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _monthly_trend
  FROM (
    SELECT 
      to_char(date_trunc('month', d.m), 'YYYY-MM') as month,
      COALESCE(opened.cnt, 0) as opened,
      COALESCE(closed.cnt, 0) as closed
    FROM generate_series(
      date_trunc('month', now() - interval '5 months'),
      date_trunc('month', now()),
      interval '1 month'
    ) d(m)
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as cnt FROM client_cases cc
      WHERE cc.account_id = _account_id
        AND date_trunc('month', cc.created_at) = d.m
    ) opened ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as cnt FROM client_cases cc
      WHERE cc.account_id = _account_id
        AND cc.status = 'completed'
        AND date_trunc('month', cc.updated_at) = d.m
    ) closed ON true
    ORDER BY month ASC
  ) t;

  RETURN jsonb_build_object(
    'case_velocity', _case_velocity,
    'bottlenecks', _bottlenecks,
    'team_productivity', _team_productivity,
    'task_metrics', _task_metrics,
    'pipeline_distribution', _pipeline_distribution,
    'monthly_trend', _monthly_trend,
    'period_days', _days,
    'generated_at', now()
  );
END;
$$;
