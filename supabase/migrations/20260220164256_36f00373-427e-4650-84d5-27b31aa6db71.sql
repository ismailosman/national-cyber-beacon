
-- Create breach_check_results table for caching per-org breach results
CREATE TABLE public.breach_check_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE,
  organization_name text NOT NULL DEFAULT '',
  domain text NOT NULL DEFAULT '',
  breach_count integer NOT NULL DEFAULT 0,
  breaches jsonb NOT NULL DEFAULT '[]'::jsonb,
  breached_emails text[] NOT NULL DEFAULT '{}'::text[],
  is_clean boolean,
  error text,
  source text NOT NULL DEFAULT '',
  checked_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.breach_check_results ENABLE ROW LEVEL SECURITY;

-- RLS policies matching existing pattern
CREATE POLICY "SuperAdmin full breach_check_results"
  ON public.breach_check_results FOR ALL
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full breach_check_results"
  ON public.breach_check_results FOR ALL
  USING (has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));

CREATE POLICY "Auditor read breach_check_results"
  ON public.breach_check_results FOR SELECT
  USING (has_role(auth.uid(), 'Auditor'::app_role));

CREATE POLICY "All authenticated read breach_check_results"
  ON public.breach_check_results FOR SELECT
  USING (true);
