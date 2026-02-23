
-- Enum para planes
CREATE TYPE public.ner_plan AS ENUM ('essential', 'professional', 'elite');

-- Enum para roles de cuenta
CREATE TYPE public.account_role AS ENUM ('owner', 'admin', 'member');

-- Tabla de cuentas NER (1 por cliente GHL)
CREATE TABLE public.ner_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_contact_id TEXT UNIQUE,
  account_name TEXT NOT NULL,
  plan ner_plan NOT NULL DEFAULT 'essential',
  max_users INTEGER NOT NULL DEFAULT 1,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ner_accounts ENABLE ROW LEVEL SECURITY;

-- Miembros de cuenta (vincula auth users con cuentas)
CREATE TABLE public.account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role account_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);

ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

-- Catálogo de apps/herramientas del Hub
CREATE TABLE public.hub_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_apps ENABLE ROW LEVEL SECURITY;

-- Acceso de apps por cuenta
CREATE TABLE public.account_app_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.hub_apps(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, app_id)
);

ALTER TABLE public.account_app_access ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at en ner_accounts
CREATE TRIGGER update_ner_accounts_updated_at
  BEFORE UPDATE ON public.ner_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SECURITY DEFINER FUNCTIONS ============

-- Función para verificar si un usuario pertenece a una cuenta
CREATE OR REPLACE FUNCTION public.user_account_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.account_members WHERE user_id = _user_id LIMIT 1
$$;

-- Función para verificar rol en cuenta
CREATE OR REPLACE FUNCTION public.has_account_role(_user_id UUID, _role account_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ RLS POLICIES ============

-- ner_accounts: miembros pueden ver su propia cuenta
CREATE POLICY "Members can view their account"
  ON public.ner_accounts FOR SELECT
  USING (id = public.user_account_id(auth.uid()));

-- ner_accounts: solo service_role puede insertar/actualizar (webhook)
CREATE POLICY "Service role manages accounts"
  ON public.ner_accounts FOR ALL
  USING (auth.role() = 'service_role');

-- account_members: pueden ver miembros de su cuenta
CREATE POLICY "Members can view account members"
  ON public.account_members FOR SELECT
  USING (account_id = public.user_account_id(auth.uid()));

-- account_members: service_role gestiona
CREATE POLICY "Service role manages members"
  ON public.account_members FOR ALL
  USING (auth.role() = 'service_role');

-- hub_apps: todos los autenticados pueden ver apps activas
CREATE POLICY "Authenticated users can view active apps"
  ON public.hub_apps FOR SELECT
  TO authenticated
  USING (is_active = true);

-- hub_apps: service_role gestiona
CREATE POLICY "Service role manages apps"
  ON public.hub_apps FOR ALL
  USING (auth.role() = 'service_role');

-- account_app_access: miembros ven accesos de su cuenta
CREATE POLICY "Members can view their app access"
  ON public.account_app_access FOR SELECT
  USING (account_id = public.user_account_id(auth.uid()));

-- account_app_access: service_role gestiona
CREATE POLICY "Service role manages app access"
  ON public.account_app_access FOR ALL
  USING (auth.role() = 'service_role');

-- ============ SEED: Apps iniciales ============
INSERT INTO public.hub_apps (slug, name, description, icon) VALUES
  ('evidence-tool', 'Organizador de Evidencias', 'Organiza y prepara evidencias para casos de inmigración', 'FileText'),
  ('cspa-calculator', 'Calculadora CSPA', 'Calcula la edad bajo el Child Status Protection Act', 'Calculator'),
  ('visa-bulletin', 'Boletín de Visas', 'Consulta fechas de prioridad del boletín de visas', 'Calendar');
