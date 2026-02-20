
-- Create settings table for storing API keys and config
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Only SuperAdmin can read/write settings
CREATE POLICY "SuperAdmin full settings"
  ON public.settings FOR ALL
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

-- Analysts can read settings (needed for breach scans)
CREATE POLICY "Analyst read settings"
  ON public.settings FOR SELECT
  USING (has_role(auth.uid(), 'Analyst'::app_role));
