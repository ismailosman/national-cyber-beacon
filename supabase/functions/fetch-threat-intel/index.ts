import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Fetch CISA KEV
    let cisaKEV: any[] = [];
    try {
      const cisaRes = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
      if (cisaRes.ok) {
        const cisaData = await cisaRes.json();
        const vulns = cisaData.vulnerabilities || [];
        cisaKEV = vulns.slice(-50).reverse().map((v: any) => {
          const vendorLower = (v.vendorProject || '').toLowerCase();
          const productLower = (v.product || '').toLowerCase();
          const combined = `${vendorLower} ${productLower}`;
          const affectsOurOrgs = orgTechnologies.some(t => combined.includes(t.toLowerCase()));
          return {
            cveID: v.cveID,
            vulnerabilityName: v.vulnerabilityName,
            vendorProject: v.vendorProject,
            product: v.product,
            dateAdded: v.dateAdded,
            shortDescription: v.shortDescription,
            requiredAction: v.requiredAction,
            dueDate: v.dueDate,
            affectsOurOrgs,
          };
        });
      }
    } catch (e) {
      console.error('CISA KEV fetch error:', e);
    }

    // Fetch URLhaus
    let maliciousUrls: any[] = [];
    try {
      const urlhausRes = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'limit=50',
      });
      if (urlhausRes.ok) {
        const urlhausData = await urlhausRes.json();
        const urls = urlhausData.urls || [];
        maliciousUrls = urls
          .filter((u: any) => {
            const url = (u.url || '').toLowerCase();
            return url.includes('.so') || url.includes('somalia');
          })
          .slice(0, 20)
          .map((u: any) => ({
            url: u.url,
            threat: u.threat || 'unknown',
            targetsSomalia: true,
            dateAdded: u.date_added,
            status: u.url_status,
          }));
      }
    } catch (e) {
      console.error('URLhaus fetch error:', e);
    }

    // Fetch NVD
    let latestCVEs: any[] = [];
    try {
      const nvdRes = await fetch('https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20');
      if (nvdRes.ok) {
        const nvdData = await nvdRes.json();
        const vulns = nvdData.vulnerabilities || [];
        latestCVEs = vulns
          .map((v: any) => {
            const cve = v.cve || {};
            const metrics = cve.metrics || {};
            const cvssData = metrics.cvssMetricV31?.[0]?.cvssData || metrics.cvssMetricV30?.[0]?.cvssData || {};
            const score = cvssData.baseScore || 0;
            const desc = (cve.descriptions || []).find((d: any) => d.lang === 'en')?.value || '';
            const descLower = desc.toLowerCase();
            const affectsTech = techKeywords.some(k => descLower.includes(k));
            return {
              cveID: cve.id,
              description: desc.slice(0, 300),
              score,
              severity: score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low',
              published: cve.published,
              affectsTech,
            };
          })
          .filter((c: any) => c.score >= 7);
      }
    } catch (e) {
      console.error('NVD fetch error:', e);
    }

    return new Response(JSON.stringify({
      cisaKEV,
      maliciousUrls,
      latestCVEs,
      fetchedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('fetch-threat-intel error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
