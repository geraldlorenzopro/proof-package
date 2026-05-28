-- ============================================================
-- Smart Processes: templates de combinaciones de formularios USCIS
-- ============================================================

CREATE TABLE public.smart_process_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NULL, -- NULL = global NER template
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT '📋',
  color TEXT NOT NULL DEFAULT 'blue',
  case_type TEXT, -- maps to client_cases.case_type for the parent case
  forms_included JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- forms_included shape: [{ form_type: 'I-130', required: true, sort_order: 1 }, ...]
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants (Data API access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_process_templates TO authenticated;
GRANT ALL ON public.smart_process_templates TO service_role;

-- RLS
ALTER TABLE public.smart_process_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: global templates (account_id IS NULL) OR own account templates
CREATE POLICY "View global and own account templates"
  ON public.smart_process_templates FOR SELECT
  TO authenticated
  USING (
    account_id IS NULL
    OR account_id = user_account_id(auth.uid())
  );

-- INSERT: only owner/admin of own account
CREATE POLICY "Owners and admins can create templates"
  ON public.smart_process_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = user_account_id(auth.uid())
    AND (
      has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
      OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    )
  );

-- UPDATE: only owner/admin of own account (cannot touch global templates)
CREATE POLICY "Owners and admins can update own templates"
  ON public.smart_process_templates FOR UPDATE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND account_id = user_account_id(auth.uid())
    AND (
      has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
      OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    )
  );

-- DELETE: only owner/admin of own account
CREATE POLICY "Owners and admins can delete own templates"
  ON public.smart_process_templates FOR DELETE
  TO authenticated
  USING (
    account_id IS NOT NULL
    AND account_id = user_account_id(auth.uid())
    AND (
      has_account_role_in(auth.uid(), 'owner'::account_role, account_id)
      OR has_account_role_in(auth.uid(), 'admin'::account_role, account_id)
    )
  );

-- Platform admins manage global templates
CREATE POLICY "Platform admins manage global templates"
  ON public.smart_process_templates FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Updated_at trigger
CREATE TRIGGER update_smart_process_templates_updated_at
  BEFORE UPDATE ON public.smart_process_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_smart_process_templates_account
  ON public.smart_process_templates(account_id) WHERE is_active = true;
CREATE INDEX idx_smart_process_templates_global
  ON public.smart_process_templates(sort_order)
  WHERE account_id IS NULL AND is_active = true;

-- ============================================================
-- Seed 10 global NER templates (account_id = NULL)
-- ============================================================

INSERT INTO public.smart_process_templates
  (account_id, name, description, icon, color, case_type, forms_included, sort_order)
VALUES
  (NULL, 'Ajuste de Estatus Familiar',
   'Residencia desde EE.UU. por familiar petitioner',
   '👨‍👩‍👧', 'emerald', 'I-485',
   '[
     {"form_type":"I-130","required":true,"sort_order":1},
     {"form_type":"I-485","required":true,"sort_order":2},
     {"form_type":"I-765","required":true,"sort_order":3},
     {"form_type":"I-131","required":true,"sort_order":4},
     {"form_type":"I-864","required":true,"sort_order":5},
     {"form_type":"G-28","required":true,"sort_order":6}
   ]'::jsonb, 1),

  (NULL, 'Ajuste de Estatus Empleo',
   'Residencia por empleador (EB-1/2/3) desde EE.UU.',
   '💼', 'blue', 'I-485',
   '[
     {"form_type":"I-140","required":true,"sort_order":1},
     {"form_type":"I-485","required":true,"sort_order":2},
     {"form_type":"I-765","required":true,"sort_order":3},
     {"form_type":"I-131","required":true,"sort_order":4},
     {"form_type":"G-28","required":true,"sort_order":5}
   ]'::jsonb, 2),

  (NULL, 'Naturalización',
   'Ciudadanía estadounidense (N-400)',
   '🇺🇸', 'red', 'N-400',
   '[
     {"form_type":"N-400","required":true,"sort_order":1},
     {"form_type":"G-28","required":true,"sort_order":2}
   ]'::jsonb, 3),

  (NULL, 'Petición Familiar Consular',
   'Residencia desde el exterior vía proceso consular',
   '🌎', 'cyan', 'I-130',
   '[
     {"form_type":"I-130","required":true,"sort_order":1},
     {"form_type":"DS-260","required":true,"sort_order":2},
     {"form_type":"I-864","required":true,"sort_order":3},
     {"form_type":"G-28","required":true,"sort_order":4}
   ]'::jsonb, 4),

  (NULL, 'Renovación Green Card',
   'Renovación o reemplazo de tarjeta de residente',
   '💳', 'amber', 'I-90',
   '[
     {"form_type":"I-90","required":true,"sort_order":1},
     {"form_type":"G-28","required":true,"sort_order":2}
   ]'::jsonb, 5),

  (NULL, 'Remoción de Condiciones',
   'Quitar condición de residencia (matrimonio 2 años)',
   '💍', 'pink', 'I-751',
   '[
     {"form_type":"I-751","required":true,"sort_order":1},
     {"form_type":"G-28","required":true,"sort_order":2}
   ]'::jsonb, 6),

  (NULL, 'VAWA',
   'Autopetición Violence Against Women Act',
   '🛡️', 'purple', 'I-360',
   '[
     {"form_type":"I-360","required":true,"sort_order":1},
     {"form_type":"I-485","required":true,"sort_order":2},
     {"form_type":"I-765","required":true,"sort_order":3},
     {"form_type":"G-28","required":true,"sort_order":4}
   ]'::jsonb, 7),

  (NULL, 'Asilo Afirmativo',
   'Solicitud de asilo ante USCIS',
   '🕊️', 'sky', 'I-589',
   '[
     {"form_type":"I-589","required":true,"sort_order":1},
     {"form_type":"G-28","required":true,"sort_order":2},
     {"form_type":"I-765","required":false,"sort_order":3}
   ]'::jsonb, 8),

  (NULL, 'Premium Processing H-1B',
   'Visa de trabajo H-1B con procesamiento acelerado',
   '⚡', 'orange', 'I-129',
   '[
     {"form_type":"I-129","required":true,"sort_order":1},
     {"form_type":"I-907","required":true,"sort_order":2},
     {"form_type":"G-28","required":true,"sort_order":3}
   ]'::jsonb, 9),

  (NULL, 'Premium Processing I-140',
   'Petición empleador EB con procesamiento acelerado',
   '⚡', 'orange', 'I-140',
   '[
     {"form_type":"I-140","required":true,"sort_order":1},
     {"form_type":"I-907","required":true,"sort_order":2},
     {"form_type":"G-28","required":true,"sort_order":3}
   ]'::jsonb, 10);