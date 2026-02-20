const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFACEMENT_KEYWORDS = [
  'hacked by', 'defaced by', 'owned by', 'greetz', 'cyber army',
  'team poison', 'anonymous', 'h4x0r', 'pwned', 'was here',
  'hacked!', 'you have been hacked', 'this site has been hacked',
  'cyber warriors', 'hacktivism', 'security breach',
];

function stripDynamicContent(html: string): string {
  let cleaned = html;
  // Remove CSRF tokens
  cleaned = cleaned.replace(/name="csrf[^"]*"\s*value="[^"]*"/gi, '');
  cleaned = cleaned.replace(/name="_token"\s*value="[^"]*"/gi, '');
  // Remove nonces
  cleaned = cleaned.replace(/nonce="[^"]*"/gi, '');
  // Remove session IDs
  cleaned = cleaned.replace(/PHPSESSID=[^;&"]*/gi, '');
  cleaned = cleaned.replace(/JSESSIONID=[^;&"]*/gi, '');
  // Remove timestamps that change on every load
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '');
  // Remove inline scripts (they often contain dynamic data)
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  return cleaned.trim();
}

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
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

    const results = await Promise.all(urls.map(async (item: any) => {
      const { url, baselineHash, baselineTitle, baselineSize } = item;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'SomaliaCERT-EarlyWarning/1.0' }
        });
        clearTimeout(timeout);

        const html = await response.text();
        const cleaned = stripDynamicContent(html);
        const currentHash = await computeHash(cleaned);
        const currentTitle = extractTitle(html);
        const currentSize = html.length;

        const hashChanged = baselineHash ? currentHash !== baselineHash : false;
        const titleChanged = baselineTitle ? currentTitle.toLowerCase() !== baselineTitle.toLowerCase() : false;
        const sizeAnomaly = baselineSize
          ? Math.abs(currentSize - baselineSize) / baselineSize > 0.7
          : false;

        const htmlLower = html.toLowerCase();
        const defacementKeywordsFound = DEFACEMENT_KEYWORDS.filter(kw => htmlLower.includes(kw));
        const isDefaced = defacementKeywordsFound.length > 0 || (hashChanged && (titleChanged || sizeAnomaly));

        return {
          url,
          currentHash,
          currentTitle,
          currentSize,
          hashChanged,
          titleChanged,
          sizeAnomaly,
          defacementKeywordsFound,
          isDefaced,
          error: null,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          url,
          currentHash: null, currentTitle: null, currentSize: null,
          hashChanged: false, titleChanged: false, sizeAnomaly: false,
          defacementKeywordsFound: [], isDefaced: false,
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
