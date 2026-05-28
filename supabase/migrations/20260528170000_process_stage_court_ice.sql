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

CREATE OR REPLACE FUNCTION public.validate_process_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
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
  RETURN NEW;
END;
$$;
