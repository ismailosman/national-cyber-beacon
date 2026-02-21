
CREATE TABLE public.security_score_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations_monitored(id) ON DELETE CASCADE,
  organization_name text NOT NULL,
  sector text NOT NULL DEFAULT 'Government',
  security_score integer NOT NULL DEFAULT 0,
  uptime_percent numeric DEFAULT NULL,
  ssl_valid boolean DEFAULT false,
  threats_count integer DEFAULT 0,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, recorded_date)
);

ALTER TABLE public.security_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read security_score_history"
  ON public.security_score_history
  FOR SELECT
  USING (true);

CREATE POLICY "SuperAdmin full security_score_history"
  ON public.security_score_history
  FOR ALL
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full security_score_history"
  ON public.security_score_history
  FOR ALL
  USING (has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.security_score_history;
