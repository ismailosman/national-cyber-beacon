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

    const emailDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    const HIBP_API_KEY = Deno.env.get('HIBP_API_KEY') || '';

    // ─── METHOD 1: HIBP Email Pattern Search (most accurate) ───
    if (HIBP_API_KEY) {
      const emailPrefixes = [
        'info', 'admin', 'contact', 'support', 'webmaster',
        'security', 'hr', 'office', 'mail', 'hello',
        'general', 'enquiry', 'communications', 'media', 'press',
      ];

      const allBreaches = new Map<string, any>();
      const checkedEmails: string[] = [];
      const breachedEmails: string[] = [];
      const errors: string[] = [];

      for (const prefix of emailPrefixes) {
        const email = `${prefix}@${emailDomain}`;
        checkedEmails.push(email);

        try {
          const res = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
            {
              headers: {
                'hibp-api-key': HIBP_API_KEY,
                'User-Agent': 'SomaliaCERT-Dashboard',
              },
              signal: AbortSignal.timeout(10000),
            }
          );

          if (res.status === 200) {
            const data = await res.json();
            breachedEmails.push(email);

            for (const b of data) {
              if (!allBreaches.has(b.Name)) {
                allBreaches.set(b.Name, {
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
                  isSpamList: b.IsSpamList,
                  isRetired: b.IsRetired,
                  affectedEmails: [email],
                });
              } else {
                const existing = allBreaches.get(b.Name);
                if (!existing.affectedEmails.includes(email)) {
                  existing.affectedEmails.push(email);
                }
              }
            }
          } else if (res.status === 404) {
            // Not found — clean for this email
          } else if (res.status === 429) {
            const retryAfter = parseInt(res.headers.get('retry-after') || '2');
            await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000));
            errors.push(`Rate limited on ${email}, skipped`);
          } else if (res.status === 401) {
            return new Response(JSON.stringify({
              success: false,
              error: 'HIBP API key is invalid. Please check your key.',
              checkedAt: new Date().toISOString(),
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          errors.push(`Failed to check ${email}: ${e.message}`);
        }

        // Rate limit: 1.5s between requests (HIBP Pwned 1 = 10 req/min)
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Filter out spam and retired, sort by date desc
      const breaches = Array.from(allBreaches.values())
        .filter(b => !b.isSpamList && !b.isRetired)
        .sort((a, b) => new Date(b.breachDate || 0).getTime() - new Date(a.breachDate || 0).getTime());

      const riskLevel = breaches.length > 5 ? 'high' : breaches.length > 2 ? 'medium' : breaches.length > 0 ? 'low' : 'info';

      return new Response(JSON.stringify({
        success: true,
        organization: organizationName || emailDomain,
        domain: emailDomain,
        source: 'HIBP Email Pattern Search',
        method: 'email_pattern_search',
        breachCount: breaches.length,
        breaches,
        isClean: breaches.length === 0,
        riskLevel,
        checkedEmails: checkedEmails.length,
        breachedEmails,
        breachedEmailCount: breachedEmails.length,
        errors: errors.length > 0 ? errors : undefined,
        checkedAt: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── METHOD 2: Free fallback — exact domain match ───
    let breaches: any[] = [];
    let note = '';
    const source = 'Free Breach Check (Exact Domain Match)';

    // A) HIBP public breach catalog
    try {
      const res = await fetch('https://haveibeenpwned.com/api/v3/breaches', {
        headers: { 'User-Agent': 'SomaliaCERT-Dashboard' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const allBreaches = await res.json();
        const domainMatches = allBreaches.filter((b: any) => {
          const bDomain = (b.Domain || '').toLowerCase();
          return bDomain === emailDomain || bDomain === `www.${emailDomain}`;
        });
        breaches.push(...domainMatches.map((b: any) => ({
          name: b.Name, title: b.Title, domain: b.Domain,
          breachDate: b.BreachDate, addedDate: b.AddedDate, pwnCount: b.PwnCount,
          dataClasses: b.DataClasses || [],
          description: (b.Description || '').replace(/<[^>]*>/g, '').slice(0, 300),
          isVerified: b.IsVerified, isSensitive: b.IsSensitive,
        })));
      }
    } catch (e) {
      console.error('HIBP public catalog error:', e);
    }

    // B) Mozilla Monitor
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
          name: b.Name, title: b.Title, domain: b.Domain,
          breachDate: b.BreachDate, addedDate: b.AddedDate, pwnCount: b.PwnCount,
          dataClasses: b.DataClasses || [],
          description: (b.Description || '').replace(/<[^>]*>/g, '').slice(0, 300),
          isVerified: b.IsVerified,
        })));
      }
    } catch {
      // Mozilla Monitor unavailable
    }

    if (breaches.length === 0) {
      note = 'No breaches found using free APIs. For comprehensive email-pattern breach search, add a HIBP API key ($3.50/month).';
    }

    // Deduplicate & sort
    const uniqueBreaches = breaches.filter((b: any, idx: number, self: any[]) =>
      idx === self.findIndex(t => t.name === b.name)
    );
    uniqueBreaches.sort((a: any, b: any) =>
      new Date(b.breachDate || 0).getTime() - new Date(a.breachDate || 0).getTime()
    );

    const riskLevel = uniqueBreaches.length > 5 ? 'high' : uniqueBreaches.length > 2 ? 'medium' : uniqueBreaches.length > 0 ? 'low' : 'info';

    return new Response(JSON.stringify({
      success: true,
      organization: organizationName || emailDomain,
      domain: emailDomain,
      source,
      method: 'free_domain_match',
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
