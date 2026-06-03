-- Permitir que miembros del mismo account vean los profiles de sus colegas.
--
-- Bug encontrado 2026-06-03: la lista del equipo en /hub/settings/office#team
-- mostraba "Sin nombre" para todos excepto el caller, porque la RLS original
-- de profiles solo permitía SELECT cuando auth.uid() = user_id (self-only).
--
-- La query del frontend hacía:
--   SELECT user_id, full_name FROM profiles WHERE user_id IN (members.ids)
-- pero RLS filtraba todo lo que no era el propio user del caller.
--
-- Fix: agregar policy adicional que permita SELECT cuando el caller y el
-- target están en el MISMO account activamente. Mantiene la policy
-- "own profile" original (las policies son OR, cualquier true permite).
--
-- Seguridad: solo expone full_name + firm_name (lo que ya está en profiles
-- por design). El owner/admin de la firma siempre debería poder ver a sus
-- miembros — son su propio equipo. No revela nada de firmas externas.

CREATE POLICY "Account members can view teammate profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members caller
      JOIN public.account_members target
        ON caller.account_id = target.account_id
      WHERE caller.user_id = auth.uid()
        AND target.user_id = profiles.user_id
        AND caller.is_active = true
        AND target.is_active = true
    )
  );

-- Verificación post-deploy (correr en SQL editor para validar):
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claim.sub = '<gerald-user-id>';
-- SELECT user_id, full_name FROM profiles WHERE user_id IN (SELECT user_id FROM account_members WHERE account_id = '<mr-visa-account>');
-- Debería devolver 2 rows: Gerald + Claudia con sus full_name reales.
