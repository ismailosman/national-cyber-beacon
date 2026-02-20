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

    const parts = hostname.split(".");
    let rootDomain: string;
    if (parts.length >= 3 && ["gov", "edu", "com", "org"].includes(parts[parts.length - 2])) {
      rootDomain = parts.slice(-3).join(".");
    } else {
      rootDomain = parts.slice(-2).join(".");
    }

    const subdomains = new Set<string>();
    try {
      const ctResponse = await fetch(`https://crt.sh/?q=%.${rootDomain}&output=json`, { signal: AbortSignal.timeout(20000) });
      if (ctResponse.ok) {
        const certs = await ctResponse.json();
        for (const cert of certs) {
          const names = (cert.name_value || "").split("\n");
          for (const name of names) {
            const cleanName = name.trim().toLowerCase().replace(/^\*\./, "");
            if (cleanName.endsWith(rootDomain) && cleanName !== rootDomain) {
              subdomains.add(cleanName);
            }
          }
        }
      }
    } catch (e: any) {
      findings.push({ id: "SUB-ERR", test: "Subdomain Discovery", severity: "info", status: "info", detail: `CT query failed: ${e.message}` });
    }

    const subdomainList = Array.from(subdomains);
    findings.push({ id: "SUB-COUNT", test: "Subdomain Count", severity: subdomainList.length > 20 ? "medium" : "info", status: subdomainList.length > 20 ? "fail" : "info", detail: `Found ${subdomainList.length} unique subdomain(s) for ${rootDomain}`, recommendation: subdomainList.length > 20 ? "Large attack surface. Review and decommission unused subdomains." : undefined, evidence: { rootDomain, totalSubdomains: subdomainList.length } });

    const dangerousPatterns = ["admin", "test", "dev", "staging", "beta", "old", "backup", "internal", "vpn", "ftp", "db", "database", "phpmyadmin", "cpanel", "webmail", "jenkins", "gitlab", "git", "jira", "debug", "temp", "demo", "sandbox", "uat"];
    const liveSubdomains: any[] = [];
    const dangerousSubdomains: any[] = [];
    const toCheck = subdomainList.slice(0, 30);

    for (const subdomain of toCheck) {
      try {
        const dnsResponse = await fetch(`https://dns.google/resolve?name=${subdomain}&type=A`, { signal: AbortSignal.timeout(3000) });
        const dnsData = await dnsResponse.json();
        if (dnsData.Answer && dnsData.Answer.length > 0) {
          const ip = dnsData.Answer[0].data;
          const entry: any = { subdomain, ip };
          liveSubdomains.push(entry);

          const subPrefix = subdomain.split(".")[0].toLowerCase();
          if (dangerousPatterns.some(p => subPrefix.includes(p))) {
            dangerousSubdomains.push({ subdomain, ip, pattern: subPrefix });
          }

          try {
            const httpResponse = await fetch(`https://${subdomain}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
            entry.tech = [httpResponse.headers.get("server"), httpResponse.headers.get("x-powered-by")].filter(Boolean).join(", ") || "unknown";
            entry.status = httpResponse.status;
          } catch {
            try {
              const httpResponse = await fetch(`http://${subdomain}`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(3000) });
              if (httpResponse.status === 200) entry.httpOnly = true;
            } catch {}
          }
        }
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (liveSubdomains.length > 0) {
      findings.push({ id: "SUB-LIVE", test: "Live Subdomains Discovered", severity: liveSubdomains.length > 10 ? "medium" : "low", status: "fail", detail: `${liveSubdomains.length} subdomain(s) are live and reachable.`, recommendation: "Audit all live subdomains. Decommission unused ones.", evidence: { liveSubdomains: liveSubdomains.map(s => ({ subdomain: s.subdomain, ip: s.ip, tech: s.tech || "unknown", httpOnly: s.httpOnly || false })) } });
    }

    const httpOnlySubdomains = liveSubdomains.filter(s => s.httpOnly);
    if (httpOnlySubdomains.length > 0) {
      findings.push({ id: "SUB-HTTP", test: "Subdomains Without SSL", severity: "high", status: "fail", detail: `${httpOnlySubdomains.length} subdomain(s) serve content over HTTP without SSL.`, recommendation: "Install SSL certificates on ALL subdomains.", evidence: { subdomains: httpOnlySubdomains.map(s => s.subdomain) } });
    }

    if (dangerousSubdomains.length > 0) {
      findings.push({ id: "SUB-DANGER", test: "High-Risk Subdomains Exposed", severity: "high", status: "fail", detail: `Found ${dangerousSubdomains.length} potentially dangerous subdomain(s): ${dangerousSubdomains.map(s => s.subdomain).join(", ")}`, recommendation: "Restrict access to internal/development subdomains via VPN or IP whitelist.", evidence: { subdomains: dangerousSubdomains } });
    }

    return new Response(JSON.stringify({ success: true, test: "subdomain_discovery", findingsCount: findings.length, findings, subdomains: subdomainList, liveSubdomains, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, test: "subdomain_discovery", error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
