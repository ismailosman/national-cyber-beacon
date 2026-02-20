import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateVariations(domain: string): string[] {
  const parts = domain.split('.');
  const name = parts[0];
  const rest = parts.slice(1).join('.');
  const variations: Set<string> = new Set();

  // Letter substitutions
  const subs: Record<string, string[]> = { o: ['0'], l: ['1'], i: ['1', 'l'], a: ['@'], e: ['3'], s: ['5'] };
  for (let i = 0; i < name.length; i++) {
    const ch = name[i].toLowerCase();
    if (subs[ch]) {
      for (const s of subs[ch]) {
        variations.add(name.slice(0, i) + s + name.slice(i + 1) + '.' + rest);
      }
    }
  }

  // Missing letter
  for (let i = 0; i < name.length; i++) {
    variations.add(name.slice(0, i) + name.slice(i + 1) + '.' + rest);
  }

  // Double letter
  for (let i = 0; i < name.length; i++) {
    variations.add(name.slice(0, i) + name[i] + name[i] + name.slice(i + 1) + '.' + rest);
  }

  // Hyphenated
  for (let i = 1; i < name.length; i++) {
    variations.add(name.slice(0, i) + '-' + name.slice(i) + '.' + rest);
  }

  // Different TLDs
  const tlds = ['com', 'net', 'org', 'io', 'info'];
  for (const tld of tlds) {
    if (!domain.endsWith('.' + tld)) {
      variations.add(name + '.' + tld);
    }
  }

  variations.delete(domain);
  return Array.from(variations).slice(0, 15);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizations } = await req.json();
    if (!organizations || !Array.isArray(organizations)) {
      return new Response(JSON.stringify({ error: 'organizations array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const org of organizations) {
      const domain = org.domain || '';
      if (!domain) continue;

      const variations = generateVariations(domain);
      const lookalikeDomains = [];

      for (const v of variations) {
        try {
          const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(v)}&type=A`);
          const dnsData = await dnsRes.json();
          const exists = (dnsData.Answer || []).length > 0;
          const ip = exists ? (dnsData.Answer[0]?.data || null) : null;

          let hasWebsite = false;
          if (exists) {
            try {
              const webRes = await fetch(`http://${v}`, { method: 'HEAD', redirect: 'manual' });
              hasWebsite = webRes.status < 500;
            } catch { /* no website */ }
          }

          if (exists) {
            lookalikeDomains.push({
              domain: v,
              exists,
              ip,
              hasWebsite,
              risk: hasWebsite ? 'high' : 'medium',
            });
          }
        } catch { /* skip this variation */ }
      }

      results.push({
        organization: org.name,
        organizationId: org.id,
        domain,
        lookalikeDomains,
        totalFound: lookalikeDomains.length,
        checkedAt: new Date().toISOString(),
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
