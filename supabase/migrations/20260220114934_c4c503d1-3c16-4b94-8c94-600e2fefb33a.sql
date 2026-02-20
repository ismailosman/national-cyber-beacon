
-- Create early_warning_logs table
CREATE TABLE public.early_warning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations_monitored(id),
  organization_name text NOT NULL,
  url text NOT NULL,
  check_type text NOT NULL,
  risk_level text NOT NULL DEFAULT 'safe',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_acknowledged boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now()
);

-- Create baselines table
CREATE TABLE public.baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations_monitored(id),
  url text NOT NULL,
  content_hash text,
  page_title text,
  page_size integer,
  dns_records jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.early_warning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baselines ENABLE ROW LEVEL SECURITY;

-- RLS for early_warning_logs
CREATE POLICY "All authenticated read early_warning_logs"
  ON public.early_warning_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "SuperAdmin full early_warning_logs"
  ON public.early_warning_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full early_warning_logs"
  ON public.early_warning_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));

CREATE POLICY "Auditor read early_warning_logs"
  ON public.early_warning_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'Auditor'::app_role));

-- RLS for baselines
CREATE POLICY "All authenticated read baselines"
  ON public.baselines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "SuperAdmin full baselines"
  ON public.baselines FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full baselines"
  ON public.baselines FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));

CREATE POLICY "Auditor read baselines"
  ON public.baselines FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'Auditor'::app_role));

-- Indexes
CREATE INDEX idx_early_warning_logs_org ON public.early_warning_logs(organization_id);
CREATE INDEX idx_early_warning_logs_type ON public.early_warning_logs(check_type);
CREATE INDEX idx_early_warning_logs_checked ON public.early_warning_logs(checked_at DESC);
CREATE INDEX idx_baselines_org ON public.baselines(organization_id);
CREATE INDEX idx_baselines_url ON public.baselines(url);

-- Trigger for baselines updated_at
CREATE TRIGGER update_baselines_updated_at
  BEFORE UPDATE ON public.baselines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
