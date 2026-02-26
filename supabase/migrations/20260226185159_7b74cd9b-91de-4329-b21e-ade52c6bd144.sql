INSERT INTO public.hub_apps (name, slug, description, icon, is_active)
VALUES ('USCIS Document Analyzer', 'uscis-analyzer', 'Analiza documentos de USCIS (RFE, NOID, I-797, etc.) con IA especializada en inmigración', 'FileSearch', true)
ON CONFLICT DO NOTHING;