
-- =============================================
-- Somalia Cyber Defense Observatory Schema
-- =============================================

-- 1. App role enum
CREATE TYPE public.app_role AS ENUM ('SuperAdmin', 'OrgAdmin', 'Analyst', 'Auditor');

-- 2. Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector TEXT NOT NULL CHECK (sector IN ('Government', 'Bank')),
  domain TEXT NOT NULL UNIQUE,
  risk_score INTEGER DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
  status TEXT NOT NULL DEFAULT 'Warning' CHECK (status IN ('Secure', 'Warning', 'Critical')),
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Security checks table
CREATE TABLE public.security_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN ('ssl', 'https', 'headers', 'dns', 'uptime')),
  result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'warn')),
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Risk score history
CREATE TABLE public.risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  UNIQUE (user_id, role)
);

-- =============================================
-- Security Definer function for role check
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is at least Analyst (can read)
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies: organizations
-- =============================================
-- SuperAdmin: full access
CREATE POLICY "SuperAdmin full access to organizations"
  ON public.organizations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SuperAdmin'))
  WITH CHECK (public.has_role(auth.uid(), 'SuperAdmin'));

-- OrgAdmin: read/write their org
CREATE POLICY "OrgAdmin access their organization"
  ON public.organizations FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin' AND ur.org_id = organizations.id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin' AND ur.org_id = organizations.id
  ));

-- Analyst and Auditor: read only
CREATE POLICY "Analyst read organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'Analyst') OR public.has_role(auth.uid(), 'Auditor'));

-- =============================================
-- RLS Policies: security_checks
-- =============================================
CREATE POLICY "SuperAdmin full access to security_checks"
  ON public.security_checks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SuperAdmin'))
  WITH CHECK (public.has_role(auth.uid(), 'SuperAdmin'));

CREATE POLICY "OrgAdmin access their security_checks"
  ON public.security_checks FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin' AND ur.org_id = security_checks.org_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin' AND ur.org_id = security_checks.org_id
  ));

CREATE POLICY "Analyst and Auditor read security_checks"
  ON public.security_checks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'Analyst') OR public.has_role(auth.uid(), 'Auditor'));

-- =============================================
-- RLS Policies: alerts
-- =============================================
CREATE POLICY "SuperAdmin full access to alerts"
  ON public.alerts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SuperAdmin'))
  WITH CHECK (public.has_role(auth.uid(), 'SuperAdmin'));

CREATE POLICY "OrgAdmin access their alerts"
  ON public.alerts FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin' AND ur.org_id = alerts.org_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin' AND ur.org_id = alerts.org_id
  ));

CREATE POLICY "Analyst and Auditor read alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'Analyst') OR public.has_role(auth.uid(), 'Auditor'));

-- =============================================
-- RLS Policies: risk_score_history
-- =============================================
CREATE POLICY "SuperAdmin full access to risk_score_history"
  ON public.risk_score_history FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SuperAdmin'))
  WITH CHECK (public.has_role(auth.uid(), 'SuperAdmin'));

CREATE POLICY "OrgAdmin access their risk_score_history"
  ON public.risk_score_history FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin' AND ur.org_id = risk_score_history.org_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'OrgAdmin' AND ur.org_id = risk_score_history.org_id
  ));

CREATE POLICY "Analyst and Auditor read risk_score_history"
  ON public.risk_score_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'Analyst') OR public.has_role(auth.uid(), 'Auditor'));

-- =============================================
-- RLS Policies: user_roles
-- =============================================
CREATE POLICY "SuperAdmin full access to user_roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SuperAdmin'))
  WITH CHECK (public.has_role(auth.uid(), 'SuperAdmin'));

CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- Updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Enable realtime for key tables
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_score_history;
