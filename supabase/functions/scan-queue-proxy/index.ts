const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = "https://cybersomalia.com";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function parseJsonResponse(response: Response): Promise<{
  data?: unknown;
  raw: string;
  contentType: string;
  error?: "non_json" | "invalid_json";
}> {
  const raw = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  if (!raw) return { data: null, raw, contentType };
  if (!contentType.toLowerCase().includes("application/json")) {
    return { raw, contentType, error: "non_json" };
  }

  try {
    return { data: JSON.parse(raw), raw, contentType };
  } catch {
    return { raw, contentType, error: "invalid_json" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // no body or invalid JSON – default to list
    }

    const action = (body.action as string) || "list";

    if (action === "start") {
      const { scan_type, target } = body as { scan_type?: string; target?: string };

      if (!scan_type || !target) {
        return jsonResponse({ error: "Missing required fields: scan_type and target" }, 400);
      }

      const upstream = await fetch(`${API_BASE}/api/scan/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ scan_type, target }),
      });

      const parsed = await parseJsonResponse(upstream);
      if (parsed.error) {
        return jsonResponse(
          {
            error: "Scan API returned an invalid response format",
            upstream_status: upstream.status,
            upstream_content_type: parsed.contentType || "unknown",
            upstream_body_snippet: parsed.raw.slice(0, 220),
          },
          502,
        );
      }

      return jsonResponse(parsed.data, upstream.status);
    }

    // Default: list jobs
    const upstream = await fetch(`${API_BASE}/api/scan/jobs`, {
      headers: { "Accept": "application/json" },
    });

    const parsed = await parseJsonResponse(upstream);
    if (parsed.error) {
      return jsonResponse(
        {
          error: "Scan queue API is unavailable or misconfigured",
          upstream_status: upstream.status,
          upstream_content_type: parsed.contentType || "unknown",
          upstream_body_snippet: parsed.raw.slice(0, 220),
        },
        502,
      );
    }

    return jsonResponse(parsed.data, upstream.status || 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 502);
  }
});
