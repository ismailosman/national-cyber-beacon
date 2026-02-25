
-- Remove overly broad read policy on tech_fingerprints
DROP POLICY IF EXISTS "All authenticated read tech_fingerprints" ON public.tech_fingerprints;

-- Add org-scoped read for OrgAdmins
CREATE POLICY "OrgAdmin read own tech_fingerprints"
  ON public.tech_fingerprints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'OrgAdmin'::app_role
        AND ur.org_id = tech_fingerprints.organization_id
    )
  );
