
-- 1. security_score_history: drop broad read, add role-based
DROP POLICY IF EXISTS "All authenticated read security_score_history" ON public.security_score_history;

CREATE POLICY "Privileged read security_score_history"
  ON public.security_score_history FOR SELECT
  USING (
    public.has_role(auth.uid(), 'SuperAdmin'::app_role)
    OR public.has_role(auth.uid(), 'Analyst'::app_role)
    OR public.has_role(auth.uid(), 'Auditor'::app_role)
  );

CREATE POLICY "OrgAdmin read own security_score_history"
  ON public.security_score_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'OrgAdmin'::app_role
        AND ur.org_id = security_score_history.organization_id
    )
  );

-- 2. ssl_logs: drop broad read, add role-based
DROP POLICY IF EXISTS "All authenticated read ssl_logs" ON public.ssl_logs;

CREATE POLICY "Privileged read ssl_logs"
  ON public.ssl_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'SuperAdmin'::app_role)
    OR public.has_role(auth.uid(), 'Analyst'::app_role)
    OR public.has_role(auth.uid(), 'Auditor'::app_role)
  );

CREATE POLICY "OrgAdmin read own ssl_logs"
  ON public.ssl_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'OrgAdmin'::app_role
        AND ur.org_id = ssl_logs.organization_id
    )
  );

-- 3. ddos_risk_logs: drop broad read, add role-based
DROP POLICY IF EXISTS "All authenticated read ddos_risk_logs" ON public.ddos_risk_logs;

CREATE POLICY "Privileged read ddos_risk_logs"
  ON public.ddos_risk_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'SuperAdmin'::app_role)
    OR public.has_role(auth.uid(), 'Analyst'::app_role)
    OR public.has_role(auth.uid(), 'Auditor'::app_role)
  );

CREATE POLICY "OrgAdmin read own ddos_risk_logs"
  ON public.ddos_risk_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'OrgAdmin'::app_role
        AND ur.org_id = ddos_risk_logs.organization_id
    )
  );

-- 4. check_errors: drop broad read, add role-based
DROP POLICY IF EXISTS "All authenticated read check_errors" ON public.check_errors;

CREATE POLICY "Privileged read check_errors"
  ON public.check_errors FOR SELECT
  USING (
    public.has_role(auth.uid(), 'SuperAdmin'::app_role)
    OR public.has_role(auth.uid(), 'Analyst'::app_role)
    OR public.has_role(auth.uid(), 'Auditor'::app_role)
  );

CREATE POLICY "OrgAdmin read own check_errors"
  ON public.check_errors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'OrgAdmin'::app_role
        AND ur.org_id = check_errors.organization_id
    )
  );
