
-- 1. breach_check_results: Remove overly broad "all authenticated" read policy
--    SuperAdmin (full), Analyst (full), and Auditor (read) policies already cover authorized access
DROP POLICY IF EXISTS "All authenticated read breach_check_results" ON public.breach_check_results;

-- 2. incident_reports: Create a secure view that hides reporter_email and affected_assets
--    Only SuperAdmin and Analyst see full data; OrgAdmin/Auditor see redacted view
CREATE OR REPLACE VIEW public.incident_reports_safe
WITH (security_invoker = on) AS
  SELECT
    id,
    category,
    severity,
    status,
    description,
    organization_id,
    reporter_type,
    assigned_to,
    attachment_urls,
    created_at,
    -- Hide sensitive fields from the view
    CASE
      WHEN public.has_role(auth.uid(), 'SuperAdmin') OR public.has_role(auth.uid(), 'Analyst')
      THEN reporter_email
      ELSE NULL
    END AS reporter_email,
    CASE
      WHEN public.has_role(auth.uid(), 'SuperAdmin') OR public.has_role(auth.uid(), 'Analyst')
      THEN affected_assets
      ELSE NULL
    END AS affected_assets
  FROM public.incident_reports;
