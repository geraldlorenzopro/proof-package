-- ═══════════════════════════════════════════════════════════════════
-- CASE TOOL OUTPUTS — Conexión entre tools NER y casos
-- ═══════════════════════════════════════════════════════════════════
--
-- Estado: PENDIENTE DE APROBACIÓN — NO APLICAR HASTA OK DE MR. LORENZO
--
-- Cuando aprobada, renombrar con timestamp 20260515HHMMSS_*.sql
-- y pedirle a Lovable que la aplique.
--
-- Propósito: persistir referencias a outputs generados por los 7 tools
-- NER (Photo Organizer, USCIS Analyzer, Affidavit Calc, CSPA, Checklist,
-- Visa Evaluator, Interview Sim) cuando el paralegal decide guardar el
-- output al expediente del caso.
--
-- Diseño additive: los tools standalone siguen funcionando como antes.
-- Solo cuando llega ?case_id=X aparece el botón "Guardar al expediente"
-- que inserta una row aquí.
--
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.case_tool_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,

  -- Tool que generó el output
  tool_slug TEXT NOT NULL CHECK (tool_slug IN (
    'affidavit',         -- Affidavit Calculator
    'evidence',          -- Photo Evidence Organizer
    'cspa',              -- CSPA Calculator
    'uscis-analyzer',    -- USCIS Document Analyzer
    'checklist',         -- Checklist Generator
    'visa-evaluator',    -- Visa Evaluator
    'interview-sim'      -- Interview Simulator
  )),
  tool_label TEXT NOT NULL,  -- "Photo Evidence Organizer", "USCIS Document Analyzer", etc.

  -- Tipo de output
  output_type TEXT NOT NULL CHECK (output_type IN (
    'pdf',         -- PDF generado (evidence packet, affidavit summary, cspa report)
    'analysis',    -- AI analysis (uscis-analyzer, visa-evaluator)
    'calculation', -- snapshot del cálculo (affidavit, cspa)
    'checklist',   -- checklist generado (checklist-generator)
    'transcript'   -- transcripción/práctica (interview-sim)
  )),

  -- Storage del output (Supabase Storage)
  storage_path TEXT,  -- ej: 'case-outputs/{case_id}/{tool}/{timestamp}.pdf'
  storage_url TEXT,   -- signed URL pública si applicable

  -- Metadata del output (varía por tool)
  -- Photo: { num_photos, sections, file_size_kb }
  -- USCIS Analyzer: { doc_type, num_points, urgency }
  -- CSPA: { cspa_age, qualifies, beneficiary_age }
  -- Affidavit: { household_size, threshold, income, qualifies }
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Quién lo generó / asignó
  generated_by UUID REFERENCES auth.users(id),
  generated_by_name TEXT,
  assigned_to UUID REFERENCES auth.users(id),

  -- Visibility (consistent con otras tablas NER)
  visibility TEXT NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'attorney_only', 'admin_only')),

  -- Notas opcionales del profesional
  notes TEXT,

  -- Timestamps
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source del invocation (para analytics)
  -- 'workspace', 'workspace-quick', 'standalone', 'features-page', etc.
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_case_tool_outputs_case ON public.case_tool_outputs(case_id);
CREATE INDEX IF NOT EXISTS idx_case_tool_outputs_account ON public.case_tool_outputs(account_id);
CREATE INDEX IF NOT EXISTS idx_case_tool_outputs_tool ON public.case_tool_outputs(tool_slug);
CREATE INDEX IF NOT EXISTS idx_case_tool_outputs_generated_at ON public.case_tool_outputs(generated_at DESC);

-- ═══ RLS — multi-tenant + role hierarchy ═══
ALTER TABLE public.case_tool_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_tool_outputs_select"
  ON public.case_tool_outputs
  FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_users
      WHERE user_id = auth.uid()
    )
    AND public.user_can_view_visibility(visibility)
  );

CREATE POLICY "case_tool_outputs_insert"
  ON public.case_tool_outputs
  FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "case_tool_outputs_update"
  ON public.case_tool_outputs
  FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id FROM public.account_users
      WHERE user_id = auth.uid()
    )
    AND public.user_can_view_visibility(visibility)
  );

CREATE POLICY "case_tool_outputs_delete"
  ON public.case_tool_outputs
  FOR DELETE
  USING (
    account_id IN (
      SELECT account_id FROM public.account_users
      WHERE user_id = auth.uid()
    )
    AND public.user_can_view_visibility(visibility)
  );

-- ═══ Updated_at trigger ═══
CREATE OR REPLACE FUNCTION public.tg_case_tool_outputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_tool_outputs_updated_at ON public.case_tool_outputs;
CREATE TRIGGER trg_case_tool_outputs_updated_at
  BEFORE UPDATE ON public.case_tool_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_case_tool_outputs_updated_at();

-- ═══ STORAGE BUCKET (Lovable lo crea via dashboard) ═══
-- Crear bucket 'case-outputs' privado en Supabase Dashboard
-- Path pattern: {case_id}/{tool_slug}/{timestamp}.{ext}
-- Policy de bucket: lectura/escritura solo para users del mismo account_id
--                   (gateado por la RLS de case_tool_outputs)
--
-- INSTRUCCIONES PARA LOVABLE:
-- 1. Crear bucket 'case-outputs' (private)
-- 2. Aplicar esta migration
-- 3. Confirmar que public.user_can_view_visibility(text) helper existe
--    (migration 20260503100000_role_visibility_hierarchical.sql)

-- ═══ Rollback plan ═══
-- DROP TABLE IF EXISTS public.case_tool_outputs CASCADE;
-- DROP FUNCTION IF EXISTS public.tg_case_tool_outputs_updated_at();
-- (storage bucket se borra manualmente desde Supabase Dashboard si rollback)
