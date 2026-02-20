
CREATE TABLE public.dast_scan_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE,
  organization_name text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  dast_score integer NOT NULL DEFAULT 0,
  scanned_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dast_scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin full dast" ON public.dast_scan_results FOR ALL
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full dast" ON public.dast_scan_results FOR ALL
  USING (has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));

CREATE POLICY "Auditor read dast" ON public.dast_scan_results FOR SELECT
  USING (has_role(auth.uid(), 'Auditor'::app_role));

CREATE POLICY "OrgAdmin read own dast" ON public.dast_scan_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'OrgAdmin'::app_role
      AND ur.org_id = dast_scan_results.organization_id
  ));
