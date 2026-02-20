
-- Create media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- Public read access
CREATE POLICY "Public read media" ON storage.objects FOR SELECT USING (bucket_id = 'media');

-- Authenticated users can upload
CREATE POLICY "Authenticated upload media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');

-- Authenticated users can update their own uploads
CREATE POLICY "Authenticated update media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'media');

-- SuperAdmin can delete
CREATE POLICY "SuperAdmin delete media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'SuperAdmin'));
