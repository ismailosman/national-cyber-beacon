
-- Table: threat_intelligence_logs
CREATE TABLE public.threat_intelligence_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  organization_name text,
  check_type text NOT NULL,
  risk_level text NOT NULL DEFAULT 'info',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_acknowledged boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_intelligence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read threat_intelligence_logs" ON public.threat_intelligence_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "SuperAdmin full threat_intelligence_logs" ON public.threat_intelligence_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "Analyst full threat_intelligence_logs" ON public.threat_intelligence_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read threat_intelligence_logs" ON public.threat_intelligence_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));

-- Table: tech_fingerprints
CREATE TABLE public.tech_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  url text NOT NULL,
  web_server text,
  web_server_version text,
  language text,
  language_version text,
  cms text,
  cms_version text,
  cdn text,
  js_libraries text[] NOT NULL DEFAULT '{}',
  outdated_count integer NOT NULL DEFAULT 0,
  vulnerabilities_count integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tech_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read tech_fingerprints" ON public.tech_fingerprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "SuperAdmin full tech_fingerprints" ON public.tech_fingerprints FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "Analyst full tech_fingerprints" ON public.tech_fingerprints FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read tech_fingerprints" ON public.tech_fingerprints FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));

-- Table: phishing_domains
CREATE TABLE public.phishing_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  organization_name text NOT NULL,
  original_domain text NOT NULL,
  lookalike_domain text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  ip_address text,
  has_website boolean NOT NULL DEFAULT false,
  risk_level text NOT NULL DEFAULT 'low',
  first_detected timestamptz NOT NULL DEFAULT now(),
  last_checked timestamptz NOT NULL DEFAULT now(),
  is_acknowledged boolean NOT NULL DEFAULT false
);

ALTER TABLE public.phishing_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read phishing_domains" ON public.phishing_domains FOR SELECT TO authenticated USING (true);
CREATE POLICY "SuperAdmin full phishing_domains" ON public.phishing_domains FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "Analyst full phishing_domains" ON public.phishing_domains FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read phishing_domains" ON public.phishing_domains FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));
