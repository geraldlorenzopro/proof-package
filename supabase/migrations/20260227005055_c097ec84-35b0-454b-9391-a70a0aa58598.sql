
-- Rate limiting function: checks if account has exceeded monthly usage for a tool
-- Returns JSON with allowed (boolean), used (integer), limit (integer)
CREATE OR REPLACE FUNCTION public.check_rate_limit(_user_id uuid, _tool_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account_id uuid;
  _plan ner_plan;
  _is_active boolean;
  _used integer;
  _limit integer;
BEGIN
  -- Get account info
  SELECT am.account_id INTO _account_id
  FROM account_members am WHERE am.user_id = _user_id LIMIT 1;

  IF _account_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', 0, 'reason', 'no_account');
  END IF;

  SELECT na.plan, na.is_active INTO _plan, _is_active
  FROM ner_accounts na WHERE na.id = _account_id;

  IF NOT _is_active THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', 0, 'reason', 'account_inactive');
  END IF;

  -- Define limits per plan (monthly)
  _limit := CASE
    WHEN _plan = 'essential' THEN 50
    WHEN _plan = 'professional' THEN 200
    WHEN _plan = 'elite' THEN 1000
    ELSE 50
  END;

  -- Count usage this month
  SELECT COUNT(*) INTO _used
  FROM tool_usage_logs tul
  WHERE tul.account_id = _account_id
    AND tul.tool_slug = _tool_slug
    AND tul.created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'allowed', _used < _limit,
    'used', _used,
    'limit', _limit,
    'plan', _plan::text,
    'reason', CASE WHEN _used >= _limit THEN 'limit_exceeded' ELSE 'ok' END
  );
END;
$$;

-- Admin analytics: usage stats aggregated (only callable by admins via RLS on tool_usage_logs)
CREATE OR REPLACE FUNCTION public.get_usage_stats(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _is_admin boolean;
  _result jsonb;
  _by_tool jsonb;
  _by_account jsonb;
  _by_day jsonb;
  _total integer;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Check admin/owner role
  SELECT EXISTS (
    SELECT 1 FROM account_members WHERE user_id = _user_id AND role IN ('owner', 'admin')
  ) INTO _is_admin;

  IF NOT _is_admin THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Clamp days
  IF _days < 1 THEN _days := 1; END IF;
  IF _days > 365 THEN _days := 365; END IF;

  -- Total events
  SELECT COUNT(*) INTO _total
  FROM tool_usage_logs WHERE created_at >= now() - (_days || ' days')::interval;

  -- By tool
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _by_tool
  FROM (
    SELECT tool_slug, action, COUNT(*) as count
    FROM tool_usage_logs WHERE created_at >= now() - (_days || ' days')::interval
    GROUP BY tool_slug, action ORDER BY count DESC
  ) t;

  -- By account (top 20)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _by_account
  FROM (
    SELECT na.account_name, tul.account_id, COUNT(*) as count
    FROM tool_usage_logs tul
    LEFT JOIN ner_accounts na ON na.id = tul.account_id
    WHERE tul.created_at >= now() - (_days || ' days')::interval
    GROUP BY tul.account_id, na.account_name ORDER BY count DESC LIMIT 20
  ) t;

  -- By day (for chart)
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO _by_day
  FROM (
    SELECT date_trunc('day', created_at)::date as day, tool_slug, COUNT(*) as count
    FROM tool_usage_logs WHERE created_at >= now() - (_days || ' days')::interval
    GROUP BY day, tool_slug ORDER BY day ASC
  ) t;

  RETURN jsonb_build_object(
    'total', _total,
    'by_tool', _by_tool,
    'by_account', _by_account,
    'by_day', _by_day,
    'period_days', _days
  );
END;
$$;
