
-- Drop FK constraints on log tables that reference organizations_monitored
-- This allows the scan to write organization IDs from the 'organizations' table directly

ALTER TABLE public.uptime_logs DROP CONSTRAINT IF EXISTS uptime_logs_organization_id_fkey;
ALTER TABLE public.ssl_logs DROP CONSTRAINT IF EXISTS ssl_logs_organization_id_fkey;
ALTER TABLE public.ddos_risk_logs DROP CONSTRAINT IF EXISTS ddos_risk_logs_organization_id_fkey;
ALTER TABLE public.early_warning_logs DROP CONSTRAINT IF EXISTS early_warning_logs_organization_id_fkey;
ALTER TABLE public.baselines DROP CONSTRAINT IF EXISTS baselines_organization_id_fkey;

-- Insert missing organizations into organizations_monitored so scheduled scans include them
-- Map from organizations table, skip if name already exists
INSERT INTO public.organizations_monitored (id, name, url, sector, is_active)
SELECT o.id, o.name, 
  CASE WHEN o.domain LIKE 'http%' THEN o.domain ELSE 'https://' || o.domain END,
  o.sector, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations_monitored om WHERE LOWER(TRIM(om.name)) = LOWER(TRIM(o.name))
)
ON CONFLICT (id) DO NOTHING;
