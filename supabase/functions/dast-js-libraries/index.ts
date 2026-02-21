import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const vulnerableLibraries = [
  { name: "jQuery", patterns: [/jquery[.-]?([\d.]+)/i, /jquery\.min\.js\?ver=([\d.]+)/i], minSafe: "3.5.0", criticalBelow: "2.0.0", cves: { "< 3.5.0": "CVE-2020-11022 (XSS)", "< 3.0.0": "CVE-2015-9251 (XSS)" } },
  { name: "Angular", patterns: [/angular[.-]?([\d.]+)/i], minSafe: "1.8.0", criticalBelow: "1.6.0", cves: { "< 1.6.0": "Multiple XSS vulnerabilities" } },
  { name: "Bootstrap", patterns: [/bootstrap[.-]?([\d.]+)/i], minSafe: "5.3.0", criticalBelow: "3.4.0", cves: { "< 3.4.0": "CVE-2018-14042 (XSS)" } },
  { name: "Lodash", patterns: [/lodash[.-]?([\d.]+)/i], minSafe: "4.17.21", criticalBelow: "4.17.11", cves: { "< 4.17.21": "CVE-2021-23337 (Command Injection)" } },
  { name: "Moment.js", patterns: [/moment[.-]?([\d.]+)/i], minSafe: "2.29.4", criticalBelow: "2.19.3", cves: { "< 2.29.4": "CVE-2022-31129 (ReDoS)" } },
  { name: "Handlebars", patterns: [/handlebars[.-]?([\d.]+)/i], minSafe: "4.7.7", criticalBelow: "4.5.3", cves: { "< 4.7.7": "CVE-2021-23369 (RCE)" } },
  { name: "Axios", patterns: [/axios[.-]?([\d.]+)/i], minSafe: "1.6.0", criticalBelow: "0.21.1", cves: { "< 0.21.1": "CVE-2020-28168 (SSRF)" } },
];

function compareVersions(v1: string, v2: string): number {
  const a = v1.split(".").map(Number);
  const b = v2.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const findings: any[] = [];

    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const html = await response.text();

    const scriptPattern = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let match;
    const scriptUrls: string[] = [];
    while ((match = scriptPattern.exec(html)) !== null) {
      scriptUrls.push(match[1]);
    }

    const fullContent = html + " " + scriptUrls.join(" ");
    const detectedLibraries: any[] = [];

    for (const lib of vulnerableLibraries) {
      for (const pattern of lib.patterns) {
        const versionMatch = fullContent.match(pattern);
        if (versionMatch && versionMatch[1]) {
          detectedLibraries.push({ name: lib.name, version: versionMatch[1], minSafe: lib.minSafe, criticalBelow: lib.criticalBelow, cves: lib.cves });
          break;
        }
      }
    }

    for (const lib of detectedLibraries) {
      if (compareVersions(lib.version, lib.criticalBelow) < 0) {
        const relevantCves = Object.entries(lib.cves).filter(([range]) => compareVersions(lib.version, range.replace("< ", "")) < 0).map(([, cve]) => cve);
        findings.push({ id: `JS-CRIT-${lib.name}`, test: `Critically Outdated: ${lib.name} ${lib.version}`, severity: "critical", status: "fail", detail: `${lib.name} ${lib.version} is critically outdated (safe: ${lib.minSafe}). ${relevantCves.length > 0 ? `CVEs: ${relevantCves.join(", ")}` : ""}`, recommendation: `Update ${lib.name} to ${lib.minSafe}+`, evidence: { library: lib.name, detected: lib.version, safest: lib.minSafe } });
      } else if (compareVersions(lib.version, lib.minSafe) < 0) {
        findings.push({ id: `JS-OLD-${lib.name}`, test: `Outdated: ${lib.name} ${lib.version}`, severity: "medium", status: "fail", detail: `${lib.name} ${lib.version} is outdated. Latest safe: ${lib.minSafe}`, recommendation: `Update ${lib.name} to ${lib.minSafe}+`, evidence: { library: lib.name, detected: lib.version } });
      } else {
        findings.push({ id: `JS-OK-${lib.name}`, test: `${lib.name} ${lib.version}`, severity: "info", status: "pass", detail: `${lib.name} ${lib.version} is current` });
      }
    }

    // SRI check
    const externalScriptsWithoutSRI: string[] = [];
    const sriPattern = /<script[^>]*src=["']https?:\/\/[^"']+["'][^>]*>/gi;
    let sriMatch;
    while ((sriMatch = sriPattern.exec(html)) !== null) {
      if (!sriMatch[0].includes("integrity=")) {
        const srcMatch = sriMatch[0].match(/src=["']([^"']+)["']/);
        if (srcMatch) externalScriptsWithoutSRI.push(srcMatch[1]);
      }
    }
    if (externalScriptsWithoutSRI.length > 0) {
      findings.push({ id: "JS-SRI", test: "Subresource Integrity (SRI)", severity: "low", status: "info", detail: `${externalScriptsWithoutSRI.length} external script(s) without SRI hash. SRI is a defense-in-depth best practice but not a direct vulnerability.`, recommendation: "Consider adding integrity attributes to external script tags for additional protection.", evidence: { scripts: externalScriptsWithoutSRI.slice(0, 5) } });
    }

    if (detectedLibraries.length === 0) {
      findings.push({ id: "JS-NONE", test: "JavaScript Library Detection", severity: "info", status: "info", detail: "No common libraries detected with identifiable versions" });
    }

    return new Response(JSON.stringify({ success: true, test: "javascript_libraries", findingsCount: findings.length, findings, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, test: "javascript_libraries", error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
