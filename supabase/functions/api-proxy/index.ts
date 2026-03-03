const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const API_BASE = Deno.env.get("SECURITY_API_URL") ?? "https://cybersomalia.com";
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
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body,
        signal: controller.signal,
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeout);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error(`[api-proxy] fetch failed: ${msg}`);
      return new Response(
        JSON.stringify({ error: "Upstream fetch failed", detail: msg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    clearTimeout(timeout);

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
