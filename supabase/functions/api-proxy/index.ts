const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const API_BASE = Deno.env.get("SECURITY_API_URL") ?? "http://187.77.222.249:8000";
const API_KEY = Deno.env.get("SECURITY_API_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/health";

    const targetUrl = `${API_BASE}${path}`;
    console.log(`[api-proxy] ${req.method} ${path} → ${targetUrl}`);

    const body = req.method !== "GET" && req.method !== "HEAD"
      ? await req.text()
      : undefined;

    const controller = new AbortController();
    const isSlowPath = path.startsWith('/ransomware') || path.startsWith('/threat/map');
    const timeout = setTimeout(() => controller.abort(), isSlowPath ? 55000 : 30000);

    let response: Response | null = null;
    let lastErr = "";
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        response = await fetch(targetUrl, {
          method: req.method,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
          },
          body: attempt === 0 ? body : (req.method !== "GET" && req.method !== "HEAD" ? body : undefined),
          signal: controller.signal,
        });
        break; // success
      } catch (fetchErr: unknown) {
        lastErr = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.warn(`[api-proxy] attempt ${attempt + 1}/${MAX_RETRIES} failed: ${lastErr}`);
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    clearTimeout(timeout);

    if (!response) {
      console.error(`[api-proxy] all ${MAX_RETRIES} attempts failed: ${lastErr}`);
      return new Response(
        JSON.stringify({ error: "Upstream fetch failed", detail: lastErr }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[api-proxy] upstream status=${response.status} content-type=${response.headers.get("content-type")}`);
    const responseText = await response.text();
    console.log(`[api-proxy] response length=${responseText.length}`);

    // Wrap 404s and 500s so the edge function itself always returns 200/502 JSON
    if (response.status === 404) {
      return new Response(
        JSON.stringify({ _not_found: true, _status: 404, detail: "Not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (response.status >= 500) {
      return new Response(
        JSON.stringify({ error: "Upstream server error", upstream_status: response.status, detail: responseText.slice(0, 200) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(responseText, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "Proxy error", detail: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
