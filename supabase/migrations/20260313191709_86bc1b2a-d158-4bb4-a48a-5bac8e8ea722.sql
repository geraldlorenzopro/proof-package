
CREATE OR REPLACE FUNCTION public.get_case_pipeline_by_token(_token text)
RETURNS TABLE(
  pipeline_stage text,
  process_label text,
  stages jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    cc.pipeline_stage,
    COALESCE(pt.process_label, cc.case_type) as process_label,
    COALESCE(pt.stages, '[]'::jsonb) as stages
  FROM public.client_cases cc
  LEFT JOIN public.pipeline_templates pt 
    ON pt.process_type = cc.process_type AND pt.is_active = true
  WHERE length(_token) BETWEEN 1 AND 128 
    AND cc.access_token = _token
  LIMIT 1;
$$;
