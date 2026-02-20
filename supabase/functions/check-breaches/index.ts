import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RELEVANT_SERVICES = [
  'adobe', 'linkedin', 'dropbox', 'canva', 'facebook', 'twitter',
  'yahoo', 'gmail', 'outlook', 'hotmail', 'zoom', 'slack',
  'trello', 'mailchimp', 'hubspot', 'godaddy', 'namecheap',
  'cpanel', 'plesk', 'wordpress', 'joomla', 'drupal',
  'cloudflare', 'google', 'microsoft', 'nginx', 'apache',
  'php', 'mysql', 'postgresql', 'mongodb'
];

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
    const { domains, orgTechnologies } = await req.json();
    if (!domains || !Array.isArray(domains)) {
      return new Response(JSON.stringify({ error: 'domains array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the full HIBP breach catalog
    let allBreaches: any[] = [];
    try {
      const res = await fetchWithTimeout('https://haveibeenpwned.com/api/v3/breaches', {
        headers: { 'User-Agent': 'SomaliaCERT-Dashboard' },
      });
      if (res.ok) {
        allBreaches = await res.json();
      }
    } catch (e) {
      console.error('HIBP fetch error:', e);
    }

    // Get significant recent breaches (last 2 years, >10k records)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const recentGlobalBreaches = allBreaches
      .filter((b: any) => new Date(b.BreachDate) > twoYearsAgo && b.PwnCount > 10000)
      .sort((a: any, b: any) => new Date(b.BreachDate).getTime() - new Date(a.BreachDate).getTime())
      .slice(0, 50)
      .map((b: any) => ({
        name: b.Name, title: b.Title, domain: b.Domain,
        breachDate: b.BreachDate, addedDate: b.AddedDate,
        pwnCount: b.PwnCount, dataClasses: b.DataClasses || [],
        description: (b.Description || '').replace(/<[^>]*>/g, '').slice(0, 200),
        isVerified: b.IsVerified, isSensitive: b.IsSensitive,
      }));

    // Build tech-matching set from org technologies
    const techSet = new Set((orgTechnologies || []).map((t: string) => t.toLowerCase()));

    const results = [];

    for (const domainEntry of domains) {
      const domain = typeof domainEntry === 'string' ? domainEntry : domainEntry.domain;
      const orgName = typeof domainEntry === 'string' ? domain : domainEntry.name;

      // Match breaches by exact service name against org tech stack + relevant services
      const relevantBreaches = recentGlobalBreaches.filter((b: any) => {
        const bDomain = (b.domain || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        // Check if breach domain/name matches any detected technology or relevant service
        return RELEVANT_SERVICES.some(service => bDomain.includes(service) || bName.includes(service)) ||
          [...techSet].some(tech => bDomain.includes(tech) || bName.includes(tech));
      });

      results.push({
        domain, organization: orgName,
        breachesFound: relevantBreaches.length,
        breaches: relevantBreaches,
        allRecentBreaches: recentGlobalBreaches,
        riskLevel: relevantBreaches.length > 5 ? 'high' : relevantBreaches.length > 2 ? 'medium' : 'low',
        checkedAt: new Date().toISOString(),
        note: 'Breach data shows services that were breached which this organization may use. Direct domain breach search requires HIBP enterprise API key.',
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
