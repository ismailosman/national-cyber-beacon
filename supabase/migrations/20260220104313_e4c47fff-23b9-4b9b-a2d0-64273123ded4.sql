
-- Create ssl_logs table
CREATE TABLE public.ssl_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations_monitored(id),
  organization_name text NOT NULL,
  url text NOT NULL,
  is_valid boolean NOT NULL DEFAULT false,
  is_expired boolean NOT NULL DEFAULT false,
  is_expiring_soon boolean NOT NULL DEFAULT false,
  issuer text,
  protocol text,
  valid_from timestamp with time zone,
  valid_to timestamp with time zone,
  days_until_expiry integer,
  checked_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ssl_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies matching uptime_logs pattern
CREATE POLICY "All authenticated read ssl_logs"
  ON public.ssl_logs FOR SELECT
  USING (true);

CREATE POLICY "SuperAdmin full ssl_logs"
  ON public.ssl_logs FOR ALL
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full ssl_logs"
  ON public.ssl_logs FOR ALL
  USING (has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));

CREATE POLICY "Auditor read ssl_logs"
  ON public.ssl_logs FOR SELECT
  USING (has_role(auth.uid(), 'Auditor'::app_role));

-- Index for cleanup queries
CREATE INDEX idx_ssl_logs_checked_at ON public.ssl_logs(checked_at);
CREATE INDEX idx_ssl_logs_org_id ON public.ssl_logs(organization_id);
