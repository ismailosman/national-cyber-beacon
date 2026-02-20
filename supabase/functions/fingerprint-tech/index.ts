import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();
    if (!urls || !Array.isArray(urls)) {
      return new Response(JSON.stringify({ error: 'urls array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)' },
          redirect: 'follow',
        });
        clearTimeout(timeout);

        const headers = res.headers;
        const html = await res.text();
        const htmlLower = html.toLowerCase();

        // Server
        const serverHeader = headers.get('server') || '';
        const serverParts = serverHeader.match(/^([a-zA-Z-]+)\/?(.*)$/);
        const webServer = serverParts ? serverParts[1] : serverHeader || null;
        const webServerVersion = serverParts?.[2] || null;

        // Language
        const poweredBy = headers.get('x-powered-by') || '';
        const langParts = poweredBy.match(/^([a-zA-Z.]+)\/?(.*)$/);
        const language = langParts ? langParts[1] : (poweredBy || null);
        const languageVersion = langParts?.[2] || null;

        // CMS via meta generator
        let cms: string | null = null;
        let cmsVersion: string | null = null;
        const genMatch = html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i);
        if (genMatch) {
          const parts = genMatch[1].split(/\s+/);
          cms = parts[0];
          cmsVersion = parts.slice(1).join(' ') || null;
        }

        // CMS via known paths
        if (!cms) {
          const cmsPaths = [
            { path: '/wp-login.php', name: 'WordPress' },
            { path: '/administrator', name: 'Joomla' },
            { path: '/user/login', name: 'Drupal' },
          ];
          for (const cp of cmsPaths) {
            try {
              const cmsRes = await fetch(new URL(cp.path, url).toString(), { method: 'HEAD', redirect: 'manual' });
              if (cmsRes.status < 400) { cms = cp.name; break; }
            } catch { /* skip */ }
          }
        }

        // Cookies
        const cookies = headers.get('set-cookie') || '';
        if (!language && cookies.includes('PHPSESSID')) {
          // language already set above or infer PHP
        }

        // CDN
        let cdn: string | null = null;
        if (serverHeader.toLowerCase().includes('cloudflare')) cdn = 'Cloudflare';
        else if (headers.get('x-cdn')) cdn = headers.get('x-cdn');
        else if (headers.get('via')?.includes('cloudfront')) cdn = 'CloudFront';

        // JS libraries
        const jsLibraries: string[] = [];
        if (htmlLower.includes('jquery')) jsLibraries.push('jQuery');
        if (htmlLower.includes('react')) jsLibraries.push('React');
        if (htmlLower.includes('vue')) jsLibraries.push('Vue');
        if (htmlLower.includes('angular')) jsLibraries.push('Angular');
        if (htmlLower.includes('bootstrap')) jsLibraries.push('Bootstrap');

        results.push({
          url,
          technologies: { webServer, webServerVersion, language, languageVersion, cms, cmsVersion, cdn, jsLibraries },
          checkedAt: new Date().toISOString(),
          error: null,
        });
      } catch (e) {
        results.push({ url, technologies: null, checkedAt: new Date().toISOString(), error: e.message });
      }
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
