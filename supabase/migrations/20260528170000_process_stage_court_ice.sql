-- Extiende process_stage validation para soportar 'court' (corte de inmigración)
-- e 'ice' (detención / removal proceedings).
--
-- Contexto 2026-05-28: las 5 firmas que reciben acceso hoy manejan también
-- casos en corte EOIR y detención ICE, no solo USCIS/NVC/Consular. El modelo
-- de pipelines en useCasePipeline.ts ya contemplaba estos buckets pero el
-- trigger DB los rechazaba con "Invalid process_stage".
--
-- Backward compat: 'embajada' se mantiene como key legacy para Consular.
-- El frontend mapea Consular → 'embajada' en journeySteps.ts.
--
-- Superset de la migration 20260528164550 (también aplicada por Lovable):
-- agrega SET search_path TO 'public' por security best-practice + valida
-- interview_type para evitar valores arbitrarios.

CREATE OR REPLACE FUNCTION public.validate_process_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.process_stage IS NOT NULL AND NEW.process_stage NOT IN (
    'uscis',
    'nvc',
    'embajada',
    'court',
    'ice',
    'admin-processing',
    'aprobado',
    'negado'
  ) THEN
    RAISE EXCEPTION 'Invalid process_stage: %', NEW.process_stage;
  END IF;
  IF NEW.interview_type IS NOT NULL AND NEW.interview_type NOT IN (
    'embajada','cas','uscis_local','none'
  ) THEN
    RAISE EXCEPTION 'Invalid interview_type: %', NEW.interview_type;
  END IF;
  RETURN NEW;
END;
$$;
