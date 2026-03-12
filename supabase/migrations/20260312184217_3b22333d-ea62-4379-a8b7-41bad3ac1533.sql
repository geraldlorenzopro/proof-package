
-- =============================================
-- FASE 1: Case Engine — Schema Changes
-- =============================================

-- 1. Add new columns to client_cases
ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'caso-no-iniciado',
  ADD COLUMN IF NOT EXISTS process_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ball_in_court text DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

-- 2. pipeline_templates — defines stages per process type
CREATE TABLE public.pipeline_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  process_type text NOT NULL,
  process_label text NOT NULL,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System templates visible to all authenticated"
  ON public.pipeline_templates FOR SELECT TO authenticated
  USING (is_system = true);

CREATE POLICY "Account templates visible to members"
  ON public.pipeline_templates FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Admins can manage account templates"
  ON public.pipeline_templates FOR ALL TO authenticated
  USING (account_id = user_account_id(auth.uid()) AND (
    has_account_role_in(auth.uid(), 'owner'::account_role, account_id) OR
    has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
  ));

CREATE POLICY "Service role manages templates"
  ON public.pipeline_templates FOR ALL TO public
  USING (auth.role() = 'service_role'::text);

-- 3. case_stage_history — tracks transitions
CREATE TABLE public.case_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_by uuid NOT NULL,
  changed_by_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view stage history"
  ON public.case_stage_history FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert stage history"
  ON public.case_stage_history FOR INSERT TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()) AND changed_by = auth.uid());

-- 4. case_tags — system control signals
CREATE TABLE public.case_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  tag text NOT NULL,
  added_by uuid NOT NULL,
  added_by_name text,
  removed_at timestamptz,
  removed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view tags"
  ON public.case_tags FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert tags"
  ON public.case_tags FOR INSERT TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()) AND added_by = auth.uid());

CREATE POLICY "Account members can update tags"
  ON public.case_tags FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- 5. case_notes — human milestones (NOT technical logs)
CREATE TABLE public.case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text,
  content text NOT NULL,
  note_type text NOT NULL DEFAULT 'milestone',
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view notes"
  ON public.case_notes FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert notes"
  ON public.case_notes FOR INSERT TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()) AND author_id = auth.uid());

CREATE POLICY "Authors can update own notes"
  ON public.case_notes FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()) AND author_id = auth.uid());

-- 6. case_tasks — assignable human actions
CREATE TABLE public.case_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  assigned_to uuid,
  assigned_to_name text,
  created_by uuid NOT NULL,
  created_by_name text,
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view tasks"
  ON public.case_tasks FOR SELECT TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert tasks"
  ON public.case_tasks FOR INSERT TO authenticated
  WITH CHECK (account_id = user_account_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Account members can update tasks"
  ON public.case_tasks FOR UPDATE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can delete tasks"
  ON public.case_tasks FOR DELETE TO authenticated
  USING (account_id = user_account_id(auth.uid()));

-- 7. Indexes for performance
CREATE INDEX idx_case_stage_history_case ON public.case_stage_history(case_id);
CREATE INDEX idx_case_tags_case ON public.case_tags(case_id);
CREATE INDEX idx_case_tags_tag ON public.case_tags(tag);
CREATE INDEX idx_case_notes_case ON public.case_notes(case_id);
CREATE INDEX idx_case_tasks_case ON public.case_tasks(case_id);
CREATE INDEX idx_case_tasks_assigned ON public.case_tasks(assigned_to);
CREATE INDEX idx_case_tasks_status ON public.case_tasks(status);
CREATE INDEX idx_client_cases_pipeline ON public.client_cases(pipeline_stage);
CREATE INDEX idx_client_cases_process ON public.client_cases(process_type);
CREATE INDEX idx_client_cases_ball ON public.client_cases(ball_in_court);
CREATE INDEX idx_pipeline_templates_type ON public.pipeline_templates(process_type);
