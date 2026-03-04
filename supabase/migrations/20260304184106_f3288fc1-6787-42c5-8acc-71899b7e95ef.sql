
-- Function: acquire_app_seat
-- Returns JSON with: granted (bool), kicked_user_id (uuid|null), session_id (uuid|null)
-- If max_seats=0 → unlimited, always grant
-- If seat available → grant
-- If full → kick oldest session (FIFO), grant new one
CREATE OR REPLACE FUNCTION public.acquire_app_seat(
  _user_id uuid,
  _app_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_id uuid;
  _app_id uuid;
  _max_seats integer;
  _active_count integer;
  _existing_session_id uuid;
  _oldest_session record;
  _new_session_id uuid;
BEGIN
  -- Resolve account
  SELECT account_id INTO _account_id
  FROM account_members WHERE user_id = _user_id LIMIT 1;
  IF _account_id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_account');
  END IF;

  -- Resolve app
  SELECT id INTO _app_id FROM hub_apps WHERE slug = _app_slug AND is_active = true;
  IF _app_id IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'app_not_found');
  END IF;

  -- Check access + get max_seats
  SELECT aaa.max_seats INTO _max_seats
  FROM account_app_access aaa
  WHERE aaa.account_id = _account_id AND aaa.app_id = _app_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'no_access');
  END IF;

  -- Unlimited seats
  IF _max_seats = 0 THEN
    -- Upsert session
    INSERT INTO app_active_sessions (account_id, app_id, user_id, last_heartbeat)
    VALUES (_account_id, _app_id, _user_id, now())
    ON CONFLICT DO NOTHING;
    -- Get or create
    SELECT id INTO _new_session_id FROM app_active_sessions
    WHERE account_id = _account_id AND app_id = _app_id AND user_id = _user_id;
    IF _new_session_id IS NULL THEN
      INSERT INTO app_active_sessions (account_id, app_id, user_id, last_heartbeat)
      VALUES (_account_id, _app_id, _user_id, now())
      RETURNING id INTO _new_session_id;
    ELSE
      UPDATE app_active_sessions SET last_heartbeat = now() WHERE id = _new_session_id;
    END IF;
    RETURN jsonb_build_object('granted', true, 'session_id', _new_session_id);
  END IF;

  -- Clean stale sessions (no heartbeat in 2 min)
  DELETE FROM app_active_sessions
  WHERE account_id = _account_id AND app_id = _app_id
    AND last_heartbeat < now() - interval '2 minutes';

  -- Check if user already has a session
  SELECT id INTO _existing_session_id FROM app_active_sessions
  WHERE account_id = _account_id AND app_id = _app_id AND user_id = _user_id;
  IF _existing_session_id IS NOT NULL THEN
    UPDATE app_active_sessions SET last_heartbeat = now() WHERE id = _existing_session_id;
    RETURN jsonb_build_object('granted', true, 'session_id', _existing_session_id);
  END IF;

  -- Count active sessions
  SELECT COUNT(*) INTO _active_count FROM app_active_sessions
  WHERE account_id = _account_id AND app_id = _app_id;

  -- If room available, grant
  IF _active_count < _max_seats THEN
    INSERT INTO app_active_sessions (account_id, app_id, user_id, last_heartbeat)
    VALUES (_account_id, _app_id, _user_id, now())
    RETURNING id INTO _new_session_id;
    RETURN jsonb_build_object('granted', true, 'session_id', _new_session_id);
  END IF;

  -- Full: kick oldest (FIFO)
  SELECT id, user_id INTO _oldest_session FROM app_active_sessions
  WHERE account_id = _account_id AND app_id = _app_id
  ORDER BY created_at ASC LIMIT 1;

  DELETE FROM app_active_sessions WHERE id = _oldest_session.id;

  INSERT INTO app_active_sessions (account_id, app_id, user_id, last_heartbeat)
  VALUES (_account_id, _app_id, _user_id, now())
  RETURNING id INTO _new_session_id;

  RETURN jsonb_build_object(
    'granted', true,
    'session_id', _new_session_id,
    'kicked_user_id', _oldest_session.user_id
  );
END;
$$;

-- Function: release_app_seat
CREATE OR REPLACE FUNCTION public.release_app_seat(
  _user_id uuid,
  _app_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _app_id uuid;
BEGIN
  SELECT id INTO _app_id FROM hub_apps WHERE slug = _app_slug;
  IF _app_id IS NOT NULL THEN
    DELETE FROM app_active_sessions WHERE user_id = _user_id AND app_id = _app_id;
  END IF;
END;
$$;

-- Function: heartbeat (update last_heartbeat, check if still valid)
CREATE OR REPLACE FUNCTION public.heartbeat_app_seat(
  _user_id uuid,
  _app_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _app_id uuid;
  _session_id uuid;
BEGIN
  SELECT id INTO _app_id FROM hub_apps WHERE slug = _app_slug;
  IF _app_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'app_not_found');
  END IF;

  SELECT id INTO _session_id FROM app_active_sessions
  WHERE user_id = _user_id AND app_id = _app_id;

  IF _session_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'kicked');
  END IF;

  UPDATE app_active_sessions SET last_heartbeat = now() WHERE id = _session_id;
  RETURN jsonb_build_object('valid', true, 'session_id', _session_id);
END;
$$;
