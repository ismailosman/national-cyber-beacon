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
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol === "https:") {
      try {
        const httpUrl = url.replace("https://", "http://");
        const httpResponse = await fetch(httpUrl, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10000) });
        const location = httpResponse.headers.get("location") || "";
        if ([301, 302, 307, 308].includes(httpResponse.status) && location.startsWith("https://")) {
          findings.push({ id: "REDIR-001", test: "HTTP to HTTPS Redirect", severity: "info", status: "pass",
            detail: `HTTP properly redirects to HTTPS (${httpResponse.status} → ${location})`,
            evidence: { httpStatus: httpResponse.status, redirectTo: location },
          });
        } else if (httpResponse.status === 200) {
          findings.push({ id: "REDIR-001", test: "HTTP to HTTPS Redirect", severity: "high", status: "fail",
            detail: "HTTP version serves content without redirecting to HTTPS.",
            recommendation: "Configure permanent redirect (301) from HTTP to HTTPS.",
            evidence: { httpStatus: 200 },
          });
        }
      } catch {}
    }

    const redirectParams = ["url", "redirect", "next", "return", "goto", "target", "rurl", "dest", "destination", "redirect_uri", "return_to", "continue"];
    for (const param of redirectParams) {
      try {
        const testUrl = `${url}${url.includes("?") ? "&" : "?"}${param}=https://evil-attacker.com`;
        const redirectResponse = await fetch(testUrl, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(5000) });
        const location = redirectResponse.headers.get("location") || "";
        if ([301, 302, 307, 308].includes(redirectResponse.status) && location.includes("evil-attacker.com")) {
          findings.push({ id: `REDIR-OPEN-${param}`, test: `Open Redirect via "${param}" Parameter`, severity: "medium", status: "fail",
            detail: `The "${param}" parameter causes an open redirect to attacker-controlled URLs.`,
            recommendation: `Validate and whitelist redirect URLs for the "${param}" parameter.`,
            evidence: { parameter: param, redirectTo: location },
          });
          break;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    try {
      let redirectCount = 0;
      let currentUrl = url;
      const visitedUrls = [currentUrl];
      while (redirectCount < 10) {
        const chainResponse = await fetch(currentUrl, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5000) });
        if ([301, 302, 307, 308].includes(chainResponse.status)) {
          const nextUrl = chainResponse.headers.get("location") || "";
          if (!nextUrl || visitedUrls.includes(nextUrl)) break;
          visitedUrls.push(nextUrl);
          currentUrl = nextUrl.startsWith("http") ? nextUrl : new URL(nextUrl, currentUrl).href;
          redirectCount++;
        } else { break; }
      }
      if (redirectCount > 3) {
        findings.push({ id: "REDIR-CHAIN", test: "Excessive Redirect Chain", severity: "low", status: "fail",
          detail: `Redirect chain has ${redirectCount} hops.`,
          recommendation: "Reduce redirect chain to 1-2 hops maximum",
          evidence: { redirectCount, chain: visitedUrls },
        });
      } else if (redirectCount > 0) {
        findings.push({ id: "REDIR-CHAIN", test: "Redirect Chain", severity: "info", status: "pass",
          detail: `Redirect chain has ${redirectCount} hop(s) — acceptable`,
          evidence: { redirectCount, chain: visitedUrls },
        });
      }
    } catch {}

    return new Response(JSON.stringify({
      success: true, test: "redirect_security", findingsCount: findings.length, findings,
      checkedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false, test: "redirect_security", error: error.message,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
