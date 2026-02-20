
-- Create ddos_risk_logs table
CREATE TABLE public.ddos_risk_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations_monitored(id),
  organization_name TEXT NOT NULL,
  url TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low',
  has_cdn BOOLEAN NOT NULL DEFAULT false,
  cdn_provider TEXT,
  has_rate_limiting BOOLEAN NOT NULL DEFAULT false,
  has_waf BOOLEAN NOT NULL DEFAULT false,
  origin_exposed BOOLEAN NOT NULL DEFAULT true,
  response_time_spike BOOLEAN NOT NULL DEFAULT false,
  availability_flapping BOOLEAN NOT NULL DEFAULT false,
  extended_downtime BOOLEAN NOT NULL DEFAULT false,
  risk_factors TEXT[] NOT NULL DEFAULT '{}',
  protection_headers TEXT[] NOT NULL DEFAULT '{}',
  server_header TEXT,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ddos_risk_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All authenticated read ddos_risk_logs"
  ON public.ddos_risk_logs FOR SELECT
  USING (true);

CREATE POLICY "SuperAdmin full ddos_risk_logs"
  ON public.ddos_risk_logs FOR ALL
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full ddos_risk_logs"
  ON public.ddos_risk_logs FOR ALL
  USING (has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));

CREATE POLICY "Auditor read ddos_risk_logs"
  ON public.ddos_risk_logs FOR SELECT
  USING (has_role(auth.uid(), 'Auditor'::app_role));

-- Indexes
CREATE INDEX idx_ddos_risk_logs_checked_at ON public.ddos_risk_logs(checked_at DESC);
CREATE INDEX idx_ddos_risk_logs_org_id ON public.ddos_risk_logs(organization_id);
