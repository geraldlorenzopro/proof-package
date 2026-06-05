-- ════════════════════════════════════════════════════════════════
-- Round 9.23 — Case Action History (Mr. Lorenzo opción A+C)
-- ════════════════════════════════════════════════════════════════
--
-- Hoy "Próximo paso" se edita pero no se MARCA COMO HECHO. Paralegal
-- borra manualmente + setea siguiente = 3 clicks. Plus sin audit trail
-- de qué pasos se completaron históricamente.
--
-- Esta migration agrega:
--   1. Tabla case_action_history append-only (record permanente)
--   2. Immutability trigger (audit-grade — SOC II evidence)
--   3. RLS por account_id (multi-tenant safe)
--   4. RPC complete_case_action() atómico: insert history + clear current
--   5. RPC list_case_action_history() para frontend (con join staff names)
--
-- SOC II value: cada paso completado queda en audit trail visible al
-- auditor + al paralegal + al managing partner. "Demuéstrame que el
-- caso X tuvo follow-up consistente" → query directa a esta tabla.

CREATE TABLE IF NOT EXISTS public.case_action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.ner_accounts(id) ON DELETE CASCADE NOT NULL,
  case_id uuid REFERENCES public.client_cases(id) ON DELETE CASCADE NOT NULL,

  -- Quién completó
  completed_by_user_id uuid,
  completed_by_name text,

  -- Snapshot del paso completado (immutable, no se actualiza si después
  -- cambian los labels del catálogo)
  action_key text NOT NULL,
  action_label text NOT NULL,
  action_detail text,
  was_custom boolean DEFAULT false NOT NULL,
  due_date_at_completion date,

  -- Cuando se completó
  completed_at timestamptz DEFAULT now() NOT NULL,

  -- Metadata estructural del caso al momento de la completion (audit context)
  case_stage_at_completion text,
  case_status_at_completion text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_case_action_history_case_time
  ON public.case_action_history(case_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_action_history_account_user_time
  ON public.case_action_history(account_id, completed_by_user_id, completed_at DESC);

-- ════════════════════════════════════════════════════════════════
-- RLS — multi-tenant + read-only para usuarios del account
-- ════════════════════════════════════════════════════════════════

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

-- INSERT: solo via la RPC complete_case_action (que valida account_id).
-- NO permitimos INSERT directo desde frontend porque el RPC garantiza
-- consistencia (clear current next_action + insert history en TX atómica).

-- UPDATE + DELETE: bloqueados por immutability trigger (no policy alcanza).

-- ════════════════════════════════════════════════════════════════
-- Immutability trigger — append-only (SOC II CC4)
-- ════════════════════════════════════════════════════════════════
--
-- Reusamos tg_audit_logs_immutable de R9.19 — misma semántica.

DROP TRIGGER IF EXISTS trg_case_action_history_immutable_update ON public.case_action_history;
CREATE TRIGGER trg_case_action_history_immutable_update
  BEFORE UPDATE OR DELETE ON public.case_action_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_logs_immutable();

DROP TRIGGER IF EXISTS trg_case_action_history_immutable_truncate ON public.case_action_history;
CREATE TRIGGER trg_case_action_history_immutable_truncate
  BEFORE TRUNCATE ON public.case_action_history
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_audit_logs_immutable();

COMMENT ON TABLE public.case_action_history IS
  'SOC II CC4/CC7.2 + ABA 1.6: registro append-only de pasos completados '
  'en cada caso. Immutable (no UPDATE, no DELETE, no TRUNCATE). Audit '
  'trail para "demuéstrame que el caso tuvo follow-up consistente".';

-- ════════════════════════════════════════════════════════════════
-- RPC complete_case_action — atómico (insert history + clear next_action)
-- ════════════════════════════════════════════════════════════════
--
-- Frontend llama: rpc('complete_case_action', { p_case_id, p_snapshot })
-- Atómicamente:
--   1. Inserta row en case_action_history
--   2. Borra el next_action del case
--   3. Captura el stage/status al momento de la completion
--
-- Return: history_id del row insertado.

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

  -- Lookup case + verify account membership
  SELECT account_id, process_stage, status, custom_fields
  INTO v_case_record
  FROM public.client_cases
  WHERE id = p_case_id;

  IF v_case_record IS NULL THEN
    RAISE EXCEPTION 'case not found';
  END IF;

  v_account := v_case_record.account_id;

  -- Verify user belongs to this account
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = v_user AND account_id = v_account AND is_active = true
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  -- Lookup user display name
  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE user_id = v_user
  LIMIT 1;

  -- Insert into history (snapshot is the next_action that was completed)
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

  -- Clear the current next_action from the case's custom_fields
  UPDATE public.client_cases
  SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) - 'next_action',
      updated_at = now()
  WHERE id = p_case_id;

  RETURN v_history_id;
END $$;

GRANT EXECUTE ON FUNCTION public.complete_case_action(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.complete_case_action(uuid, jsonb) IS
  'Atómico: marca un Próximo Paso como completado (snapshot a history) + '
  'limpia el next_action actual del caso. Reemplaza el flow viejo de 3 '
  'clicks (Limpiar → cerrar → reabrir → setear nuevo). RLS-safe vía '
  'account_members check.';
