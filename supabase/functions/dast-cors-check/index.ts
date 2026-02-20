import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const findings: any[] = [];

    try {
      const fakeOrigin = "https://evil-attacker.com";
      const corsResponse = await fetch(url, { method: "GET", headers: { "Origin": fakeOrigin }, signal: AbortSignal.timeout(10000) });
      const acaoHeader = corsResponse.headers.get("access-control-allow-origin") || "";
      const acCredentials = corsResponse.headers.get("access-control-allow-credentials") || "";

      if (acaoHeader === "*") {
        findings.push({ id: "CORS-001", test: "CORS: Wildcard Origin", severity: "medium", status: "fail",
          detail: 'Access-Control-Allow-Origin is set to "*". Any website can make requests.',
          recommendation: "Restrict CORS to specific trusted origins",
          evidence: { header: "Access-Control-Allow-Origin", value: "*" },
        });
      } else if (acaoHeader === fakeOrigin) {
        findings.push({ id: "CORS-002", test: "CORS: Origin Reflection", severity: "high", status: "fail",
          detail: `Server reflects back attacker's origin "${fakeOrigin}".`,
          recommendation: "Do not reflect the Origin header. Maintain a whitelist of allowed origins.",
          evidence: { header: "Access-Control-Allow-Origin", value: acaoHeader, sentOrigin: fakeOrigin },
        });
        if (acCredentials.toLowerCase() === "true") {
          findings.push({ id: "CORS-003", test: "CORS: Credentials with Reflected Origin", severity: "critical", status: "fail",
            detail: "Server reflects origin AND allows credentials. Attacker can steal authenticated user data.",
            recommendation: "NEVER combine Access-Control-Allow-Credentials: true with a reflected or wildcard origin",
            evidence: { allowOrigin: acaoHeader, allowCredentials: "true" },
          });
        }
      } else if (acaoHeader) {
        findings.push({ id: "CORS-004", test: "CORS: Specific Origin Configured", severity: "info", status: "pass",
          detail: `CORS configured with specific origin: "${acaoHeader}"`,
          evidence: { header: "Access-Control-Allow-Origin", value: acaoHeader },
        });
      } else {
        findings.push({ id: "CORS-005", test: "CORS: No CORS Headers", severity: "info", status: "pass",
          detail: "No CORS headers returned (same-origin policy enforced by default)",
        });
      }
    } catch (e) {
      findings.push({ id: "CORS-ERR", test: "CORS Check", severity: "info", status: "error", detail: `Could not test CORS: ${e.message}` });
    }

    try {
      const nullResponse = await fetch(url, { method: "GET", headers: { "Origin": "null" }, signal: AbortSignal.timeout(10000) });
      const nullAcao = nullResponse.headers.get("access-control-allow-origin") || "";
      if (nullAcao === "null") {
        findings.push({ id: "CORS-006", test: "CORS: Null Origin Accepted", severity: "high", status: "fail",
          detail: 'Server accepts "null" as a valid origin. Sandboxed iframes can exploit this.',
          recommendation: "Do not accept null as a valid origin in CORS configuration",
          evidence: { origin: "null", response: "null" },
        });
      }
    } catch {}

    return new Response(JSON.stringify({
      success: true, test: "cors_misconfiguration", findingsCount: findings.length, findings,
      checkedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false, test: "cors_misconfiguration", error: error.message,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
