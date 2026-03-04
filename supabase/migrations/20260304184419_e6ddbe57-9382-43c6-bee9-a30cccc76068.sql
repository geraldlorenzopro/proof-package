
CREATE OR REPLACE FUNCTION public.check_rate_limit(_user_id uuid, _tool_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _account_id uuid;
  _plan ner_plan;
  _is_active boolean;
  _used integer;
  _limit integer;
BEGIN
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

  _limit := CASE
    WHEN _plan = 'essential' THEN 50
    WHEN _plan = 'professional' THEN 200
    WHEN _plan = 'elite' THEN 1000
    WHEN _plan = 'enterprise' THEN 99999
    ELSE 50
  END;

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
