
-- Create scan-reports storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('scan-reports', 'scan-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for anyone with the link
CREATE POLICY "Public read access for scan reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'scan-reports');

-- Service role upload (edge functions use service role key, bypasses RLS)
-- Authenticated users with SuperAdmin role can also upload
CREATE POLICY "Authenticated users can upload scan reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scan-reports' AND auth.role() = 'authenticated');

-- Allow updates (upsert) for authenticated users
CREATE POLICY "Authenticated users can update scan reports"
ON storage.objects FOR UPDATE
USING (bucket_id = 'scan-reports' AND auth.role() = 'authenticated');
