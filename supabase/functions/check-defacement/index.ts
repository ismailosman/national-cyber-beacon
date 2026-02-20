const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// High-confidence defacement phrases only — no single words
const DEFACEMENT_PHRASES = [
  'hacked by ',
  'defaced by ',
  'owned by ',
  'you have been hacked',
  'this site has been hacked',
  'this website has been hacked',
  'this site has been defaced',
  'this website has been defaced',
  'greetz to',
  'greetings from',
  'cyber army',
  'we are anonymous',
  'expect us',
  'tango down',
  'ops by ',
  'r.i.p website',
  'site pwned',
  'government hacked',
];

/** Strip visible-only content for keyword matching (remove scripts, styles, meta) */
function extractVisibleText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Aggressively strip dynamic content before hashing */
function cleanHtmlForHash(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/csrf[^"'\s]*/gi, '')
    .replace(/name="?_token"?\s+value="?[^"'\s]*"?/gi, '')
    .replace(/nonce="[^"]*"/gi, '')
    .replace(/\d{10,13}/g, '')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^"'\s]*/g, '')
    .replace(/session[_-]?id[="'][^"'\s]*/gi, '')
    .replace(/phpsessid[="'][^"'\s]*/gi, '')
    .replace(/JSESSIONID[="'][^"'\s]*/gi, '')
    .replace(/\?v=[^"'\s]*/g, '')
    .replace(/\?ver=[^"'\s]*/g, '')
    .replace(/\?t=[^"'\s]*/g, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function computeHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

function countInternalLinks(html: string, domain: string): number {
  const linkMatches = html.match(/<a[^>]+href="[^"]*"/gi) || [];
  let count = 0;
  for (const link of linkMatches) {
    const href = link.match(/href="([^"]*)"/i)?.[1] || '';
    if (href.startsWith('/') || href.startsWith('#') || href.includes(domain)) count++;
  }
  return count;
}

function hasNormalStructure(html: string): boolean {
  const lower = html.toLowerCase();
  const structuralTags = ['<nav', '<footer', '<header', '<main'];
  const found = structuralTags.filter(tag => lower.includes(tag));
  return found.length >= 2; // At least 2 structural tags
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
      const { url, baselineHash, baselineTitle, baselineSize, checkCount = 0, expectedTitle } = item;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'SomaliaCERT-EarlyWarning/1.0' },
          redirect: 'follow',
        });
        clearTimeout(timeout);

        const html = await response.text();
        const cleaned = cleanHtmlForHash(html);
        const currentHash = await computeHash(cleaned);
        const currentTitle = extractTitle(html);
        const currentSize = html.length;

        // Extract domain for internal link counting
        let domain = '';
        try { domain = new URL(url).hostname; } catch { /* ignore */ }

        const internalLinkCount = countInternalLinks(html, domain);
        const normalStructure = hasNormalStructure(html);

        // Keyword matching on visible text only
        const visibleText = extractVisibleText(html);
        const defacementKeywordsFound: string[] = [];
        const keywordContexts: { phrase: string; context: string }[] = [];
        
        for (const phrase of DEFACEMENT_PHRASES) {
          const idx = visibleText.indexOf(phrase);
          if (idx !== -1) {
            defacementKeywordsFound.push(phrase.trim());
            const start = Math.max(0, idx - 30);
            const end = Math.min(visibleText.length, idx + phrase.length + 30);
            keywordContexts.push({ phrase: phrase.trim(), context: visibleText.slice(start, end) });
          }
        }

        // Hash comparison
        const hashChanged = baselineHash ? currentHash !== baselineHash : false;
        const titleChanged = baselineTitle ? currentTitle.toLowerCase() !== baselineTitle.toLowerCase() : false;
        const sizeAnomaly = baselineSize ? Math.abs(currentSize - baselineSize) / baselineSize > 0.7 : false;

        // Multi-indicator scoring (5 indicators)
        const indicators = {
          phraseFound: defacementKeywordsFound.length > 0,
          titleMismatch: !!(expectedTitle && !currentTitle.toLowerCase().includes(expectedTitle.toLowerCase())),
          smallPage: currentSize < 5000,
          missingStructure: !normalStructure,
          fewLinks: internalLinkCount < 3,
        };
        const indicatorCount = Object.values(indicators).filter(Boolean).length;

        // Calibration logic
        let status: string;
        if (checkCount <= 0) {
          status = 'baseline_set';
        } else if (checkCount <= 2) {
          // Still calibrating - only flag if very obvious
          if (indicators.phraseFound && indicatorCount >= 3) {
            status = 'defaced';
          } else {
            status = 'calibrating';
          }
        } else {
          // Full comparison from check 4+
          if (indicatorCount >= 2 && indicators.phraseFound) {
            status = 'defaced';
          } else if (indicatorCount >= 2) {
            status = 'review_needed';
          } else if (defacementKeywordsFound.length > 0) {
            status = 'review_needed';
          } else if (hashChanged && !indicators.phraseFound) {
            status = 'content_changed';
          } else {
            status = 'clean';
          }
        }

        return {
          url, currentHash, currentTitle, currentSize,
          hashChanged, titleChanged, sizeAnomaly,
          defacementKeywordsFound, keywordContexts,
          indicators, indicatorCount,
          status,
          internalLinkCount, hasNormalStructure: normalStructure,
          error: null,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          url, currentHash: null, currentTitle: null, currentSize: null,
          hashChanged: false, titleChanged: false, sizeAnomaly: false,
          defacementKeywordsFound: [], keywordContexts: [],
          indicators: { phraseFound: false, titleMismatch: false, smallPage: false, missingStructure: false, fewLinks: false },
          indicatorCount: 0,
          status: 'error',
          internalLinkCount: 0, hasNormalStructure: false,
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
