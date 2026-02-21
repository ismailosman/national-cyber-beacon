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

const CLOUDFLARE_MANAGED_HEADERS = new Set([
  'contentSecurityPolicy',
  'xFrameOptions',
  'permissionsPolicy',
]);

function getGrade(score: number): string {
  if (score === 7) return 'A';
  if (score >= 5) return 'B';
  if (score >= 3) return 'C';
  if (score >= 1) return 'D';
  return 'F';
}

function classifyError(err: unknown): { error_type: string; error_message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('abort') || lower.includes('timeout') || lower.includes('timed out'))
    return { error_type: 'CONNECTION_TIMEOUT', error_message: `Request timed out: ${msg}` };
  if (lower.includes('dns') || lower.includes('getaddrinfo') || lower.includes('resolve'))
    return { error_type: 'DNS_FAILED', error_message: `DNS resolution failed: ${msg}` };
  if (lower.includes('ssl') || lower.includes('tls') || lower.includes('cert'))
    return { error_type: 'SSL_ERROR', error_message: `SSL/TLS error: ${msg}` };
  if (lower.includes('refused') || lower.includes('econnrefused'))
    return { error_type: 'CONNECTION_REFUSED', error_message: `Connection refused: ${msg}` };
  return { error_type: 'UNKNOWN', error_message: msg };
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
        const timeout = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'SomaliaCERT-EarlyWarning/1.0' },
          redirect: 'follow',
        });
        clearTimeout(timeout);

        // Detect Cloudflare
        const serverHeader = response.headers.get('server') ?? '';
        const cfRay = response.headers.get('cf-ray');
        const isCloudflare = serverHeader.toLowerCase().includes('cloudflare') || !!cfRay;

        const headers: Record<string, { present: boolean; value: string | null; managed?: boolean }> = {};
        let score = 0;

        for (const { key, name } of SECURITY_HEADERS) {
          const value = response.headers.get(key);
          if (value) {
            headers[name] = { present: true, value };
            score++;
          } else if (isCloudflare && CLOUDFLARE_MANAGED_HEADERS.has(name)) {
            headers[name] = { present: true, value: 'Managed by WAF', managed: true };
            score++;
          } else {
            headers[name] = { present: false, value: null };
          }
        }

        await response.text();

        return {
          url, success: true, headers, score, maxScore: 7, grade: getGrade(score),
          isCloudflare,
          error: null, checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        const classified = classifyError(err);
        return {
          url, success: false, headers: {}, score: 0, maxScore: 7, grade: 'F',
          error: classified.error_type, errorMessage: classified.error_message,
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
