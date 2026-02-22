
CREATE TABLE public.geo_allowed_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  country_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.geo_allowed_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read geo_allowed_countries"
ON public.geo_allowed_countries FOR SELECT TO authenticated
USING (true);

CREATE POLICY "SuperAdmin manage geo_allowed_countries"
ON public.geo_allowed_countries FOR ALL TO authenticated
USING (has_role(auth.uid(), 'SuperAdmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));

INSERT INTO public.geo_allowed_countries (country_code, country_name) VALUES
  ('US', 'United States'),
  ('SO', 'Somalia');
