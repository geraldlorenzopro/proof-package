-- Create storage bucket for firm logos
INSERT INTO storage.buckets (id, name, public) VALUES ('firm-logos', 'firm-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own logos
CREATE POLICY "Users can upload their own logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own logos
CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own logos
CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access to logos (for PDF reports etc)
CREATE POLICY "Public can read logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'firm-logos');