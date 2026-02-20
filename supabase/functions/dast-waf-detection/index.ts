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
    const allHeaders = Object.fromEntries(response.headers.entries());

    // WAF fingerprinting by headers
    const wafSignatures: { name: string; checks: { header: string; pattern: RegExp }[] }[] = [
      { name: "Cloudflare", checks: [{ header: "server", pattern: /cloudflare/i }, { header: "cf-ray", pattern: /.+/ }] },
      { name: "AWS WAF / CloudFront", checks: [{ header: "x-amz-cf-id", pattern: /.+/ }, { header: "server", pattern: /CloudFront/i }] },
      { name: "Akamai", checks: [{ header: "x-akamai-transformed", pattern: /.+/ }, { header: "server", pattern: /AkamaiGHost/i }] },
      { name: "Imperva / Incapsula", checks: [{ header: "x-cdn", pattern: /Imperva|Incapsula/i }, { header: "x-iinfo", pattern: /.+/ }] },
      { name: "Sucuri", checks: [{ header: "x-sucuri-id", pattern: /.+/ }, { header: "server", pattern: /Sucuri/i }] },
      { name: "F5 BIG-IP", checks: [{ header: "server", pattern: /BIG-IP|BigIP/i }] },
      { name: "ModSecurity", checks: [{ header: "server", pattern: /mod_security|ModSecurity/i }] },
      { name: "Barracuda", checks: [{ header: "server", pattern: /Barracuda/i }] },
      { name: "DDoS-Guard", checks: [{ header: "server", pattern: /DDoS-Guard/i }] },
      { name: "Fastly", checks: [{ header: "x-served-by", pattern: /cache-/i }, { header: "via", pattern: /varnish/i }] },
    ];

    const detectedWAFs: string[] = [];
    for (const waf of wafSignatures) {
      const detected = waf.checks.some(check => {
        const headerValue = headers.get(check.header) || "";
        return check.pattern.test(headerValue);
      });
      if (detected) detectedWAFs.push(waf.name);
    }

    if (detectedWAFs.length > 0) {
      findings.push({ id: "WAF-DETECTED", test: "WAF/CDN Detected", severity: "info", status: "pass", detail: `Web Application Firewall detected: ${detectedWAFs.join(", ")}. This provides protection against common web attacks.`, evidence: { wafs: detectedWAFs } });
    } else {
      findings.push({ id: "WAF-NONE", test: "No WAF Detected", severity: "medium", status: "fail", detail: "No Web Application Firewall (WAF) detected. The application may be directly exposed to attacks.", recommendation: "Deploy a WAF (Cloudflare, AWS WAF, or ModSecurity) to filter malicious traffic." });
    }

    // Server header info disclosure
    const server = headers.get("server") || "";
    if (server) {
      const versionPattern = /[\d.]+/;
      if (versionPattern.test(server)) {
        findings.push({ id: "WAF-SERVER-VER", test: "Server Version Disclosed", severity: "medium", status: "fail", detail: `Server header reveals version: "${server}". Attackers use this to find known vulnerabilities.`, recommendation: "Configure your web server to hide the version. Nginx: server_tokens off; Apache: ServerTokens Prod", evidence: { server } });
      } else {
        findings.push({ id: "WAF-SERVER", test: "Server Header Present", severity: "low", status: "fail", detail: `Server header present: "${server}" (no version, less risky)`, recommendation: "Consider removing or minimizing the Server header", evidence: { server } });
      }
    }

    // X-Powered-By
    const poweredBy = headers.get("x-powered-by") || "";
    if (poweredBy) {
      findings.push({ id: "WAF-POWERED", test: "X-Powered-By Header", severity: "medium", status: "fail", detail: `X-Powered-By: "${poweredBy}" reveals backend technology.`, recommendation: "Remove the X-Powered-By header. Express: app.disable('x-powered-by'); PHP: expose_php = Off", evidence: { poweredBy } });
    }

    // Rate limiting test — send a few quick requests
    let rateLimited = false;
    try {
      const promises = Array.from({ length: 5 }, () => fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) }));
      const responses = await Promise.all(promises);
      rateLimited = responses.some(r => r.status === 429 || r.status === 503);
    } catch {}

    if (rateLimited) {
      findings.push({ id: "WAF-RATELIMIT", test: "Rate Limiting Active", severity: "info", status: "pass", detail: "Rate limiting is active — rapid requests are being throttled" });
    } else {
      findings.push({ id: "WAF-RATELIMIT", test: "No Rate Limiting Detected", severity: "medium", status: "fail", detail: "No rate limiting detected after rapid requests. The application may be vulnerable to brute force and DDoS.", recommendation: "Implement rate limiting at the WAF, reverse proxy, or application level" });
    }

    // Check for common security response headers that indicate WAF rules
    const securityHeaders = ["x-xss-protection", "x-content-type-options", "strict-transport-security", "content-security-policy"];
    const presentHeaders = securityHeaders.filter(h => headers.get(h));
    const headerCoverage = Math.round((presentHeaders.length / securityHeaders.length) * 100);

    findings.push({ id: "WAF-HEADERS", test: "Security Header Coverage", severity: headerCoverage < 50 ? "medium" : "info", status: headerCoverage < 50 ? "fail" : "pass", detail: `${presentHeaders.length}/${securityHeaders.length} key security headers present (${headerCoverage}% coverage)`, evidence: { present: presentHeaders, missing: securityHeaders.filter(h => !headers.get(h)) } });

    return new Response(JSON.stringify({ success: true, test: "waf_detection", findingsCount: findings.length, findings, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, test: "waf_detection", error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
