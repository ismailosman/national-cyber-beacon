-- 1. Drop Auditor read from breach_check_results
DROP POLICY IF EXISTS "Auditor read breach_check_results" ON public.breach_check_results;

-- 2. Set security_invoker on incident_reports_safe view
-- This ensures the view respects the base table's RLS policies
ALTER VIEW public.incident_reports_safe SET (security_invoker = on);