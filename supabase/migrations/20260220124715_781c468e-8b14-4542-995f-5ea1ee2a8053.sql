
-- Create check_errors table
CREATE TABLE public.check_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid,
  organization_name text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  check_type text NOT NULL DEFAULT '',
  error_type text NOT NULL DEFAULT 'UNKNOWN',
  error_message text NOT NULL DEFAULT '',
  retry_count integer NOT NULL DEFAULT 0,
  checked_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.check_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read check_errors" ON public.check_errors FOR SELECT USING (true);
CREATE POLICY "SuperAdmin full check_errors" ON public.check_errors FOR ALL USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "Analyst full check_errors" ON public.check_errors FOR ALL USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read check_errors" ON public.check_errors FOR SELECT USING (has_role(auth.uid(), 'Auditor'::app_role));

-- Enable realtime on relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE uptime_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE ssl_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE ddos_risk_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE early_warning_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE threat_intelligence_logs;
