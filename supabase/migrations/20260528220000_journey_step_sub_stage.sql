-- Agrega columnas journey_step + sub_stage a client_cases (Modelo C+).
--
-- Contexto: CLAUDE.md spec arquitectura locked describe 5 ejes:
--   case_type · current_authority · journey_step · sub_stage · responsible
--
-- El frontend (CaseStageInlineEdit + CaseTable v2) ya escribe a
-- `journey_step` desde el dropdown de la columna Status. Bug detectado
-- 2026-05-28: al hacer click cambiar etapa, error PostgREST:
--   "Could not find the 'journey_step' column of 'client_cases' in the
--    schema cache"
--
-- Esta migration cierra el gap. journey_step locked (12 valores),
-- sub_stage TEXT free-form (firma puede agregar custom).

-- ──────────────────────────────────────────────────────────────────
-- 1. Agregar columnas
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.client_cases
  ADD COLUMN IF NOT EXISTS journey_step TEXT,
  ADD COLUMN IF NOT EXISTS sub_stage TEXT;

-- ──────────────────────────────────────────────────────────────────
-- 2. Validación trigger — journey_step solo acepta 12 valores locked
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_journey_step()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.journey_step IS NOT NULL AND NEW.journey_step NOT IN (
    'cliente-nuevo',
    'esperando-cuestionario',
    'esperando-documentos',
    'preparando-paquete',
    'pendiente-revision',
    'enviado',
    'confirmado',
    'en-espera',
    'pide-mas-info',
    'cita-programada',
    'aprobado',
    'negado'
  ) THEN
    RAISE EXCEPTION 'Invalid journey_step: %', NEW.journey_step;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_case_journey_step ON public.client_cases;
CREATE TRIGGER validate_case_journey_step
  BEFORE INSERT OR UPDATE OF journey_step ON public.client_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_journey_step();

-- ──────────────────────────────────────────────────────────────────
-- 3. Backfill journey_step desde pipeline_stage existente
--    (mapping del frontend src/lib/journeySteps.ts PIPELINE_STAGE_TO_JOURNEY)
-- ──────────────────────────────────────────────────────────────────
UPDATE public.client_cases
SET journey_step = CASE
  WHEN pipeline_stage = 'preparacion-formularios' THEN 'preparando-paquete'
  WHEN pipeline_stage = 'armando-ds260'            THEN 'preparando-paquete'
  WHEN pipeline_stage = 'armando-paquete'          THEN 'preparando-paquete'
  WHEN pipeline_stage = 'documentos-pendientes'    THEN 'esperando-documentos'
  WHEN pipeline_stage = 'cuestionario-pendiente'   THEN 'esperando-cuestionario'
  WHEN pipeline_stage = 'revision-qa'              THEN 'pendiente-revision'
  WHEN pipeline_stage = 'revision-attorney'        THEN 'pendiente-revision'
  WHEN pipeline_stage = 'listo-firma'              THEN 'pendiente-revision'
  WHEN pipeline_stage = 'enviado'                  THEN 'enviado'
  WHEN pipeline_stage = 'recibo-uscis'             THEN 'confirmado'
  WHEN pipeline_stage = 'rfe'                      THEN 'pide-mas-info'
  WHEN pipeline_stage = 'noid'                     THEN 'pide-mas-info'
  WHEN pipeline_stage = '221g'                     THEN 'pide-mas-info'
  WHEN pipeline_stage = 'apelacion'                THEN 'pide-mas-info'
  WHEN pipeline_stage = 'entrevista-programada'    THEN 'cita-programada'
  WHEN pipeline_stage = 'biometric-scheduled'      THEN 'cita-programada'
  WHEN pipeline_stage = 'master-calendar'          THEN 'cita-programada'
  WHEN pipeline_stage = 'bond-hearing'             THEN 'cita-programada'
  WHEN pipeline_stage = 'aprobado'                 THEN 'aprobado'
  WHEN pipeline_stage = 'negado'                   THEN 'negado'
  WHEN process_stage  = 'aprobado'                 THEN 'aprobado'
  WHEN process_stage  = 'negado'                   THEN 'negado'
  ELSE 'cliente-nuevo'
END
WHERE journey_step IS NULL;

-- ──────────────────────────────────────────────────────────────────
-- 4. Index para queries del Hub Pipeline + Kanban
-- ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_client_cases_journey_step_account
  ON public.client_cases(account_id, journey_step)
  WHERE status NOT IN ('completed', 'archived', 'cancelled');

-- ──────────────────────────────────────────────────────────────────
-- 5. Comentarios para documentación SQL
-- ──────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.client_cases.journey_step IS
  'Locked ENUM 12 valores: cliente-nuevo / esperando-cuestionario / esperando-documentos / preparando-paquete / pendiente-revision / enviado / confirmado / en-espera / pide-mas-info / cita-programada / aprobado / negado. Modelo C+ NER 2026-05-19.';

COMMENT ON COLUMN public.client_cases.sub_stage IS
  'Sub-etapa free-form text, típicamente pre-cargada según process_stage (USCIS bio / NVC DS-260 / Consular entrevista / etc). Firma puede customizar.';
