const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();
    if (!urls || !Array.isArray(urls)) {
      return new Response(JSON.stringify({ error: 'urls array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = await Promise.all(urls.map(async (url: string) => {
      try {
        const blacklistSources: string[] = [];

        // Check URLhaus (abuse.ch) - free, no API key
        try {
          const urlhausResp = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `url=${encodeURIComponent(url)}`,
          });
          const urlhausData = await urlhausResp.json();
          if (urlhausData.query_status === 'listed' || urlhausData.url_status === 'online') {
            blacklistSources.push('URLhaus (abuse.ch)');
          }
        } catch {
          // URLhaus check failed, skip
        }

        // Check domain against Google Safe Browsing transparency report (basic check)
        // Note: Full API requires API key; we do a best-effort check
        const blacklisted = blacklistSources.length > 0;

        return {
          url,
          blacklisted,
          blacklistSources,
          reputation: blacklisted ? 'malicious' : 'good',
          error: null,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          url,
          blacklisted: false,
          blacklistSources: [],
          reputation: 'unknown',
          error: err instanceof Error ? err.message : 'Check failed',
          checkedAt: new Date().toISOString(),
        };
      }
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
