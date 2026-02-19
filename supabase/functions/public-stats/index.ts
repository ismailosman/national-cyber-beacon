import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Count open alerts by severity
    const { data: alertsBySeverity, error: sevErr } = await supabase
      .from('alerts')
      .select('severity')
      .eq('status', 'open');

    if (sevErr) throw sevErr;

    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of (alertsBySeverity ?? [])) {
      const sev = row.severity as keyof typeof severityCounts;
      if (sev in severityCounts) severityCounts[sev]++;
    }

    // Count open alerts by region (via org join) — aggregated only, no org names
    const { data: alertsByRegion, error: regErr } = await supabase
      .from('alerts')
      .select('organizations(region), severity')
      .eq('status', 'open');

    if (regErr) throw regErr;

    const regionData: Record<string, { count: number; dominant: string; counts: Record<string, number> }> = {};

    for (const row of (alertsByRegion ?? [])) {
      const org = row.organizations as { region: string } | null;
      if (!org?.region) continue;
      const region = org.region;
      const sev = row.severity as string;

      if (!regionData[region]) {
        regionData[region] = { count: 0, dominant: 'low', counts: { critical: 0, high: 0, medium: 0, low: 0 } };
      }
      regionData[region].count++;
      if (sev in regionData[region].counts) {
        regionData[region].counts[sev]++;
      }
    }

    // Determine dominant severity per region
    const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    for (const region of Object.keys(regionData)) {
      let dominant = 'low';
      let maxRank = 0;
      for (const [sev, cnt] of Object.entries(regionData[region].counts)) {
        if (cnt > 0 && (SEV_RANK[sev] ?? 0) > maxRank) {
          maxRank = SEV_RANK[sev];
          dominant = sev;
        }
      }
      regionData[region].dominant = dominant;
    }

    // Count total monitored orgs
    const { count: orgCount, error: orgErr } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true });

    if (orgErr) throw orgErr;

    const totalAlerts = Object.values(severityCounts).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({
        severity_counts: severityCounts,
        region_stats: regionData,
        total_orgs: orgCount ?? 0,
        total_open_alerts: totalAlerts,
        updated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
