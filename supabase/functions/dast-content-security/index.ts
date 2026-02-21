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

    const response = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
    const headers = response.headers;

    // Detect Cloudflare
    const isCloudflare = (headers.get("server") || "").toLowerCase().includes("cloudflare") || !!headers.get("cf-ray");

    // Content-Security-Policy
    const csp = headers.get("content-security-policy") || "";
    if (!csp) {
      findings.push({ id: "CS-CSP-MISS", test: "Content-Security-Policy Missing", severity: "medium", status: "fail", detail: "No CSP header. XSS attacks can execute arbitrary scripts on your site.", recommendation: "Add a Content-Security-Policy header. Start with: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" });
    } else {
      if (csp.includes("'unsafe-inline'") && csp.includes("script-src")) {
        findings.push({ id: "CS-CSP-INLINE", test: "CSP Allows Inline Scripts", severity: "medium", status: "fail", detail: "CSP allows 'unsafe-inline' for scripts, reducing XSS protection.", recommendation: "Use nonces or hashes instead of 'unsafe-inline' for script-src" });
      }
      if (csp.includes("'unsafe-eval'")) {
        findings.push({ id: "CS-CSP-EVAL", test: "CSP Allows eval()", severity: "medium", status: "fail", detail: "CSP allows 'unsafe-eval', enabling eval()-based XSS.", recommendation: "Remove 'unsafe-eval' from CSP and refactor code to avoid eval()" });
      }
      if (csp.includes("*") && !csp.includes("*.")) {
        findings.push({ id: "CS-CSP-WILD", test: "CSP Wildcard Source", severity: "high", status: "fail", detail: "CSP contains wildcard (*) source allowing resources from any origin.", recommendation: "Replace wildcard with specific trusted domains" });
      }
      if (!csp.includes("'unsafe-inline'") && !csp.includes("'unsafe-eval'") && !csp.includes("*")) {
        findings.push({ id: "CS-CSP-OK", test: "CSP Well Configured", severity: "info", status: "pass", detail: "Content-Security-Policy is present with reasonable restrictions" });
      }
    }

    // X-Frame-Options / frame-ancestors — Clickjacking
    const xfo = headers.get("x-frame-options") || "";
    const hasFrameAncestors = csp.includes("frame-ancestors");
    if (!xfo && !hasFrameAncestors) {
      if (isCloudflare) {
        // Cloudflare-protected sites: downgrade to informational
        findings.push({ id: "CS-CLICKJACK", test: "Clickjacking Protection", severity: "info", status: "info", detail: "No X-Frame-Options or CSP frame-ancestors header, but site is behind Cloudflare which provides additional protection layers.", recommendation: "Consider adding X-Frame-Options: DENY or CSP frame-ancestors 'self' for defense in depth" });
      } else {
        findings.push({ id: "CS-CLICKJACK", test: "Clickjacking Protection Missing", severity: "medium", status: "fail", detail: "No X-Frame-Options or CSP frame-ancestors. Site can be embedded in attacker-controlled iframes for clickjacking.", recommendation: "Add X-Frame-Options: DENY or SAMEORIGIN, or CSP frame-ancestors 'self'" });
      }
    } else {
      findings.push({ id: "CS-CLICKJACK", test: "Clickjacking Protection", severity: "info", status: "pass", detail: `Protected by ${xfo ? `X-Frame-Options: ${xfo}` : "CSP frame-ancestors"}` });
    }

    // X-Content-Type-Options
    const xcto = headers.get("x-content-type-options") || "";
    if (xcto.toLowerCase() !== "nosniff") {
      findings.push({ id: "CS-MIME", test: "MIME Sniffing Not Prevented", severity: "medium", status: "fail", detail: "X-Content-Type-Options: nosniff is missing. Browsers may interpret files as different MIME types.", recommendation: "Add header: X-Content-Type-Options: nosniff" });
    } else {
      findings.push({ id: "CS-MIME", test: "MIME Sniffing Prevention", severity: "info", status: "pass", detail: "X-Content-Type-Options: nosniff is set" });
    }

    // Referrer-Policy
    const referrer = headers.get("referrer-policy") || "";
    if (!referrer) {
      findings.push({ id: "CS-REFERRER", test: "Referrer-Policy Missing", severity: "low", status: "fail", detail: "No Referrer-Policy header. Full URLs (including query params with sensitive data) may be leaked.", recommendation: "Add Referrer-Policy: strict-origin-when-cross-origin" });
    } else if (referrer === "unsafe-url") {
      findings.push({ id: "CS-REFERRER", test: "Referrer-Policy Unsafe", severity: "medium", status: "fail", detail: "Referrer-Policy is 'unsafe-url' — full URLs are leaked to all origins.", recommendation: "Change to: strict-origin-when-cross-origin or no-referrer" });
    } else {
      findings.push({ id: "CS-REFERRER", test: "Referrer-Policy Set", severity: "info", status: "pass", detail: `Referrer-Policy: ${referrer}` });
    }

    // Permissions-Policy
    const permPolicy = headers.get("permissions-policy") || headers.get("feature-policy") || "";
    if (!permPolicy) {
      findings.push({ id: "CS-PERM", test: "Permissions-Policy Missing", severity: "low", status: "fail", detail: "No Permissions-Policy header. Third-party scripts can access camera, microphone, geolocation.", recommendation: "Add Permissions-Policy: camera=(), microphone=(), geolocation=()" });
    } else {
      findings.push({ id: "CS-PERM", test: "Permissions-Policy Set", severity: "info", status: "pass", detail: "Permissions-Policy is configured" });
    }

    // X-XSS-Protection (legacy but still checked)
    const xss = headers.get("x-xss-protection") || "";
    if (xss === "0") {
      findings.push({ id: "CS-XSS", test: "XSS Protection Disabled", severity: "low", status: "fail", detail: "X-XSS-Protection is explicitly disabled.", recommendation: "If CSP is properly configured, this is acceptable. Otherwise, set X-XSS-Protection: 1; mode=block" });
    }

    return new Response(JSON.stringify({ success: true, test: "content_security", findingsCount: findings.length, findings, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, test: "content_security", error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
