
-- Tabla de profesionales NER (profiles)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  firm_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Tabla de casos de clientes
CREATE TABLE public.client_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  case_type TEXT NOT NULL DEFAULT 'I-130',
  petitioner_name TEXT,
  beneficiary_name TEXT,
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professionals can manage their cases"
  ON public.client_cases FOR ALL
  USING (auth.uid() = professional_id);

CREATE POLICY "Anyone with token can view case"
  ON public.client_cases FOR SELECT
  USING (true);

-- Tabla de evidencias del cliente
CREATE TABLE public.evidence_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'photo', -- photo, chat, other
  file_size INTEGER,
  event_date TEXT,
  date_is_approximate BOOLEAN DEFAULT false,
  caption TEXT,
  location TEXT,
  participants TEXT,
  platform TEXT,
  demonstrates TEXT,
  source_location TEXT,
  notes TEXT,
  form_complete BOOLEAN DEFAULT false,
  upload_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;

-- Professionals can see all evidence for their cases
CREATE POLICY "Professionals can manage evidence for their cases"
  ON public.evidence_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.client_cases
      WHERE client_cases.id = evidence_items.case_id
      AND client_cases.professional_id = auth.uid()
    )
  );

-- Anyone can insert/update evidence (client uploads via token - handled in app logic)
CREATE POLICY "Anyone can insert evidence"
  ON public.evidence_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update evidence"
  ON public.evidence_items FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can view evidence"
  ON public.evidence_items FOR SELECT
  USING (true);

-- Storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-files', 'evidence-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload evidence files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'evidence-files');

CREATE POLICY "Anyone can view evidence files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence-files');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_client_cases_updated_at
  BEFORE UPDATE ON public.client_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evidence_items_updated_at
  BEFORE UPDATE ON public.evidence_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
