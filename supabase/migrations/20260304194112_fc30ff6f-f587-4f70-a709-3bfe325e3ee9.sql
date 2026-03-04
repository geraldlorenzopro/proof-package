CREATE OR REPLACE FUNCTION public.check_app_seat_status(_user_id uuid, _app_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_id uuid;
  _app_id uuid;
  _max_seats integer;
  _active_count integer;
  _has_session boolean;
  _occupants jsonb;
BEGIN
  -- Resolve account
  SELECT account_id INTO _account_id
  FROM account_members WHERE user_id = _user_id LIMIT 1;
  IF _account_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;

  -- Resolve app
  SELECT id INTO _app_id FROM hub_apps WHERE slug = _app_slug AND is_active = true;
  IF _app_id IS NULL THEN
    RETURN jsonb_build_object('status', 'app_not_found');
  END IF;

  -- Check access + get max_seats
  SELECT aaa.max_seats INTO _max_seats
  FROM account_app_access aaa
  WHERE aaa.account_id = _account_id AND aaa.app_id = _app_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_access');
  END IF;

  -- Unlimited seats
  IF _max_seats = 0 THEN
    RETURN jsonb_build_object('status', 'available', 'max_seats', 0);
  END IF;

  -- Clean stale sessions
  DELETE FROM app_active_sessions
  WHERE account_id = _account_id AND app_id = _app_id
    AND last_heartbeat < now() - interval '2 minutes';

  -- Check if user already has a session
  SELECT EXISTS(
    SELECT 1 FROM app_active_sessions
    WHERE account_id = _account_id AND app_id = _app_id AND user_id = _user_id
  ) INTO _has_session;

  IF _has_session THEN
    RETURN jsonb_build_object('status', 'already_active', 'max_seats', _max_seats);
  END IF;

  -- Count active sessions
  SELECT COUNT(*) INTO _active_count FROM app_active_sessions
  WHERE account_id = _account_id AND app_id = _app_id;

  IF _active_count < _max_seats THEN
    RETURN jsonb_build_object('status', 'available', 'max_seats', _max_seats, 'active', _active_count);
  END IF;

  -- Full: return who is occupying (with display names)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', s.user_id,
    'display_name', COALESCE(p.full_name, 'Usuario'),
    'since', s.created_at
  ) ORDER BY s.created_at ASC), '[]'::jsonb)
  INTO _occupants
  FROM app_active_sessions s
  LEFT JOIN profiles p ON p.user_id = s.user_id
  WHERE s.account_id = _account_id AND s.app_id = _app_id;

  RETURN jsonb_build_object(
    'status', 'full',
    'max_seats', _max_seats,
    'active', _active_count,
    'occupants', _occupants
  );
END;
$$;