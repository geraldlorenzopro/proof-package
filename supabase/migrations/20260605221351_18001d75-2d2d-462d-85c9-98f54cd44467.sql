CREATE TABLE IF NOT EXISTS public.case_action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.ner_accounts(id) ON DELETE CASCADE NOT NULL,
  case_id uuid REFERENCES public.client_cases(id) ON DELETE CASCADE NOT NULL,
  completed_by_user_id uuid,
  completed_by_name text,
  action_key text NOT NULL,
  action_label text NOT NULL,
  action_detail text,
  was_custom boolean DEFAULT false NOT NULL,
  due_date_at_completion date,
  completed_at timestamptz DEFAULT now() NOT NULL,
  case_stage_at_completion text,
  case_status_at_completion text
);

GRANT SELECT ON public.case_action_history TO authenticated;
GRANT ALL ON public.case_action_history TO service_role;

CREATE INDEX IF NOT EXISTS idx_case_action_history_case_time
  ON public.case_action_history(case_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_action_history_account_user_time
  ON public.case_action_history(account_id, completed_by_user_id, completed_at DESC);

ALTER TABLE public.case_action_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team reads action history of own account" ON public.case_action_history;
CREATE POLICY "Team reads action history of own account"
  ON public.case_action_history FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP TRIGGER IF EXISTS trg_case_action_history_immutable_update ON public.case_action_history;
CREATE TRIGGER trg_case_action_history_immutable_update
  BEFORE UPDATE OR DELETE ON public.case_action_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_logs_immutable();

DROP TRIGGER IF EXISTS trg_case_action_history_immutable_truncate ON public.case_action_history;
CREATE TRIGGER trg_case_action_history_immutable_truncate
  BEFORE TRUNCATE ON public.case_action_history
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_audit_logs_immutable();

COMMENT ON TABLE public.case_action_history IS
  'SOC II CC4/CC7.2 + ABA 1.6: registro append-only de pasos completados en cada caso. Immutable (no UPDATE, no DELETE, no TRUNCATE).';

CREATE OR REPLACE FUNCTION public.complete_case_action(
  p_case_id uuid,
  p_snapshot jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_account uuid;
  v_user_name text;
  v_history_id uuid;
  v_case_record record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT account_id, process_stage, status, custom_fields
  INTO v_case_record
  FROM public.client_cases
  WHERE id = p_case_id;

  IF v_case_record IS NULL THEN
    RAISE EXCEPTION 'case not found';
  END IF;

  v_account := v_case_record.account_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = v_user AND account_id = v_account AND is_active = true
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE user_id = v_user
  LIMIT 1;

  INSERT INTO public.case_action_history(
    account_id, case_id,
    completed_by_user_id, completed_by_name,
    action_key, action_label, action_detail, was_custom, due_date_at_completion,
    case_stage_at_completion, case_status_at_completion
  )
  VALUES (
    v_account, p_case_id,
    v_user, COALESCE(v_user_name, 'Usuario'),
    p_snapshot->>'action_key',
    p_snapshot->>'action_label',
    p_snapshot->>'action_detail',
    COALESCE((p_snapshot->>'was_custom')::boolean, false),
    NULLIF(p_snapshot->>'due_date', '')::date,
    v_case_record.process_stage,
    v_case_record.status
  )
  RETURNING id INTO v_history_id;

  UPDATE public.client_cases
  SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) - 'next_action',
      updated_at = now()
  WHERE id = p_case_id;

  RETURN v_history_id;
END $$;

GRANT EXECUTE ON FUNCTION public.complete_case_action(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.complete_case_action(uuid, jsonb) IS
  'Atómico: marca un Próximo Paso como completado (snapshot a history) + limpia el next_action actual del caso.';