-- ============================================================================
-- 20260503100000 — Hierarchical Role Visibility
-- ============================================================================
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'attorney';
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'paralegal';
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'assistant';
ALTER TYPE public.account_role ADD VALUE IF NOT EXISTS 'readonly';

CREATE OR REPLACE FUNCTION public.get_user_role_in_account(p_user_id UUID, p_account_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role::TEXT FROM account_members WHERE user_id = p_user_id AND account_id = p_account_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_visibility(p_user_id UUID, p_account_id UUID, p_visibility TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_visibility IS NULL OR p_visibility = 'team' THEN TRUE
    WHEN p_visibility = 'attorney_only' THEN get_user_role_in_account(p_user_id, p_account_id) IN ('owner', 'admin', 'attorney')
    WHEN p_visibility = 'admin_only' THEN get_user_role_in_account(p_user_id, p_account_id) IN ('owner', 'admin')
    ELSE FALSE
  END
$$;

CREATE OR REPLACE FUNCTION public.user_can_assign_visibility(p_user_id UUID, p_account_id UUID, p_visibility TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_visibility IS NULL OR p_visibility = 'team' THEN TRUE
    WHEN p_visibility = 'attorney_only' THEN get_user_role_in_account(p_user_id, p_account_id) IN ('owner', 'admin', 'attorney')
    WHEN p_visibility = 'admin_only' THEN get_user_role_in_account(p_user_id, p_account_id) IN ('owner', 'admin')
    ELSE FALSE
  END
$$;

ALTER TABLE public.case_notes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));
ALTER TABLE public.case_documents ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));
ALTER TABLE public.ai_agent_sessions ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));
ALTER TABLE public.case_tasks ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'attorney_only', 'admin_only'));

UPDATE public.case_notes SET visibility = 'team' WHERE visibility IS NULL;
UPDATE public.case_documents SET visibility = 'team' WHERE visibility IS NULL;
UPDATE public.ai_agent_sessions SET visibility = 'team' WHERE visibility IS NULL;
UPDATE public.case_tasks SET visibility = 'team' WHERE visibility IS NULL;

DROP POLICY IF EXISTS "Account members can view notes" ON public.case_notes;
DROP POLICY IF EXISTS "Account members can insert notes" ON public.case_notes;
DROP POLICY IF EXISTS "Authors can update own notes" ON public.case_notes;
DROP POLICY IF EXISTS "Account members view notes by visibility" ON public.case_notes;
DROP POLICY IF EXISTS "Account members insert notes within their assignable visibility" ON public.case_notes;
DROP POLICY IF EXISTS "Authors update own notes within visibility" ON public.case_notes;

