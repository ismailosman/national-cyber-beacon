import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DdosProtection {
  hasCDN: boolean;
  cdnProvider: string | null;
  hasRateLimiting: boolean;
  hasWAF: boolean;
  originExposed: boolean;
  protectionHeaders: string[];
  serverHeader: string | null;
  checkedAt: string;
}

async function checkUrl(url: string): Promise<{ url: string; ddosProtection: DdosProtection }> {
  const result: DdosProtection = {
    hasCDN: false,
    cdnProvider: null,
    hasRateLimiting: false,
    hasWAF: false,
    originExposed: true,
    protectionHeaders: [],
    serverHeader: null,
    checkedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DDoSMonitor/1.0)' },
    });
    clearTimeout(timeout);

    const headers: Record<string, string> = {};
    resp.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    // Consume body
    await resp.text();

    result.serverHeader = headers['server'] || null;

    // Cloudflare
    if (headers['cf-ray'] || headers['server']?.toLowerCase().includes('cloudflare')) {
      result.hasCDN = true;
      result.cdnProvider = 'Cloudflare';
      result.protectionHeaders.push('cf-ray');
    }
    // AWS CloudFront/Shield
    if (headers['x-amz-cf-id'] || headers['x-amz-cf-pop']) {
      result.hasCDN = true;
      result.cdnProvider = result.cdnProvider || 'AWS CloudFront';
      result.protectionHeaders.push('x-amz-cf-id');
    }
    // Akamai
    if (headers['x-akamai-request-id']) {
      result.hasCDN = true;
      result.cdnProvider = result.cdnProvider || 'Akamai';
      result.protectionHeaders.push('x-akamai-request-id');
    }
    // Fastly
    if (headers['x-served-by'] || headers['x-fastly-request-id']) {
      result.hasCDN = true;
      result.cdnProvider = result.cdnProvider || 'Fastly';
      result.protectionHeaders.push('x-fastly-request-id');
    }
    // Sucuri
    if (headers['x-sucuri-id']) {
      result.hasCDN = true;
      result.cdnProvider = result.cdnProvider || 'Sucuri';
      result.protectionHeaders.push('x-sucuri-id');
    }
    // Generic CDN
    if (headers['x-cdn'] || headers['x-cache']) {
      if (!result.hasCDN) {
        result.hasCDN = true;
        result.cdnProvider = result.cdnProvider || 'CDN Detected';
      }
      if (headers['x-cdn']) result.protectionHeaders.push('x-cdn');
      if (headers['x-cache']) result.protectionHeaders.push('x-cache');
    }

    // Rate limiting
    const rlHeaders = Object.keys(headers).filter(k => k.startsWith('x-ratelimit') || k === 'retry-after');
    if (rlHeaders.length > 0) {
      result.hasRateLimiting = true;
      result.protectionHeaders.push(...rlHeaders);
    }

    // WAF
    const wafIndicators = ['x-waf-status', 'x-firewall', 'x-sucuri-block'];
    for (const w of wafIndicators) {
      if (headers[w]) {
        result.hasWAF = true;
        result.protectionHeaders.push(w);
      }
    }
    // Cloudflare WAF implied
    if (result.cdnProvider === 'Cloudflare') result.hasWAF = true;

    // Origin exposed = no CDN
    result.originExposed = !result.hasCDN;

  } catch {
    // Request failed - leave defaults (no protection detected)
  }

  return { url, ddosProtection: result };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const urls: string[] = body.urls || (body.url ? [body.url] : []);

    if (urls.length === 0) {
      return new Response(JSON.stringify({ error: 'No URLs provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.all(urls.map(checkUrl));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
