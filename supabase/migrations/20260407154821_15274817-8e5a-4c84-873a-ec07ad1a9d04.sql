
-- Create case_documents table
CREATE TABLE IF NOT EXISTS public.case_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.ner_accounts(id),
  case_id UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  uploaded_by_name TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  category TEXT DEFAULT 'otro',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view case documents"
ON public.case_documents FOR SELECT
TO authenticated
USING (account_id = user_account_id(auth.uid()));

CREATE POLICY "Account members can insert case documents"
ON public.case_documents FOR INSERT
TO authenticated
WITH CHECK (account_id = user_account_id(auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "Account members can delete case documents"
ON public.case_documents FOR DELETE
TO authenticated
USING (account_id = user_account_id(auth.uid()));

CREATE INDEX idx_case_documents_case_id ON public.case_documents(case_id);

-- Create storage bucket for case documents
INSERT INTO storage.buckets (id, name, public) VALUES ('case-documents', 'case-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload case documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-documents');

CREATE POLICY "Authenticated users can view case documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'case-documents');

CREATE POLICY "Authenticated users can delete case documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'case-documents');
