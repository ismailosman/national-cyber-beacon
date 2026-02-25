const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = Deno.env.get("SECURITY_API_URL") ?? "https://cybersomalia.com";
const API_KEY = Deno.env.get("SECURITY_API_KEY") ?? "";

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

      const upstream = await fetch(`${API_BASE}/scan/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-api-key": API_KEY,
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

    // Default: list jobs — always return 200 with structured payload
    try {
      const upstream = await fetch(`${API_BASE}/scan/jobs`, {
        headers: {
          "Accept": "application/json",
          "x-api-key": API_KEY,
        },
      });

      const parsed = await parseJsonResponse(upstream);
      if (parsed.error) {
        // Upstream is down/misconfigured — return 200 with empty jobs + error metadata
        return jsonResponse({
          ok: false,
          jobs: [],
          error: "Scanner API is currently unavailable",
          upstream_status: upstream.status,
        });
      }

      return jsonResponse({
        ok: true,
        jobs: Array.isArray(parsed.data) ? parsed.data : [],
      });
    } catch (fetchErr: unknown) {
      const message = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      return jsonResponse({
        ok: false,
        jobs: [],
        error: `Cannot reach scanner: ${message}`,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, jobs: [], error: message });
  }
});
