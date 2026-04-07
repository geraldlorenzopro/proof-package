
-- 1. Update process_stage validation trigger to include new values
CREATE OR REPLACE FUNCTION public.validate_process_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.process_stage IS NOT NULL AND NEW.process_stage NOT IN ('uscis', 'nvc', 'embajada', 'aprobado', 'negado', 'admin-processing') THEN
    RAISE EXCEPTION 'Invalid process_stage: %', NEW.process_stage;
  END IF;
  IF NEW.interview_type IS NOT NULL AND NEW.interview_type NOT IN ('embajada', 'cas', 'uscis_local', 'none') THEN
    RAISE EXCEPTION 'Invalid interview_type: %', NEW.interview_type;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Migrate existing data: cas -> embajada, denegado -> negado
UPDATE public.client_cases SET process_stage = 'embajada' WHERE process_stage = 'cas';
UPDATE public.client_cases SET process_stage = 'negado' WHERE process_stage = 'denegado';

-- 3. Create case_tag_definitions table
CREATE TABLE IF NOT EXISTS public.case_tag_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_key TEXT UNIQUE NOT NULL,
  tag_label TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  relevant_stages TEXT[] DEFAULT '{}',
  relevant_case_types TEXT[] DEFAULT '{}',
  color TEXT DEFAULT 'blue',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.case_tag_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tag definitions"
ON public.case_tag_definitions FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Platform admins can manage tag definitions"
ON public.case_tag_definitions FOR ALL
TO authenticated USING (public.is_platform_admin());

-- 4. Insert initial tag definitions
INSERT INTO public.case_tag_definitions (tag_key, tag_label, category, color) VALUES
('caso:urgente', 'Urgente', 'Estado del Caso', 'red'),
('caso:pausado', 'Pausado', 'Estado del Caso', 'gray'),
('caso:sin-respuesta', 'Sin respuesta', 'Estado del Caso', 'yellow'),
('caso:cerrado-ganado', 'Cerrado - Ganado', 'Estado del Caso', 'green'),
('caso:cerrado-perdido', 'Cerrado - Perdido', 'Estado del Caso', 'red'),
('pendiente:RFE-respuesta', 'RFE Recibido', 'Pendientes', 'red'),
('pendiente:NOID-respuesta', 'NOID Recibido', 'Pendientes', 'red'),
('pendiente:biometrics', 'Biometría Pendiente', 'Pendientes', 'yellow'),
('pendiente:interview-USCIS', 'Entrevista USCIS', 'Pendientes', 'yellow'),
('pendiente:USCIS', 'Esperando USCIS', 'Pendientes', 'blue'),
('pendiente:NVC', 'Esperando NVC', 'Pendientes', 'blue'),
('pendiente:consulado', 'Esperando Consulado', 'Pendientes', 'blue'),
('cli-pend:documentos', 'Cliente: Falta docs', 'Cliente Pendiente', 'orange'),
('cli-pend:firma', 'Cliente: Firma pendiente', 'Cliente Pendiente', 'orange'),
('cli-pend:pago', 'Cliente: Pago pendiente', 'Cliente Pendiente', 'orange'),
('cli-pend:informacion', 'Cliente: Info pendiente', 'Cliente Pendiente', 'orange'),
('cli-pend:traduccion', 'Cliente: Traducción', 'Cliente Pendiente', 'orange'),
('docs:completo', 'Docs: Completo', 'Documentos', 'green'),
('docs:pendiente', 'Docs: Pendiente', 'Documentos', 'yellow'),
('docs:faltante-critico', 'Docs: Faltante crítico', 'Documentos', 'red'),
('docs:RFE-preparando', 'Docs: Preparando RFE', 'Documentos', 'yellow'),
('docs:enviado-agencia', 'Paquete enviado', 'Documentos', 'green'),
('nvc:caso-recibido', 'NVC: Caso recibido', 'NVC', 'blue'),
('nvc:docs-completos', 'NVC: Docs completos', 'NVC', 'green'),
('nvc:interview-agendada', 'NVC: Entrevista agendada', 'NVC', 'green'),
('nvc:visa-aprobada', 'NVC: Visa aprobada', 'NVC', 'green'),
('nvc:visa-negada', 'NVC: Visa negada', 'NVC', 'red'),
('nvc:221g-pendiente', '221(g) Pendiente', 'NVC', 'red'),
('pago:completo', 'Pago: Completo', 'Pagos', 'green'),
('pago:vencido', 'Pago: Vencido', 'Pagos', 'red'),
('pago:govt-fee-pendiente', 'Govt Fee Pendiente', 'Pagos', 'yellow'),
('pago:govt-fee-pagado', 'Govt Fee Pagado', 'Pagos', 'green'),
('natu:entrevista-agendada', 'N-400: Entrevista', 'Naturalización', 'blue'),
('natu:ceremonia-juramento', 'Ceremonia de juramento', 'Naturalización', 'green'),
('tps:renovacion', 'TPS: Renovación', 'Protección', 'blue'),
('daca:renovacion', 'DACA: Renovación', 'Protección', 'blue'),
('corte:detenido-ICE', 'Detenido ICE', 'Corte', 'red'),
('corte:orden-remocion', 'Orden de Remoción', 'Corte', 'red'),
('caso:humanitario', 'Caso Humanitario', 'Especial', 'purple');