CREATE POLICY "Account members view notes by visibility" ON public.case_notes FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Account members insert notes within their assignable visibility" ON public.case_notes FOR INSERT TO authenticated
WITH CHECK (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND author_id = auth.uid() AND user_can_assign_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Authors update own notes within visibility" ON public.case_notes FOR UPDATE TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND author_id = auth.uid() AND user_can_view_visibility(auth.uid(), account_id, visibility))
WITH CHECK (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND author_id = auth.uid() AND user_can_assign_visibility(auth.uid(), account_id, visibility));

DROP POLICY IF EXISTS "Account members can view case documents" ON public.case_documents;
DROP POLICY IF EXISTS "Account members can insert case documents" ON public.case_documents;
DROP POLICY IF EXISTS "Account members can delete case documents" ON public.case_documents;
DROP POLICY IF EXISTS "Account members view documents by visibility" ON public.case_documents;
DROP POLICY IF EXISTS "Account members insert documents within visibility" ON public.case_documents;
DROP POLICY IF EXISTS "Account members delete documents within visibility" ON public.case_documents;

CREATE POLICY "Account members view documents by visibility" ON public.case_documents FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Account members insert documents within visibility" ON public.case_documents FOR INSERT TO authenticated
WITH CHECK (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_assign_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Account members delete documents within visibility" ON public.case_documents FOR DELETE TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility));

DROP POLICY IF EXISTS "Team can manage sessions" ON public.ai_agent_sessions;
DROP POLICY IF EXISTS "Team insert sessions within visibility" ON public.ai_agent_sessions;
DROP POLICY IF EXISTS "Team update sessions within visibility" ON public.ai_agent_sessions;
DROP POLICY IF EXISTS "Team delete sessions within visibility" ON public.ai_agent_sessions;
DROP POLICY IF EXISTS "Team view sessions by visibility" ON public.ai_agent_sessions;

CREATE POLICY "Team insert sessions within visibility" ON public.ai_agent_sessions FOR INSERT TO authenticated
WITH CHECK (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_assign_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Team update sessions within visibility" ON public.ai_agent_sessions FOR UPDATE TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility))
WITH CHECK (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_assign_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Team delete sessions within visibility" ON public.ai_agent_sessions FOR DELETE TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Team view sessions by visibility" ON public.ai_agent_sessions FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility));

DROP POLICY IF EXISTS "Account members can view tasks" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members can insert tasks" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members can update tasks" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members can delete tasks" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members view tasks by visibility" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members insert tasks within visibility" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members update tasks within visibility" ON public.case_tasks;
DROP POLICY IF EXISTS "Account members delete tasks within visibility" ON public.case_tasks;

CREATE POLICY "Account members view tasks by visibility" ON public.case_tasks FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Account members insert tasks within visibility" ON public.case_tasks FOR INSERT TO authenticated
WITH CHECK (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_assign_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Account members update tasks within visibility" ON public.case_tasks FOR UPDATE TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility))
WITH CHECK (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_assign_visibility(auth.uid(), account_id, visibility));

CREATE POLICY "Account members delete tasks within visibility" ON public.case_tasks FOR DELETE TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()) AND user_can_view_visibility(auth.uid(), account_id, visibility));

CREATE INDEX IF NOT EXISTS idx_case_notes_visibility ON public.case_notes (account_id, visibility);
CREATE INDEX IF NOT EXISTS idx_case_documents_visibility ON public.case_documents (account_id, visibility);
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_visibility ON public.ai_agent_sessions (account_id, visibility);
CREATE INDEX IF NOT EXISTS idx_case_tasks_visibility ON public.case_tasks (account_id, visibility);

-- ============================================================================
-- 20260510120000 — Feature Flags System
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_dev', 'beta', 'live', 'deprecated')),
  required_tier TEXT NOT NULL DEFAULT 'essential' CHECK (required_tier IN ('essential', 'professional', 'elite', 'enterprise')),
  default_for_new_firms BOOLEAN DEFAULT FALSE,
  category TEXT,
  phase INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_feature_overrides (
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  feature_slug TEXT NOT NULL REFERENCES public.feature_flags(slug) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  enabled_by UUID,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  PRIMARY KEY (account_id, feature_slug)
);

CREATE INDEX IF NOT EXISTS idx_account_features_lookup ON public.account_feature_overrides (account_id, feature_slug, enabled);

CREATE OR REPLACE FUNCTION public.account_has_feature(p_account_id UUID, p_feature_slug TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_status TEXT; v_enabled BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM account_members WHERE user_id = auth.uid() AND account_id = p_account_id)
     AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()) THEN
    RETURN FALSE;
  END IF;
  SELECT status INTO v_status FROM feature_flags WHERE slug = p_feature_slug;
  IF v_status IS NULL THEN RETURN FALSE; END IF;
  IF v_status = 'live' THEN RETURN TRUE; END IF;
  IF v_status IN ('in_dev', 'deprecated', 'planned') THEN RETURN FALSE; END IF;
  IF v_status = 'beta' THEN
    SELECT enabled INTO v_enabled FROM account_feature_overrides WHERE account_id = p_account_id AND feature_slug = p_feature_slug;
    RETURN COALESCE(v_enabled, FALSE);
  END IF;
  RETURN FALSE;
END;
$$;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_feature_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read feature flags" ON public.feature_flags;
DROP POLICY IF EXISTS "Platform admins manage feature flags" ON public.feature_flags;
DROP POLICY IF EXISTS "Account members read own feature overrides" ON public.account_feature_overrides;
DROP POLICY IF EXISTS "Platform admins manage feature overrides" ON public.account_feature_overrides;

CREATE POLICY "Authenticated can read feature flags" ON public.feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage feature flags" ON public.feature_flags FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()));
CREATE POLICY "Account members read own feature overrides" ON public.account_feature_overrides FOR SELECT TO authenticated
USING (account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid()));
CREATE POLICY "Platform admins manage feature overrides" ON public.account_feature_overrides FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()));

