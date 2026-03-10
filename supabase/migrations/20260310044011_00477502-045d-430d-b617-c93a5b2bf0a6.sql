-- Insert Case Engine as a hub app
INSERT INTO public.hub_apps (slug, name, description, icon, is_active)
VALUES ('case-engine', 'Case Engine', 'Motor de casos integral — directorio de clientes, workspace con SOP y herramientas contextuales', 'Briefcase', true);

-- Grant access to Mr Visa Immigration account (unlimited seats)
INSERT INTO public.account_app_access (account_id, app_id, max_seats)
SELECT '443d8719-94c7-47f9-9bef-3d911ba4c174', id, 0
FROM public.hub_apps WHERE slug = 'case-engine';