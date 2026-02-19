
-- =============================================
-- SOMALIA CYBER DEFENSE OBSERVATORY — PHASE 1
-- Extended Schema Migration
-- =============================================

-- ---- ENUMS ----
DO $$ BEGIN
  CREATE TYPE sector_type AS ENUM ('government','bank','telecom','health','education','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE severity_type AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('ddos','bruteforce','vuln_scan','phishing','malware','defacement','credential_stuffing','policy_violation','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('new','triage','investigating','contained','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE control_status AS ENUM ('pass','fail','partial','not_applicable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE anomaly_status AS ENUM ('open','triaged','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- DROP EXISTING TABLES (to rebuild cleanly with new schema) ----
-- We keep user_roles since it's already correctly structured
DROP TABLE IF EXISTS public.ioc_matches CASCADE;
DROP TABLE IF EXISTS public.cert_advisories CASCADE;
DROP TABLE IF EXISTS public.incident_timeline CASCADE;
DROP TABLE IF EXISTS public.incident_reports CASCADE;
DROP TABLE IF EXISTS public.control_results CASCADE;
DROP TABLE IF EXISTS public.controls CASCADE;
DROP TABLE IF EXISTS public.compliance_frameworks CASCADE;
DROP TABLE IF EXISTS public.anomalies CASCADE;
DROP TABLE IF EXISTS public.metrics_timeseries CASCADE;
DROP TABLE IF EXISTS public.threat_events CASCADE;
DROP TABLE IF EXISTS public.risk_history CASCADE;
DROP TABLE IF EXISTS public.risk_score_history CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.security_checks CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- ---- ORGANIZATIONS ----
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sector sector_type NOT NULL DEFAULT 'government',
  domain text NOT NULL UNIQUE,
  region text NOT NULL DEFAULT 'Banaadir',
  lat double precision NULL,
  lng double precision NULL,
  risk_score int NOT NULL DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'Warning',
  last_scan timestamptz NULL,
  contact_email text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_orgs_sector ON public.organizations(sector);
CREATE INDEX idx_orgs_region ON public.organizations(region);
CREATE INDEX idx_orgs_risk_score ON public.organizations(risk_score);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ---- ASSETS ----
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  asset_type text NOT NULL DEFAULT 'website',
  url text NOT NULL,
  ip_address text NULL,
  is_critical boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_assets_org ON public.assets(organization_id);
CREATE INDEX idx_assets_type ON public.assets(asset_type);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- ---- SECURITY CHECKS ----
CREATE TABLE public.security_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  check_type text NOT NULL,
  status text NOT NULL DEFAULT 'pass',
  score int NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sc_asset ON public.security_checks(asset_id);
CREATE INDEX idx_sc_type ON public.security_checks(check_type);
CREATE INDEX idx_sc_checked ON public.security_checks(checked_at DESC);

ALTER TABLE public.security_checks ENABLE ROW LEVEL SECURITY;

-- ---- ALERTS ----
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  severity severity_type NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'scanner',
  status text NOT NULL DEFAULT 'open',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_alerts_org ON public.alerts(organization_id);
CREATE INDEX idx_alerts_severity ON public.alerts(severity);
CREATE INDEX idx_alerts_status ON public.alerts(status);
CREATE INDEX idx_alerts_created ON public.alerts(created_at DESC);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ---- RISK HISTORY ----
CREATE TABLE public.risk_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  score int NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rh_org ON public.risk_history(organization_id);
CREATE INDEX idx_rh_created ON public.risk_history(created_at DESC);

ALTER TABLE public.risk_history ENABLE ROW LEVEL SECURITY;

-- ---- THREAT EVENTS ----
CREATE TABLE public.threat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  sector sector_type NOT NULL DEFAULT 'government',
  event_type event_type NOT NULL DEFAULT 'other',
  severity severity_type NOT NULL DEFAULT 'medium',
  target_region text NOT NULL DEFAULT 'Banaadir',
  lat double precision NULL,
  lng double precision NULL,
  source_country text NULL,
  count int NOT NULL DEFAULT 1,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_te_created ON public.threat_events(created_at DESC);
CREATE INDEX idx_te_region ON public.threat_events(target_region);
CREATE INDEX idx_te_severity ON public.threat_events(severity);
CREATE INDEX idx_te_event_type ON public.threat_events(event_type);

ALTER TABLE public.threat_events ENABLE ROW LEVEL SECURITY;

-- ---- METRICS TIMESERIES ----
CREATE TABLE public.metrics_timeseries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  metric_name text NOT NULL,
  value double precision NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_mt_org ON public.metrics_timeseries(organization_id);
CREATE INDEX idx_mt_metric ON public.metrics_timeseries(metric_name);
CREATE INDEX idx_mt_created ON public.metrics_timeseries(created_at DESC);

ALTER TABLE public.metrics_timeseries ENABLE ROW LEVEL SECURITY;

-- ---- ANOMALIES ----
CREATE TABLE public.anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  metric_name text NOT NULL,
  expected double precision NULL,
  observed double precision NOT NULL,
  confidence double precision NOT NULL DEFAULT 0.5,
  severity severity_type NOT NULL DEFAULT 'medium',
  explanation text NOT NULL DEFAULT '',
  status anomaly_status NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_an_org ON public.anomalies(organization_id);
CREATE INDEX idx_an_created ON public.anomalies(created_at DESC);
CREATE INDEX idx_an_status ON public.anomalies(status);
CREATE INDEX idx_an_severity ON public.anomalies(severity);

ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;

-- ---- COMPLIANCE ----
CREATE TABLE public.compliance_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id uuid REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE NOT NULL,
  control_code text NOT NULL,
  title text NOT NULL,
  description text NULL,
  weight int NOT NULL DEFAULT 1,
  evidence_type text NOT NULL DEFAULT 'hybrid',
  domain text NOT NULL DEFAULT 'Network',
  created_at timestamptz DEFAULT now(),
  UNIQUE (framework_id, control_code)
);

ALTER TABLE public.controls ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.control_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  control_id uuid REFERENCES public.controls(id) ON DELETE CASCADE NOT NULL,
  status control_status NOT NULL DEFAULT 'fail',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  assessed_at timestamptz DEFAULT now(),
  assessor_user_id uuid NULL
);

CREATE INDEX idx_cr_org ON public.control_results(organization_id);
CREATE INDEX idx_cr_ctrl ON public.control_results(control_id);
CREATE INDEX idx_cr_assessed ON public.control_results(assessed_at DESC);

ALTER TABLE public.control_results ENABLE ROW LEVEL SECURITY;

-- ---- INCIDENT REPORTING ----
CREATE TABLE public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_type text NOT NULL DEFAULT 'public',
  reporter_email text NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL NULL,
  category text NOT NULL DEFAULT 'other',
  severity severity_type NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  affected_assets text NULL,
  attachment_urls text[] NOT NULL DEFAULT '{}',
  status incident_status NOT NULL DEFAULT 'new',
  assigned_to uuid NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ir_org ON public.incident_reports(organization_id);
CREATE INDEX idx_ir_status ON public.incident_reports(status);
CREATE INDEX idx_ir_created ON public.incident_reports(created_at DESC);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.incident_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES public.incident_reports(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  notes text NULL,
  user_id uuid NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_itl_incident ON public.incident_timeline(incident_id);
ALTER TABLE public.incident_timeline ENABLE ROW LEVEL SECURITY;

-- ---- CERT ADVISORIES ----
CREATE TABLE public.cert_advisories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  severity severity_type NOT NULL DEFAULT 'medium',
  iocs jsonb NOT NULL DEFAULT '{}'::jsonb,
  affected_sectors sector_type[] NOT NULL DEFAULT '{}',
  published_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

ALTER TABLE public.cert_advisories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ioc_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  advisory_id uuid REFERENCES public.cert_advisories(id) ON DELETE CASCADE NOT NULL,
  matched_ioc text NOT NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL NULL,
  detected_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'open'
);

CREATE INDEX idx_ioc_org ON public.ioc_matches(organization_id);
CREATE INDEX idx_ioc_status ON public.ioc_matches(status);
ALTER TABLE public.ioc_matches ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES — using existing has_role() function
-- =============================================

-- ORGANIZATIONS
CREATE POLICY "SuperAdmin full orgs" ON public.organizations FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin own org" ON public.organizations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = organizations.id));
CREATE POLICY "Analyst Auditor read orgs" ON public.organizations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role) OR has_role(auth.uid(), 'Auditor'::app_role));

