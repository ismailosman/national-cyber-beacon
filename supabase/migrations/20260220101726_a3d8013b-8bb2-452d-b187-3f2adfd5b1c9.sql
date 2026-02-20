
-- Table: organizations_monitored
CREATE TABLE public.organizations_monitored (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  sector text NOT NULL DEFAULT 'Government',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations_monitored ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read monitored orgs"
  ON public.organizations_monitored FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "SuperAdmin full monitored orgs"
  ON public.organizations_monitored FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'SuperAdmin'::app_role));

-- Table: uptime_logs
CREATE TABLE public.uptime_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations_monitored(id) ON DELETE CASCADE,
  organization_name text NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'down',
  status_code integer,
  response_time_ms integer,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.uptime_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SuperAdmin full uptime_logs"
  ON public.uptime_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full uptime_logs"
  ON public.uptime_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'Analyst'::app_role));

CREATE POLICY "Auditor read uptime_logs"
  ON public.uptime_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'Auditor'::app_role));

CREATE POLICY "All authenticated read uptime_logs"
  ON public.uptime_logs FOR SELECT
  TO authenticated
  USING (true);

-- Index for uptime calculations
CREATE INDEX idx_uptime_logs_checked_at ON public.uptime_logs (checked_at DESC);
CREATE INDEX idx_uptime_logs_org_id ON public.uptime_logs (organization_id);