INSERT INTO public.feature_flags (slug, name, description, status, required_tier, phase, category) VALUES
  ('feature-flags-system', 'Sistema de Feature Flags', 'Self-referential. La meta-feature.', 'live', 'essential', 0, 'foundation'),
  ('visibility-hierarchical', 'Hierarchical Visibility', 'Modelo de roles paralegal/attorney por contenido.', 'planned', 'essential', 0, 'foundation'),
  ('admin-features-ui', 'Admin Features UI', 'Página /admin/features para gestionar flags.', 'planned', 'essential', 0, 'foundation'),
  ('pipeline-dashboard', 'Pipeline Dashboard', 'Dashboard estilo Monday vertical inmigración.', 'planned', 'essential', 1, 'pipeline'),
  ('pipeline-kanban-view', 'Pipeline Kanban', 'Vista Kanban con drag-drop entre agencias.', 'planned', 'professional', 1, 'pipeline'),
  ('pipeline-bulk-actions', 'Pipeline Bulk Actions', 'Selección múltiple + acciones masivas.', 'planned', 'professional', 1, 'pipeline'),
  ('pipeline-time-in-stage', 'Time in Stage Tracking', 'Alert visual de casos estancados.', 'planned', 'essential', 1, 'pipeline'),
  ('pipeline-smart-filters', 'Pipeline Smart Filters', 'Filtros guardados.', 'planned', 'professional', 1, 'pipeline'),
  ('smart-forms-i765', 'Smart Form I-765', 'EAD - permiso de trabajo.', 'live', 'essential', 2, 'smart-forms'),
  ('smart-forms-felix-autofill', 'Felix Auto-fill UI', 'Botón Auto-fill con IA en wizard.', 'planned', 'professional', 2, 'smart-forms'),
  ('smart-forms-i130', 'Smart Form I-130', 'Petición familiar.', 'planned', 'professional', 2, 'smart-forms'),
  ('smart-forms-i485', 'Smart Form I-485', 'Adjustment of status.', 'planned', 'professional', 2, 'smart-forms'),
  ('smart-forms-n400', 'Smart Form N-400', 'Naturalización.', 'planned', 'professional', 2, 'smart-forms'),
  ('smart-forms-ds260', 'Smart Form DS-260', 'NVC consular.', 'planned', 'professional', 2, 'smart-forms'),
  ('smart-forms-i589', 'Smart Form I-589', 'Asilo.', 'planned', 'professional', 3, 'smart-forms'),
  ('smart-forms-eoir-26', 'Smart Form EOIR-26', 'Motion to reopen.', 'planned', 'elite', 3, 'smart-forms'),
  ('smart-forms-eoir-28', 'Smart Form EOIR-28', 'Notice of entry.', 'planned', 'elite', 3, 'smart-forms'),
  ('smart-forms-i352', 'Smart Form I-352', 'Defensa ICE.', 'planned', 'elite', 3, 'smart-forms'),
  ('smart-forms-i130a', 'Smart Form I-130A', 'Spouse beneficiary.', 'planned', 'professional', 3, 'smart-forms'),
  ('smart-forms-i864', 'Smart Form I-864', 'Affidavit of support.', 'planned', 'professional', 3, 'smart-forms'),
  ('smart-forms-i693', 'Smart Form I-693', 'Medical exam.', 'planned', 'professional', 3, 'smart-forms'),
  ('smart-forms-share-token', 'Share Form Public Token', 'Cliente review/firma público.', 'planned', 'professional', 2, 'smart-forms'),
  ('ghl-auto-billing', 'GHL Auto-Billing Flow', 'Contract→firma→invoice→pago automático.', 'planned', 'professional', 4, 'ghl'),
  ('ghl-fee-schedule', 'Fee Schedule per Firm', 'Tabla de fees por tipo de caso.', 'planned', 'professional', 4, 'ghl'),
  ('ghl-templates-setup-wizard', 'GHL Templates Setup Wizard', 'Wizard onboarding GHL templates.', 'planned', 'professional', 4, 'ghl'),
  ('ghl-cbp-i94-lookup', 'CBP I-94 Lookup', 'I-94 lookup automático.', 'planned', 'elite', 4, 'ghl'),
  ('family-relational-tree', 'Family Relational Tree', 'Modelo familiar petitioner/beneficiary.', 'planned', 'professional', 5, 'vertical'),
  ('i797-receipt-parser', 'USCIS I-797 Parser', 'OCR auto-extract de I-797.', 'planned', 'professional', 5, 'vertical'),
  ('court-system-tracker', 'Court System Tracker', 'Audiencias EOIR + dockets.', 'planned', 'elite', 5, 'vertical'),
  ('evidence-packet-builder', 'Evidence Packet Builder', 'Armar packet PDF USCIS-ready.', 'planned', 'professional', 5, 'vertical'),
  ('rfe-response-workflow', 'RFE Response Workflow', 'Sub-flow para responder RFE.', 'planned', 'professional', 5, 'vertical'),
  ('recursos-visa-bulletin-contextual', 'Visa Bulletin Contextual', 'Bulletin contextual a clientes.', 'planned', 'essential', 5, 'vertical'),
  ('ocr-translation', 'OCR + Translation', 'OCR + traducción Claude Vision.', 'planned', 'professional', 6, 'ocr'),
  ('ocr-translation-certified', 'Certified Translation Template', 'Auto-generate USCIS certificate.', 'planned', 'professional', 6, 'ocr'),
  ('ocr-multilang', 'Multi-language OCR', 'Soporte PT/HT/EN además ES.', 'planned', 'elite', 6, 'ocr'),
  ('ocr-rfe-parser', 'RFE OCR Parser', 'OCR de RFE recibidos USCIS.', 'planned', 'professional', 6, 'ocr'),
  ('accounting-module', 'Accounting Module', 'P&L + gastos + reports.', 'planned', 'professional', 7, 'accounting'),
  ('accounting-export-csv', 'Accounting Export CSV', 'Export QB/FreshBooks compatible.', 'planned', 'professional', 7, 'accounting'),
  ('accounting-yearend-summary', 'Year-end Summary PDF', 'PDF para CPA.', 'planned', 'elite', 7, 'accounting'),
  ('accounting-revenue-by-case-type', 'Revenue by Case Type', 'Análisis qué tipo de caso es rentable.', 'planned', 'professional', 7, 'accounting'),
  ('ai-camila-master', 'Camila — Coordinadora AI', 'Coordinadora chat + voz.', 'live', 'essential', 8, 'ai'),
  ('ai-felix-forms', 'Felix — Forms Specialist', 'Llenado de formularios.', 'live', 'professional', 8, 'ai'),
  ('ai-nina-packets', 'Nina — Packets Specialist', 'Ensamble de paquetes.', 'live', 'professional', 8, 'ai'),
  ('ai-max-qa', 'Max — QA Specialist', 'QA del paquete.', 'live', 'professional', 8, 'ai'),
  ('ai-elena-i485', 'Elena — I-485 Specialist', 'Especialista Adjustment.', 'planned', 'elite', 8, 'ai'),
  ('ai-sofia-humanitarian', 'Sofía — Humanitarian Specialist', 'VAWA/U/T/Asylum.', 'planned', 'elite', 8, 'ai'),
  ('ai-carmen-consular', 'Carmen — Consular Specialist', 'NVC/B1B2/Embajada.', 'planned', 'elite', 8, 'ai'),
  ('ai-leo-rfe', 'Leo — RFE Strategist', 'RFE/NOID strategist.', 'planned', 'elite', 8, 'ai'),
  ('ai-beto-cspa', 'Beto — CSPA Specialist', 'CSPA/Visa Bulletin.', 'planned', 'professional', 8, 'ai'),
  ('ai-marco-naturalization', 'Marco — N-400 Specialist', 'N-400 specialist.', 'planned', 'elite', 8, 'ai'),
  ('ai-approval-score', 'Approval Score Engine', 'Score pre-contrato.', 'planned', 'elite', 8, 'ai'),
  ('ai-knowledge-base-legal', 'Knowledge Base Legal', 'INA + 8 CFR + Policy Manual.', 'planned', 'elite', 8, 'ai'),
  ('self-service-onboarding', 'Self-Service Onboarding', 'Wizard firma nueva auto-onboarding.', 'planned', 'essential', 9, 'scale'),
  ('billing-automation', 'Billing Automation', 'Upgrade/downgrade desde UI.', 'planned', 'essential', 9, 'scale'),
  ('admin-analytics', 'Admin Analytics', 'Churn risk + usage analytics.', 'planned', 'essential', 9, 'scale'),
  ('enterprise-tier-package', 'Enterprise Tier Package', 'Agency services bundle.', 'planned', 'enterprise', 9, 'scale'),
  ('multi-language-en', 'Multi-language EN', 'Mercado USA non-hispano.', 'planned', 'essential', 9, 'scale'),
  ('quickbooks-integration', 'QuickBooks Integration', 'QB API sync.', 'planned', 'elite', 10, 'integrations')
ON CONFLICT (slug) DO NOTHING;