
-- Enable realtime for evidence_items and form_submissions
ALTER PUBLICATION supabase_realtime ADD TABLE public.evidence_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.form_submissions;
