
CREATE OR REPLACE FUNCTION public.create_intake_with_profile(
  p_account_id uuid,
  p_user_id uuid,
  p_profile_data jsonb,
  p_intake_data jsonb,
  p_appointment_data jsonb,
  p_existing_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_intake_id uuid;
  v_appointment_id uuid;
  v_token text;
BEGIN
  -- Validate inputs
  IF p_account_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'account_id and user_id are required';
  END IF;

  -- STEP 1: Profile (update existing or create new)
  IF p_existing_profile_id IS NOT NULL THEN
    UPDATE client_profiles
    SET updated_at = now(),
        source_channel = COALESCE(p_profile_data->>'source_channel', source_channel),
        source_detail = COALESCE(p_profile_data->>'source_detail', source_detail)
    WHERE id = p_existing_profile_id AND account_id = p_account_id;
    v_profile_id := p_existing_profile_id;
  ELSE
    INSERT INTO client_profiles (
      account_id, created_by,
      first_name, last_name, phone, email,
      phone_label, mobile_phone, mobile_phone_label,
      source_channel, source_detail,
      contact_stage
    )
    VALUES (
      p_account_id, p_user_id,
      p_profile_data->>'first_name',
      p_profile_data->>'last_name',
      p_profile_data->>'phone',
      NULLIF(p_profile_data->>'email', ''),
      COALESCE(p_profile_data->>'phone_label', 'mobile'),
      NULLIF(p_profile_data->>'mobile_phone', ''),
      COALESCE(p_profile_data->>'mobile_phone_label', 'mobile'),
      p_profile_data->>'source_channel',
      p_profile_data->>'source_detail',
      'lead'
    )
    RETURNING id INTO v_profile_id;
  END IF;

  -- STEP 2: Intake Session
  INSERT INTO intake_sessions (
    account_id, created_by,
    client_profile_id,
    entry_channel, entry_channel_detail,
    referral_source,
    client_first_name, client_last_name,
    client_phone, client_email,
    client_language, client_relationship,
    client_relationship_detail,
    consultation_reason, consultation_topic,
    consultation_topic_tag,
    intake_delivery_channel,
    urgency_level, notes,
    status, entry_date, entry_method,
    is_existing_client
  )
  VALUES (
    p_account_id, p_user_id,
    v_profile_id,
    p_intake_data->>'entry_channel',
    NULLIF(p_intake_data->>'entry_channel_detail', ''),
    NULLIF(p_intake_data->>'referral_source', ''),
    p_intake_data->>'client_first_name',
    p_intake_data->>'client_last_name',
    p_intake_data->>'client_phone',
    NULLIF(p_intake_data->>'client_email', ''),
    COALESCE(NULLIF(p_intake_data->>'client_language', ''), 'es'),
    NULLIF(p_intake_data->>'client_relationship', ''),
    NULLIF(p_intake_data->>'client_relationship_detail', ''),
    NULLIF(p_intake_data->>'consultation_reason', ''),
    NULLIF(p_intake_data->>'consultation_topic', ''),
    NULLIF(p_intake_data->>'consultation_topic_tag', ''),
    NULLIF(p_intake_data->>'intake_delivery_channel', ''),
    NULLIF(p_intake_data->>'urgency_level', ''),
    NULLIF(p_intake_data->>'notes', ''),
    'in_progress',
    CURRENT_DATE,
    'wizard',
    (p_existing_profile_id IS NOT NULL)
  )
  RETURNING id INTO v_intake_id;

  -- STEP 3: Appointment
  INSERT INTO appointments (
    account_id, client_profile_id,
    intake_session_id,
    client_name, client_phone, client_email,
    appointment_date, appointment_type,
    status, pre_intake_sent
  )
  VALUES (
    p_account_id, v_profile_id,
    v_intake_id,
    p_appointment_data->>'client_name',
    p_appointment_data->>'client_phone',
    NULLIF(p_appointment_data->>'client_email', ''),
    CURRENT_DATE,
    'consultation',
    'scheduled',
    COALESCE(p_intake_data->>'intake_delivery_channel', '') != 'presencial'
  )
  RETURNING id, pre_intake_token INTO v_appointment_id, v_token;

  RETURN jsonb_build_object(
    'profile_id', v_profile_id,
    'intake_id', v_intake_id,
    'appointment_id', v_appointment_id,
    'pre_intake_token', v_token
  );
END;
$$;
