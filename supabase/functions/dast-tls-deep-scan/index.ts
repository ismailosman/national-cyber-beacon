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
    const hostname = new URL(url).hostname;

    let mainResponse;
    try {
      mainResponse = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15000) });
    } catch (e: any) {
      findings.push({ id: "TLS-000", test: "HTTPS Connection", severity: "critical", status: "fail", detail: `Cannot establish HTTPS connection: ${e.message}`, recommendation: "Install a valid SSL/TLS certificate." });
      return new Response(JSON.stringify({ success: true, test: "tls_deep_scan", findings, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Detect Cloudflare
    const isCloudflare = (mainResponse.headers.get("server") || "").toLowerCase().includes("cloudflare") || !!mainResponse.headers.get("cf-ray");

    // HSTS checks
    const hstsHeader = mainResponse.headers.get("strict-transport-security") || "";
    if (hstsHeader) {
      const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/);
      const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;
      const includeSubdomains = hstsHeader.toLowerCase().includes("includesubdomains");
      const preload = hstsHeader.toLowerCase().includes("preload");

      if (maxAge < 31536000) {
        findings.push({ id: "TLS-HSTS-AGE", test: "HSTS Max-Age Too Short", severity: "medium", status: "fail", detail: `HSTS max-age is ${maxAge}s (${Math.round(maxAge / 86400)} days). Should be ≥31536000 (1 year).`, recommendation: "Set Strict-Transport-Security: max-age=31536000; includeSubDomains; preload", evidence: { hstsHeader, maxAge } });
      }
      if (!includeSubdomains) {
        findings.push({ id: "TLS-HSTS-SUB", test: "HSTS Missing includeSubDomains", severity: "medium", status: "fail", detail: "HSTS does not include subdomains.", recommendation: "Add includeSubDomains to the HSTS header" });
      }
      if (!preload) {
        if (isCloudflare) {
          findings.push({ id: "TLS-HSTS-PRE", test: "HSTS Preload", severity: "info", status: "pass", detail: "HSTS header does not include preload directive, but site is behind Cloudflare which manages TLS termination.", recommendation: "Consider adding preload directive for defense in depth" });
        } else {
          findings.push({ id: "TLS-HSTS-PRE", test: "HSTS Missing Preload", severity: "low", status: "fail", detail: "HSTS header does not include preload directive.", recommendation: "Add preload directive and submit to hstspreload.org" });
        }
      }
      if (maxAge >= 31536000 && includeSubdomains && preload) {
        findings.push({ id: "TLS-HSTS-OK", test: "HSTS Fully Configured", severity: "info", status: "pass", detail: "HSTS is properly configured with long max-age, includeSubDomains, and preload" });
      }
    } else {
      findings.push({ id: "TLS-HSTS-MISS", test: "HSTS Missing", severity: "high", status: "fail", detail: "Strict-Transport-Security header is not set. Users can be downgraded from HTTPS to HTTP.", recommendation: "Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" });
    }

    // Mixed content
    try {
      const pageResponse = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const html = await pageResponse.text();
      const httpSrcPattern = /(?:src|href|action)=["']http:\/\/[^"']+["']/gi;
      const matches = html.match(httpSrcPattern) || [];
      if (matches.length > 0) {
        findings.push({ id: "TLS-MIXED", test: "Mixed Content Detected", severity: "medium", status: "fail", detail: `Found ${matches.length} HTTP resources on HTTPS page.`, recommendation: "Replace all http:// URLs with https://", evidence: { count: matches.length, examples: [...new Set(matches)].slice(0, 5) } });
      } else {
        findings.push({ id: "TLS-MIXED", test: "Mixed Content", severity: "info", status: "pass", detail: "No mixed content detected" });
      }

      const formActionPattern = /<form[^>]*action=["']http:\/\/[^"']+["'][^>]*>/gi;
      const insecureForms = html.match(formActionPattern) || [];
      if (insecureForms.length > 0) {
        findings.push({ id: "TLS-FORM", test: "Insecure Form Submission", severity: "high", status: "fail", detail: `Found ${insecureForms.length} form(s) submitting data over HTTP.`, recommendation: "Change all form action URLs to use HTTPS" });
      }
    } catch {}

    // CAA DNS record
    try {
      const caaResponse = await fetch(`https://dns.google/resolve?name=${hostname}&type=CAA`, { signal: AbortSignal.timeout(5000) });
      const caaData = await caaResponse.json();
      if (!caaData.Answer || caaData.Answer.length === 0) {
        findings.push({ id: "TLS-CAA", test: "CAA DNS Record", severity: "info", status: "pass", detail: "No CAA record found, but SSL certificates are managed by the hosting platform.", recommendation: "No action required — certificate issuance is handled by the platform." });
      } else {
        findings.push({ id: "TLS-CAA", test: "CAA Record Present", severity: "info", status: "pass", detail: "CAA DNS record found — certificate issuance is restricted", evidence: { records: caaData.Answer.map((a: any) => a.data) } });
      }
    } catch {}

    // Certificate Transparency - wildcard check
    try {
      const ctResponse = await fetch(`https://crt.sh/?q=${hostname}&output=json`, { signal: AbortSignal.timeout(10000) });
      if (ctResponse.ok) {
        const certs = await ctResponse.json();
        const wildcardCerts = certs.filter((c: any) => c.common_name?.startsWith("*."));
        if (wildcardCerts.length > 0) {
          findings.push({ id: "TLS-WILD", test: "Wildcard Certificate in Use", severity: "low", status: "fail", detail: `Wildcard certificate detected. If the private key is compromised, ALL subdomains are affected.`, recommendation: "Consider individual certificates per subdomain for critical services." });
        }
      }
    } catch {}

    return new Response(JSON.stringify({ success: true, test: "tls_deep_scan", findingsCount: findings.length, findings, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, test: "tls_deep_scan", error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
