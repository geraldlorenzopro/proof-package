-- ============================================================================
-- 20260510120000 — Feature Flags System
-- ============================================================================
--
-- Decisión 2026-05-10 (decisions.md): Sistema de feature flags por firma
-- para release gradual. Mr. Lorenzo (admin) activa/desactiva features
-- por firma desde /admin/features.
--
-- Estados de un feature: planned → in_dev → beta → live → deprecated
--
-- Spec completa en .ai/master/features.md
-- Roadmap: Fase 0 Foundation Infrastructure
--
-- Plan de rollback al final del archivo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Catálogo global de features
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.feature_flags (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_dev', 'beta', 'live', 'deprecated')),
  required_tier TEXT NOT NULL DEFAULT 'essential'
    CHECK (required_tier IN ('essential', 'professional', 'elite', 'enterprise')),
  default_for_new_firms BOOLEAN DEFAULT FALSE,
  category TEXT, -- 'foundation', 'pipeline', 'smart-forms', 'ghl', 'ai', etc.
  phase INTEGER, -- 0-10 según fase del roadmap
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.feature_flags IS
  'Catálogo global de features. Mr. Lorenzo gestiona desde /admin/features.';

-- ----------------------------------------------------------------------------
-- 2. Override per-account (qué firmas tienen qué features activadas)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_feature_overrides (
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  feature_slug TEXT NOT NULL REFERENCES public.feature_flags(slug) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  enabled_by UUID, -- user_id que cambió el flag
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT, -- razón del override (ej: "piloto Mr Visa")
  PRIMARY KEY (account_id, feature_slug)
);

COMMENT ON TABLE public.account_feature_overrides IS
  'Override por firma. Si el flag es status=beta, solo firmas con override=true lo ven.';

CREATE INDEX IF NOT EXISTS idx_account_features_lookup
  ON public.account_feature_overrides (account_id, feature_slug, enabled);

-- ----------------------------------------------------------------------------
-- 3. Helper function: ¿una firma tiene un feature activo?
-- ----------------------------------------------------------------------------
-- Lógica:
--   - Si feature.status = 'live' → todas las firmas tienen acceso
--   - Si feature.status = 'beta' → solo firmas con override.enabled=true
--   - Si feature.status = 'in_dev' → ninguna firma (ignore overrides)
--   - Si feature.status = 'deprecated' → ninguna firma (ignore overrides)
--   - Si feature.status = 'planned' → ninguna firma
--
-- Override solo aplica en estado 'beta'. En 'live' todas tienen, en
-- 'in_dev/deprecated/planned' nadie tiene (independiente del override).

CREATE OR REPLACE FUNCTION public.account_has_feature(
  p_account_id UUID,
  p_feature_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_enabled BOOLEAN;
BEGIN
  -- SECURITY FIX 2026-05-10 (audit hallazgo low #3):
  -- tenancy check — el caller debe ser miembro del account O platform_admin.
  -- Sin esto, cualquier authenticated user podía leer feature flags de
  -- cualquier firma (cross-tenant info leak de beta features).
  IF NOT EXISTS (
    SELECT 1 FROM account_members
    WHERE user_id = auth.uid() AND account_id = p_account_id
  ) AND NOT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT status INTO v_status FROM feature_flags WHERE slug = p_feature_slug;

  IF v_status IS NULL THEN RETURN FALSE; END IF;

  -- Status global wins for live/in_dev/deprecated/planned
  IF v_status = 'live' THEN RETURN TRUE; END IF;
  IF v_status IN ('in_dev', 'deprecated', 'planned') THEN RETURN FALSE; END IF;

  -- Status 'beta' → check override
  IF v_status = 'beta' THEN
    SELECT enabled INTO v_enabled
    FROM account_feature_overrides
    WHERE account_id = p_account_id AND feature_slug = p_feature_slug;
    RETURN COALESCE(v_enabled, FALSE);
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.account_has_feature IS
  'Retorna TRUE si la firma tiene acceso al feature dado su status global y override.';

-- ----------------------------------------------------------------------------
-- 4. RLS policies (solo platform_admins gestionan; todos lectura pública)
-- ----------------------------------------------------------------------------

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_feature_overrides ENABLE ROW LEVEL SECURITY;

-- feature_flags: lectura pública (cualquier user logueado puede leer status)
CREATE POLICY "Authenticated can read feature flags"
ON public.feature_flags FOR SELECT TO authenticated
USING (true);

-- feature_flags: solo platform_admins escriben
CREATE POLICY "Platform admins manage feature flags"
ON public.feature_flags FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid()
  )
);

-- account_feature_overrides: lectura para miembros de la account
CREATE POLICY "Account members read own feature overrides"
ON public.account_feature_overrides FOR SELECT TO authenticated
USING (
  account_id IN (
    SELECT account_id FROM account_members WHERE user_id = auth.uid()
  )
);

-- account_feature_overrides: solo platform_admins escriben
CREATE POLICY "Platform admins manage feature overrides"
ON public.account_feature_overrides FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 5. Seed inicial: 45 features del catálogo (alineados con features.md)
-- ----------------------------------------------------------------------------
-- Status inicial: 'planned' para los nuevos, 'live' para los que ya existen.

INSERT INTO public.feature_flags (slug, name, description, status, required_tier, phase, category) VALUES
  -- Foundation (Fase 0)
  ('feature-flags-system',     'Sistema de Feature Flags',         'Self-referential. La meta-feature.',                    'live',     'essential',    0, 'foundation'),
  ('visibility-hierarchical',  'Hierarchical Visibility',          'Modelo de roles paralegal/attorney por contenido.',     'planned',  'essential',    0, 'foundation'),
  ('admin-features-ui',        'Admin Features UI',                'Página /admin/features para gestionar flags.',          'planned',  'essential',    0, 'foundation'),

  -- Pipeline Dashboard (Fase 1)
  ('pipeline-dashboard',       'Pipeline Dashboard',               'Dashboard estilo Monday vertical inmigración.',         'planned',  'essential',    1, 'pipeline'),
  ('pipeline-kanban-view',     'Pipeline Kanban',                  'Vista Kanban con drag-drop entre agencias.',            'planned',  'professional', 1, 'pipeline'),
  ('pipeline-bulk-actions',    'Pipeline Bulk Actions',            'Selección múltiple + acciones masivas.',                'planned',  'professional', 1, 'pipeline'),
  ('pipeline-time-in-stage',   'Time in Stage Tracking',           'Alert visual de casos estancados.',                     'planned',  'essential',    1, 'pipeline'),
  ('pipeline-smart-filters',   'Pipeline Smart Filters',           'Filtros guardados (Mis urgentes, etc.).',               'planned',  'professional', 1, 'pipeline'),

  -- Smart Forms (Fase 2 + 3)
  ('smart-forms-i765',         'Smart Form I-765',                 'EAD - permiso de trabajo.',                             'live',     'essential',    2, 'smart-forms'),
  ('smart-forms-felix-autofill','Felix Auto-fill UI',              'Botón "Auto-fill con IA" en wizard.',                   'planned',  'professional', 2, 'smart-forms'),
  ('smart-forms-i130',         'Smart Form I-130',                 'Petición familiar.',                                    'planned',  'professional', 2, 'smart-forms'),
  ('smart-forms-i485',         'Smart Form I-485',                 'Adjustment of status.',                                 'planned',  'professional', 2, 'smart-forms'),
  ('smart-forms-n400',         'Smart Form N-400',                 'Naturalización.',                                       'planned',  'professional', 2, 'smart-forms'),
  ('smart-forms-ds260',        'Smart Form DS-260',                'NVC consular.',                                         'planned',  'professional', 2, 'smart-forms'),
  ('smart-forms-i589',         'Smart Form I-589',                 'Asilo.',                                                'planned',  'professional', 3, 'smart-forms'),
  ('smart-forms-eoir-26',      'Smart Form EOIR-26',               'Motion to reopen (corte).',                             'planned',  'elite',        3, 'smart-forms'),
  ('smart-forms-eoir-28',      'Smart Form EOIR-28',               'Notice of entry.',                                      'planned',  'elite',        3, 'smart-forms'),
  ('smart-forms-i352',         'Smart Form I-352',                 'Defensa ICE.',                                          'planned',  'elite',        3, 'smart-forms'),
  ('smart-forms-i130a',        'Smart Form I-130A',                'Spouse beneficiary.',                                   'planned',  'professional', 3, 'smart-forms'),
  ('smart-forms-i864',         'Smart Form I-864',                 'Affidavit of support.',                                 'planned',  'professional', 3, 'smart-forms'),
  ('smart-forms-i693',         'Smart Form I-693',                 'Medical exam.',                                         'planned',  'professional', 3, 'smart-forms'),
  ('smart-forms-share-token',  'Share Form Public Token',          'Cliente review/firma público.',                         'planned',  'professional', 2, 'smart-forms'),

  -- GHL Auto-Billing (Fase 4)
  ('ghl-auto-billing',         'GHL Auto-Billing Flow',            'Contract→firma→invoice→pago automático.',               'planned',  'professional', 4, 'ghl'),
  ('ghl-fee-schedule',         'Fee Schedule per Firm',            'Tabla de fees por tipo de caso.',                       'planned',  'professional', 4, 'ghl'),
  ('ghl-templates-setup-wizard','GHL Templates Setup Wizard',      'Wizard onboarding GHL templates.',                      'planned',  'professional', 4, 'ghl'),
  ('ghl-cbp-i94-lookup',       'CBP I-94 Lookup',                  'I-94 lookup automático.',                               'planned',  'elite',        4, 'ghl'),

  -- Vertical Depth (Fase 5)
  ('family-relational-tree',   'Family Relational Tree',           'Modelo familiar petitioner/beneficiary.',               'planned',  'professional', 5, 'vertical'),
  ('i797-receipt-parser',      'USCIS I-797 Parser',               'OCR auto-extract de I-797.',                            'planned',  'professional', 5, 'vertical'),
  ('court-system-tracker',     'Court System Tracker',             'Audiencias EOIR + dockets.',                            'planned',  'elite',        5, 'vertical'),
  ('evidence-packet-builder',  'Evidence Packet Builder',          'Armar packet PDF USCIS-ready.',                         'planned',  'professional', 5, 'vertical'),
  ('rfe-response-workflow',    'RFE Response Workflow',            'Sub-flow para responder RFE.',                          'planned',  'professional', 5, 'vertical'),
  ('recursos-visa-bulletin-contextual','Visa Bulletin Contextual','Bulletin contextual a clientes.',                       'planned',  'essential',    5, 'vertical'),

  -- OCR + Translation (Fase 6)
  ('ocr-translation',          'OCR + Translation',                'OCR + traducción Claude Vision.',                       'planned',  'professional', 6, 'ocr'),
  ('ocr-translation-certified','Certified Translation Template',   'Auto-generate USCIS certificate.',                      'planned',  'professional', 6, 'ocr'),
  ('ocr-multilang',            'Multi-language OCR',               'Soporte PT/HT/EN además ES.',                           'planned',  'elite',        6, 'ocr'),
  ('ocr-rfe-parser',           'RFE OCR Parser',                   'OCR de RFE recibidos USCIS.',                           'planned',  'professional', 6, 'ocr'),

  -- Accounting (Fase 7)
  ('accounting-module',        'Accounting Module',                'P&L + gastos + reports.',                               'planned',  'professional', 7, 'accounting'),
  ('accounting-export-csv',    'Accounting Export CSV',            'Export QB/FreshBooks compatible.',                      'planned',  'professional', 7, 'accounting'),
  ('accounting-yearend-summary','Year-end Summary PDF',            'PDF para CPA.',                                         'planned',  'elite',        7, 'accounting'),
  ('accounting-revenue-by-case-type','Revenue by Case Type',       'Análisis qué tipo de caso es rentable.',                'planned',  'professional', 7, 'accounting'),

  -- AI Specialists (Fase 8)
  ('ai-camila-master',         'Camila — Coordinadora AI',         'Coordinadora chat + voz.',                              'live',     'essential',    8, 'ai'),
  ('ai-felix-forms',           'Felix — Forms Specialist',         'Llenado de formularios.',                               'live',     'professional', 8, 'ai'),
  ('ai-nina-packets',          'Nina — Packets Specialist',        'Ensamble de paquetes.',                                 'live',     'professional', 8, 'ai'),
  ('ai-max-qa',                'Max — QA Specialist',              'QA del paquete.',                                       'live',     'professional', 8, 'ai'),
  ('ai-elena-i485',            'Elena — I-485 Specialist',         'Especialista Adjustment.',                              'planned',  'elite',        8, 'ai'),
  ('ai-sofia-humanitarian',    'Sofía — Humanitarian Specialist',  'VAWA/U/T/Asylum.',                                      'planned',  'elite',        8, 'ai'),
  ('ai-carmen-consular',       'Carmen — Consular Specialist',     'NVC/B1B2/Embajada.',                                    'planned',  'elite',        8, 'ai'),
  ('ai-leo-rfe',               'Leo — RFE Strategist',             'RFE/NOID strategist.',                                  'planned',  'elite',        8, 'ai'),
  ('ai-beto-cspa',             'Beto — CSPA Specialist',           'CSPA/Visa Bulletin.',                                   'planned',  'professional', 8, 'ai'),
  ('ai-marco-naturalization',  'Marco — N-400 Specialist',         'N-400 specialist.',                                     'planned',  'elite',        8, 'ai'),
  ('ai-approval-score',        'Approval Score Engine',            'Score pre-contrato.',                                   'planned',  'elite',        8, 'ai'),
  ('ai-knowledge-base-legal',  'Knowledge Base Legal',             'INA + 8 CFR + Policy Manual.',                          'planned',  'elite',        8, 'ai'),

  -- Scale (Fase 9)
  ('self-service-onboarding',  'Self-Service Onboarding',          'Wizard firma nueva auto-onboarding.',                   'planned',  'essential',    9, 'scale'),
  ('billing-automation',       'Billing Automation',               'Upgrade/downgrade desde UI.',                           'planned',  'essential',    9, 'scale'),
  ('admin-analytics',          'Admin Analytics',                  'Churn risk + usage analytics.',                         'planned',  'essential',    9, 'scale'),
  ('enterprise-tier-package',  'Enterprise Tier Package',          'Agency services bundle.',                               'planned',  'enterprise',   9, 'scale'),
  ('multi-language-en',        'Multi-language EN',                'Mercado USA non-hispano.',                              'planned',  'essential',    9, 'scale'),

  -- Postponed (Fase 10)
  ('quickbooks-integration',   'QuickBooks Integration',           'QB API sync (cuando se pida).',                         'planned',  'elite',        10, 'integrations')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- ROLLBACK PLAN (si algo sale mal post-deploy)
-- ============================================================================
--
-- Si esta migration causa problemas:
--
-- 1. Drop new tables (no hay datos perdidos porque es feature gate puro):
--    DROP TABLE IF EXISTS public.account_feature_overrides;
--    DROP TABLE IF EXISTS public.feature_flags;
--    DROP FUNCTION IF EXISTS public.account_has_feature;
--
-- 2. Tiempo: <1 min
--
-- 3. Sin pérdida de datos: las tablas son nuevas, no afectan tablas existentes.
--
-- 4. Frontend con <FeatureFlag> hace fallback graceful (asume feature disabled).
--
-- ============================================================================
