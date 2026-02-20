import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orgTechnologies: string[] = body.orgTechnologies || [];

    const techKeywords = [
      'nginx', 'apache', 'php', 'wordpress', 'postgresql', 'node.js', 'react',
      'jquery', 'iis', 'cpanel', 'plesk', 'joomla', 'drupal', 'tomcat'
    ];

    // Source 1: CISA KEV
    let cisaKEV: any[] = [];
    try {
      const cisaRes = await fetchWithTimeout('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
      if (cisaRes.ok) {
        const cisaData = await cisaRes.json();
        const vulns = cisaData.vulnerabilities || [];
        cisaKEV = vulns
          .sort((a: any, b: any) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
          .slice(0, 30)
          .map((v: any) => {
            const combined = `${(v.vendorProject || '').toLowerCase()} ${(v.product || '').toLowerCase()}`;
            const affectsOurOrgs = orgTechnologies.some(t => combined.includes(t.toLowerCase()));
            return {
              cveID: v.cveID, vulnerabilityName: v.vulnerabilityName,
              vendorProject: v.vendorProject, product: v.product,
              dateAdded: v.dateAdded, shortDescription: v.shortDescription,
              requiredAction: v.requiredAction, dueDate: v.dueDate, affectsOurOrgs,
            };
          });
      }
    } catch (e) { console.error('CISA KEV fetch error:', e); }

    // Source 2: URLhaus with GET fallback
    let maliciousUrls: any[] = [];
    try {
      let urlhausRes = await fetchWithTimeout('https://urlhaus-api.abuse.ch/v1/urls/recent/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'limit=50',
      });
      if (!urlhausRes.ok) {
        urlhausRes = await fetchWithTimeout('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/');
      }
      if (urlhausRes.ok) {
        const urlhausData = await urlhausRes.json();
        maliciousUrls = (urlhausData.urls || [])
          .slice(0, 30)
          .map((u: any) => ({
            source: 'URLhaus',
            url: u.url, threat: u.threat || 'malware', host: u.host,
            dateAdded: u.date_added, status: u.url_status,
            tags: u.tags || [],
            targetsSomalia: (u.url || '').toLowerCase().includes('.so/') || (u.url || '').toLowerCase().includes('.so:'),
            severity: u.threat === 'malware_download' ? 'high' : 'medium',
          }));
      }
    } catch (e) { console.error('URLhaus fetch error:', e); }

    // Source 3: NVD CVEs
    let latestCVEs: any[] = [];
    try {
      const nvdRes = await fetchWithTimeout('https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20');
      if (nvdRes.ok) {
        const nvdData = await nvdRes.json();
        latestCVEs = (nvdData.vulnerabilities || [])
          .map((v: any) => {
            const cve = v.cve || {};
            const metrics = cve.metrics || {};
            const cvssData = metrics.cvssMetricV31?.[0]?.cvssData || metrics.cvssMetricV30?.[0]?.cvssData || {};
            const score = cvssData.baseScore || 0;
            const desc = (cve.descriptions || []).find((d: any) => d.lang === 'en')?.value || '';
            const affectsTech = techKeywords.some(k => desc.toLowerCase().includes(k));
            return {
              cveID: cve.id, description: desc.slice(0, 300), score,
              severity: score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low',
              published: cve.published, affectsTech,
            };
          })
          .filter((c: any) => c.score >= 7);
      }
    } catch (e) { console.error('NVD fetch error:', e); }

    // Source 4: Feodo Tracker C2 servers
    let feodoC2: any[] = [];
    try {
      const feodoRes = await fetchWithTimeout('https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json');
      if (feodoRes.ok) {
        const feodoData = await feodoRes.json();
        feodoC2 = (feodoData || []).slice(0, 20).map((entry: any) => ({
          source: 'Feodo Tracker',
          ipAddress: entry.ip_address,
          port: entry.port,
          malware: entry.malware,
          firstSeen: entry.first_seen,
          lastOnline: entry.last_online,
          country: entry.country,
          severity: 'high',
        }));
      }
    } catch (e) { console.error('Feodo Tracker fetch error:', e); }

    return new Response(JSON.stringify({
      cisaKEV, maliciousUrls, latestCVEs, feodoC2,
      fetchedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('fetch-threat-intel error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
