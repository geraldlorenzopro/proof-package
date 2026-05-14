-- ═══════════════════════════════════════════════════════════════════
-- CASE TOOL OUTPUTS
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE public.case_tool_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.client_cases(id) ON DELETE CASCADE,
  client_profile_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  tool_slug text NOT NULL CHECK (tool_slug IN ('affidavit','evidence','cspa','uscis-analyzer','checklist','visa-evaluator','interview-sim')),
  output_type text NOT NULL CHECK (output_type IN ('pdf','analysis','calculation','checklist','transcript')),
  title text NOT NULL,
  storage_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'team' CHECK (visibility IN ('team','attorney_only','admin_only')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_tool_outputs_case ON public.case_tool_outputs(case_id);
CREATE INDEX idx_case_tool_outputs_client ON public.case_tool_outputs(client_profile_id);
CREATE INDEX idx_case_tool_outputs_account_tool ON public.case_tool_outputs(account_id, tool_slug);
CREATE INDEX idx_case_tool_outputs_created ON public.case_tool_outputs(created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_case_tool_outputs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_tool_outputs_updated_at
BEFORE UPDATE ON public.case_tool_outputs
FOR EACH ROW EXECUTE FUNCTION public.tg_case_tool_outputs_updated_at();

ALTER TABLE public.case_tool_outputs ENABLE ROW LEVEL SECURITY;

-- SELECT: same firm + visibility check
CREATE POLICY "case_tool_outputs_select"
ON public.case_tool_outputs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = case_tool_outputs.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
  )
  AND public.user_can_view_visibility(auth.uid(), account_id, visibility)
);

-- INSERT: same firm
CREATE POLICY "case_tool_outputs_insert"
ON public.case_tool_outputs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = case_tool_outputs.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
  )
);

-- UPDATE: same firm + visibility check
CREATE POLICY "case_tool_outputs_update"
ON public.case_tool_outputs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = case_tool_outputs.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
  )
  AND public.user_can_view_visibility(auth.uid(), account_id, visibility)
);

-- DELETE: same firm + visibility check
CREATE POLICY "case_tool_outputs_delete"
ON public.case_tool_outputs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_members.account_id = case_tool_outputs.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.is_active = true
  )
  AND public.user_can_view_visibility(auth.uid(), account_id, visibility)
);

-- ═══════════════════════════════════════════════════════════════════
-- PRIVATE BUCKET: case-outputs
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('case-outputs', 'case-outputs', false)
ON CONFLICT (id) DO NOTHING;
