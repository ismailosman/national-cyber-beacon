const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SECURITY_HEADERS = [
  { key: 'strict-transport-security', name: 'strictTransportSecurity' },
  { key: 'content-security-policy', name: 'contentSecurityPolicy' },
  { key: 'x-frame-options', name: 'xFrameOptions' },
  { key: 'x-content-type-options', name: 'xContentTypeOptions' },
  { key: 'x-xss-protection', name: 'xXssProtection' },
  { key: 'referrer-policy', name: 'referrerPolicy' },
  { key: 'permissions-policy', name: 'permissionsPolicy' },
];

function getGrade(score: number): string {
  if (score === 7) return 'A';
  if (score >= 5) return 'B';
  if (score >= 3) return 'C';
  if (score >= 1) return 'D';
  return 'F';
}

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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'SomaliaCERT-EarlyWarning/1.0' },
          redirect: 'follow',
        });
        clearTimeout(timeout);

        const headers: Record<string, { present: boolean; value: string | null }> = {};
        let score = 0;

        for (const { key, name } of SECURITY_HEADERS) {
          const value = response.headers.get(key);
          headers[name] = { present: !!value, value };
          if (value) score++;
        }

        // Consume body to avoid resource leak
        await response.text();

        return {
          url,
          headers,
          score,
          maxScore: 7,
          grade: getGrade(score),
          error: null,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          url,
          headers: {},
          score: 0,
          maxScore: 7,
          grade: 'F',
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
