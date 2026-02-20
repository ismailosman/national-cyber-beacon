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
    const { domains } = await req.json();
    if (!domains || !Array.isArray(domains)) {
      return new Response(JSON.stringify({ error: 'domains array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let allBreaches: any[] = [];
    try {
      const res = await fetchWithTimeout('https://haveibeenpwned.com/api/v3/breaches', {
        headers: { 'User-Agent': 'SecurityDashboard' },
      });
      if (res.ok) {
        allBreaches = await res.json();
      }
    } catch (e) {
      console.error('HIBP fetch error:', e);
    }

    const results = [];

    for (const domainEntry of domains) {
      const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
      const orgName = typeof domainEntry === 'string' ? domain : domainEntry.name;

      const matched = allBreaches.filter((b: any) => {
        const bDomain = (b.Domain || '').toLowerCase();
        return bDomain && domain.toLowerCase().includes(bDomain.split('.')[0]);
      });

      const sectorBreaches = allBreaches
        .filter((b: any) => {
          const desc = (b.Description || '').toLowerCase();
          return desc.includes('government') || desc.includes('bank') || desc.includes('telecom') || desc.includes('somalia');
        })
        .slice(0, 5);

      const combinedBreaches = [...matched, ...sectorBreaches]
        .filter((b, i, arr) => arr.findIndex(x => x.Name === b.Name) === i)
        .slice(0, 10)
        .map((b: any) => ({
          name: b.Name, title: b.Title, date: b.BreachDate,
          recordCount: b.PwnCount, dataTypes: b.DataClasses || [],
          description: (b.Description || '').replace(/<[^>]*>/g, '').slice(0, 200),
          isVerified: b.IsVerified,
        }));

      results.push({
        domain, organization: orgName, breachesFound: combinedBreaches.length,
        breaches: combinedBreaches, checkedAt: new Date().toISOString(),
        note: 'Full domain-specific breach search requires a paid HIBP API key. Showing publicly known breaches relevant to your sector.',
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
