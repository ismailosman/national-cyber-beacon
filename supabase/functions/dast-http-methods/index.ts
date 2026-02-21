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

    // Fetch baseline GET response for SPA detection
    let getBody = "";
    try {
      const getResp = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10000) });
      getBody = await getResp.text();
    } catch {}

    try {
      const optionsResponse = await fetch(url, { method: "OPTIONS", signal: AbortSignal.timeout(10000) });
      const allowHeader = optionsResponse.headers.get("allow") || "";
      if (allowHeader) {
        findings.push({
          id: "HTTP-001", test: "OPTIONS Method Allow Header", severity: "info", status: "info",
          detail: `Server advertises allowed methods: ${allowHeader}`,
          evidence: { header: "Allow", value: allowHeader },
        });
      }
    } catch {}

    const dangerousMethods = [
      { method: "PUT", risk: "Allows uploading/overwriting files on the server" },
      { method: "DELETE", risk: "Allows deleting resources on the server" },
      { method: "TRACE", risk: "Enables Cross-Site Tracing (XST) attacks, can steal credentials" },
      { method: "CONNECT", risk: "Can be used as a proxy for attacks" },
      { method: "PATCH", risk: "Allows modifying resources if not properly protected" },
    ];

    for (const item of dangerousMethods) {
      try {
        const methodResponse = await fetch(url, { method: item.method, signal: AbortSignal.timeout(5000) });
        if ([200, 201, 204].includes(methodResponse.status)) {
          // SPA soft-404 detection: if the response body matches the GET baseline, it's just the SPA shell
          let isSpaFalsePositive = false;
          if (methodResponse.status === 200 && getBody.length > 0) {
            try {
              const methodBody = await methodResponse.text();
              const isSpaShell = methodBody.includes('<div id="root"') || methodBody.includes('<div id="app"') || methodBody.includes('<!doctype html');
              const isSameAsGet = Math.abs(methodBody.length - getBody.length) < 200;
              if (isSpaShell && isSameAsGet) {
                isSpaFalsePositive = true;
              }
            } catch {}
          }

          if (isSpaFalsePositive) {
            findings.push({
              id: `HTTP-${item.method}`, test: `Dangerous Method: ${item.method}`,
              severity: "info", status: "pass",
              detail: `${item.method} method returns SPA shell (same as GET response) — server is not actually processing this method`,
              evidence: { method: item.method, status: methodResponse.status, spaDetected: true },
            });
          } else {
            findings.push({
              id: `HTTP-${item.method}`, test: `Dangerous Method: ${item.method}`,
              severity: item.method === "TRACE" ? "high" : "medium", status: "fail",
              detail: `${item.method} method is accepted (status ${methodResponse.status}). ${item.risk}`,
              recommendation: `Disable ${item.method} method. In Nginx: add "limit_except GET POST { deny all; }"`,
              evidence: { method: item.method, status: methodResponse.status },
            });
          }
        } else {
          findings.push({
            id: `HTTP-${item.method}`, test: `Dangerous Method: ${item.method}`,
            severity: "info", status: "pass",
            detail: `${item.method} method properly blocked (status ${methodResponse.status})`,
            evidence: { method: item.method, status: methodResponse.status },
          });
        }
      } catch {
        findings.push({
          id: `HTTP-${item.method}`, test: `Dangerous Method: ${item.method}`,
          severity: "info", status: "pass",
          detail: `${item.method} method not accepted (connection refused/timeout)`,
        });
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return new Response(JSON.stringify({
      success: true, test: "http_methods", findingsCount: findings.length, findings,
      checkedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false, test: "http_methods", error: error.message,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