-- ASSETS
CREATE POLICY "SuperAdmin full assets" ON public.assets FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin full own assets" ON public.assets FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = assets.organization_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = assets.organization_id));
CREATE POLICY "Analyst Auditor read assets" ON public.assets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role) OR has_role(auth.uid(), 'Auditor'::app_role));

-- SECURITY CHECKS
CREATE POLICY "SuperAdmin full sc" ON public.security_checks FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin read sc" ON public.security_checks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.assets a JOIN public.user_roles ur ON ur.org_id = a.organization_id WHERE a.id = security_checks.asset_id AND ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role));
CREATE POLICY "Analyst Auditor read sc" ON public.security_checks FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role) OR has_role(auth.uid(), 'Auditor'::app_role));

-- ALERTS
CREATE POLICY "SuperAdmin full alerts" ON public.alerts FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin alerts own org" ON public.alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = alerts.organization_id));
CREATE POLICY "Analyst full alerts" ON public.alerts FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read alerts" ON public.alerts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));

-- RISK HISTORY
CREATE POLICY "SuperAdmin full rh" ON public.risk_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin read rh" ON public.risk_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = risk_history.organization_id));
CREATE POLICY "Analyst Auditor read rh" ON public.risk_history FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role) OR has_role(auth.uid(), 'Auditor'::app_role));

