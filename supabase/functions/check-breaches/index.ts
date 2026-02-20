import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, organizationName } = await req.json();

    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: 'domain is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract email domain from URL
    const emailDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();

    const HIBP_API_KEY = Deno.env.get('HIBP_API_KEY') || '';
    let breaches: any[] = [];
    let source = '';
    let note = '';

    if (HIBP_API_KEY) {
      // METHOD 1: HIBP domain search (most accurate)
      source = 'Have I Been Pwned (Domain Search)';
      try {
        const res = await fetch(
          `https://haveibeenpwned.com/api/v3/breaches?domain=${emailDomain}`,
          {
            headers: {
              'hibp-api-key': HIBP_API_KEY,
              'User-Agent': 'SomaliaCERT-Dashboard',
            },
            signal: AbortSignal.timeout(15000),
          }
        );
        if (res.status === 200) {
          const data = await res.json();
          breaches = data.map((b: any) => ({
            name: b.Name,
            title: b.Title,
            domain: b.Domain,
            breachDate: b.BreachDate,
            addedDate: b.AddedDate,
            pwnCount: b.PwnCount,
            dataClasses: b.DataClasses || [],
            description: (b.Description || '').replace(/<[^>]*>/g, ''),
            isVerified: b.IsVerified,
            isSensitive: b.IsSensitive,
          }));
        } else if (res.status === 404) {
          breaches = []; // No breaches — good
        } else if (res.status === 429) {
          note = 'Rate limited by HIBP API. Will retry on next check.';
        }
      } catch (e) {
        console.error('HIBP domain search error:', e);
        note = 'HIBP API request failed. Using free fallback.';
      }
    }

    // METHOD 2: Free fallback — exact domain match against HIBP public catalog + Mozilla Monitor
    if (!HIBP_API_KEY || (breaches.length === 0 && !note)) {
      source = source || 'Free Breach Check (Exact Domain Match)';

      // A) HIBP public breach catalog — exact domain match only
      try {
        const res = await fetch('https://haveibeenpwned.com/api/v3/breaches', {
          headers: { 'User-Agent': 'SomaliaCERT-Dashboard' },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const allBreaches = await res.json();
          const domainMatches = allBreaches.filter((b: any) => {
            const bDomain = (b.Domain || '').toLowerCase();
            // Exact domain match only — no fuzzy/keyword matching
            return bDomain === emailDomain || bDomain === `www.${emailDomain}`;
          });
          breaches.push(...domainMatches.map((b: any) => ({
            name: b.Name,
            title: b.Title,
            domain: b.Domain,
            breachDate: b.BreachDate,
            addedDate: b.AddedDate,
            pwnCount: b.PwnCount,
            dataClasses: b.DataClasses || [],
            description: (b.Description || '').replace(/<[^>]*>/g, '').slice(0, 300),
            isVerified: b.IsVerified,
            isSensitive: b.IsSensitive,
          })));
        }
      } catch (e) {
        console.error('HIBP public catalog error:', e);
      }

      // B) Mozilla Monitor breach list — exact domain match
      try {
        const res = await fetch('https://monitor.mozilla.org/api/v1/breaches', {
          headers: { 'User-Agent': 'SomaliaCERT-Dashboard' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const mozData = await res.json();
          const matches = (mozData || []).filter((b: any) => {
            const bDomain = (b.Domain || '').toLowerCase();
            return bDomain === emailDomain || bDomain === `www.${emailDomain}`;
          });
          breaches.push(...matches.map((b: any) => ({
            name: b.Name,
            title: b.Title,
            domain: b.Domain,
            breachDate: b.BreachDate,
            addedDate: b.AddedDate,
            pwnCount: b.PwnCount,
            dataClasses: b.DataClasses || [],
            description: (b.Description || '').replace(/<[^>]*>/g, '').slice(0, 300),
            isVerified: b.IsVerified,
          })));
        }
      } catch {
        // Mozilla Monitor unavailable
      }

      if (breaches.length === 0 && !note) {
        note = 'No breaches found using free APIs. For comprehensive domain-specific breach search, add a HIBP API key ($3.50/month).';
      }
    }

    // Deduplicate by name
    const uniqueBreaches = breaches.filter((b: any, idx: number, self: any[]) =>
      idx === self.findIndex(t => t.name === b.name)
    );

    // Sort by date descending
    uniqueBreaches.sort((a: any, b: any) =>
      new Date(b.breachDate || 0).getTime() - new Date(a.breachDate || 0).getTime()
    );

    const riskLevel = uniqueBreaches.length > 5 ? 'high' : uniqueBreaches.length > 2 ? 'medium' : uniqueBreaches.length > 0 ? 'low' : 'info';

    return new Response(JSON.stringify({
      success: true,
      organization: organizationName || emailDomain,
      domain: emailDomain,
      source,
      breachCount: uniqueBreaches.length,
      breaches: uniqueBreaches,
      isClean: uniqueBreaches.length === 0,
      riskLevel,
      note,
      checkedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      checkedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
