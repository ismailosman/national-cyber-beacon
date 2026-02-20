
-- Create playbooks table for incident response procedures
CREATE TABLE public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  threat_type text NOT NULL,
  severity text NOT NULL DEFAULT 'all',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All authenticated read playbooks"
  ON public.playbooks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "SuperAdmin full playbooks"
  ON public.playbooks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

CREATE POLICY "Analyst full playbooks"
  ON public.playbooks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'Analyst'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_playbooks_updated_at
  BEFORE UPDATE ON public.playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
