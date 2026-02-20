
CREATE TABLE public.compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  control_code text NOT NULL,
  framework text NOT NULL DEFAULT 'cis-v8',
  status text NOT NULL DEFAULT 'not_assessed',
  assessment_type text NOT NULL DEFAULT 'manual',
  evidence text DEFAULT '',
  evidence_data jsonb DEFAULT '{}'::jsonb,
  assessed_by text DEFAULT 'System (Auto)',
  assessed_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(organization_id, control_code, framework)
);

ALTER TABLE public.compliance_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read compliance_assessments" ON public.compliance_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Analyst full compliance_assessments" ON public.compliance_assessments FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read compliance_assessments" ON public.compliance_assessments FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));
CREATE POLICY "SuperAdmin full compliance_assessments" ON public.compliance_assessments FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