-- THREAT EVENTS
CREATE POLICY "SuperAdmin full te" ON public.threat_events FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin read own te" ON public.threat_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = threat_events.organization_id));
CREATE POLICY "Analyst Auditor read te" ON public.threat_events FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role) OR has_role(auth.uid(), 'Auditor'::app_role));

-- METRICS TIMESERIES
CREATE POLICY "SuperAdmin full mt" ON public.metrics_timeseries FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin read own mt" ON public.metrics_timeseries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = metrics_timeseries.organization_id));
CREATE POLICY "Analyst Auditor read mt" ON public.metrics_timeseries FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role) OR has_role(auth.uid(), 'Auditor'::app_role));

-- ANOMALIES
CREATE POLICY "SuperAdmin full an" ON public.anomalies FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin read own an" ON public.anomalies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = anomalies.organization_id));
CREATE POLICY "Analyst full an" ON public.anomalies FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read an" ON public.anomalies FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));

-- COMPLIANCE FRAMEWORKS
CREATE POLICY "All auth read frameworks" ON public.compliance_frameworks FOR SELECT TO authenticated USING (true);
CREATE POLICY "SuperAdmin full frameworks" ON public.compliance_frameworks FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

-- CONTROLS
CREATE POLICY "All auth read controls" ON public.controls FOR SELECT TO authenticated USING (true);
CREATE POLICY "SuperAdmin full controls" ON public.controls FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

-- CONTROL RESULTS
CREATE POLICY "SuperAdmin full cr" ON public.control_results FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin read own cr" ON public.control_results FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = control_results.organization_id));
CREATE POLICY "Analyst full cr" ON public.control_results FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read cr" ON public.control_results FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));

-- INCIDENT REPORTS
CREATE POLICY "Public can insert incidents" ON public.incident_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "SuperAdmin full ir" ON public.incident_reports FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "OrgAdmin read own ir" ON public.incident_reports FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = incident_reports.organization_id));
CREATE POLICY "Analyst full ir" ON public.incident_reports FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read ir" ON public.incident_reports FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));

-- INCIDENT TIMELINE
CREATE POLICY "SuperAdmin full itl" ON public.incident_timeline FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
CREATE POLICY "Analyst full itl" ON public.incident_timeline FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read itl" ON public.incident_timeline FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));
CREATE POLICY "OrgAdmin read own itl" ON public.incident_timeline FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.incident_reports ir JOIN public.user_roles ur ON ur.org_id = ir.organization_id WHERE ir.id = incident_timeline.incident_id AND ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role));

-- CERT ADVISORIES
CREATE POLICY "All auth read advisories" ON public.cert_advisories FOR SELECT TO authenticated USING (true);
CREATE POLICY "SuperAdmin Analyst write advisories" ON public.cert_advisories FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role) OR has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role) OR has_role(auth.uid(), 'Analyst'::app_role));

-- IOC MATCHES
CREATE POLICY "SuperAdmin Analyst full ioc" ON public.ioc_matches FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role) OR has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role) OR has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "OrgAdmin read own ioc" ON public.ioc_matches FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin'::app_role AND ur.org_id = ioc_matches.organization_id));
CREATE POLICY "Auditor read ioc" ON public.ioc_matches FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));

-- USER ROLES: keep existing policies
