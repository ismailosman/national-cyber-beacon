const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = "https://cybersomalia.com";

Deno.serve(async (req: Request) => {
  console.log("Request received:", req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("SECURITY_API_KEY");
  if (!API_KEY) {
    console.error("SECURITY_API_KEY not configured");
    return new Response(JSON.stringify({ error: "SECURITY_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/health";
    const targetUrl = `${API_BASE}${path}`;
    console.log("Proxying to:", targetUrl);

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = await req.text();
    }

    const response = await fetch(targetUrl, fetchOptions);
    const upstreamContentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    console.log("Upstream status:", response.status, "content-type:", upstreamContentType);

    // Always return JSON to the browser. Some upstream failures return HTML (nginx 502 pages),
    // which breaks JSON parsing in the frontend.
    let body = raw;
    let contentType = upstreamContentType;

    if (!upstreamContentType.toLowerCase().includes("application/json")) {
      body = JSON.stringify({
        error: "Upstream returned non-JSON response",
        upstream_status: response.status,
        upstream_content_type: upstreamContentType,
        upstream_body: raw.slice(0, 2000),
      });
      contentType = "application/json";
    }

    return new Response(body, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": contentType || "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Proxy error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
