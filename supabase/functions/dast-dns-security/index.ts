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

    // Detect Cloudflare nameservers early
    let isCloudflare = false;
    let nsRecords: string[] = [];
    try {
      const nsResponse = await fetch(`https://dns.google/resolve?name=${hostname}&type=NS`, { signal: AbortSignal.timeout(5000) });
      const nsData = await nsResponse.json();
      nsRecords = (nsData.Answer || []).map((a: any) => a.data);
      if (nsRecords.some((ns: string) => ns.toLowerCase().includes("cloudflare"))) {
        isCloudflare = true;
      }
    } catch {}

    // DNSSEC check
    try {
      const dnssecResponse = await fetch(`https://dns.google/resolve?name=${hostname}&type=A&do=true`, { signal: AbortSignal.timeout(5000) });
      const dnssecData = await dnssecResponse.json();
      if (dnssecData.AD) {
        findings.push({ id: "DNS-DNSSEC-OK", test: "DNSSEC Enabled", severity: "info", status: "pass", detail: "DNSSEC is enabled and validated — DNS responses are authenticated" });
      } else if (isCloudflare) {
        findings.push({ id: "DNS-DNSSEC-CF", test: "DNSSEC Managed by Cloudflare", severity: "info", status: "pass", detail: "DNSSEC is managed by Cloudflare. Google DNS may not always report the AD flag for Cloudflare-proxied domains." });
      } else {
        findings.push({ id: "DNS-DNSSEC-MISS", test: "DNSSEC Not Enabled", severity: "medium", status: "fail", detail: "DNSSEC is not enabled. DNS responses can be spoofed by attackers (DNS cache poisoning).", recommendation: "Enable DNSSEC at your domain registrar and DNS provider." });
      }
    } catch {}

    // SPF record
    try {
      const spfResponse = await fetch(`https://dns.google/resolve?name=${hostname}&type=TXT`, { signal: AbortSignal.timeout(5000) });
      const spfData = await spfResponse.json();
      const txtRecords = (spfData.Answer || []).map((a: any) => a.data).filter((d: string) => d.includes("v=spf1"));
      if (txtRecords.length === 0) {
        findings.push({ id: "DNS-SPF-MISS", test: "SPF Record Missing", severity: "high", status: "fail", detail: "No SPF record found. Attackers can send emails pretending to be from this domain.", recommendation: "Add an SPF TXT record, e.g.: v=spf1 include:_spf.google.com ~all" });
      } else if (txtRecords.length > 1) {
        findings.push({ id: "DNS-SPF-MULTI", test: "Multiple SPF Records", severity: "medium", status: "fail", detail: `${txtRecords.length} SPF records found. Only one is allowed per RFC 7208.`, recommendation: "Merge all SPF records into a single TXT record." });
      } else {
        const spf = txtRecords[0];
        if (spf.includes("+all")) {
          findings.push({ id: "DNS-SPF-OPEN", test: "SPF Too Permissive", severity: "critical", status: "fail", detail: "SPF record uses +all — this allows ANY server to send email as your domain.", recommendation: "Change +all to ~all or -all" });
        } else {
          findings.push({ id: "DNS-SPF-OK", test: "SPF Record Present", severity: "info", status: "pass", detail: "SPF record is properly configured", evidence: { spf } });
        }
      }
    } catch {}

    // DMARC record
    try {
      const dmarcResponse = await fetch(`https://dns.google/resolve?name=_dmarc.${hostname}&type=TXT`, { signal: AbortSignal.timeout(5000) });
      const dmarcData = await dmarcResponse.json();
      const dmarcRecords = (dmarcData.Answer || []).map((a: any) => a.data).filter((d: string) => d.includes("v=DMARC1"));
      if (dmarcRecords.length === 0) {
        findings.push({ id: "DNS-DMARC-MISS", test: "DMARC Record Missing", severity: "high", status: "fail", detail: "No DMARC record found. Email spoofing attacks cannot be detected or prevented.", recommendation: "Add a DMARC record: _dmarc.domain.com TXT \"v=DMARC1; p=quarantine; rua=mailto:dmarc@domain.com\"" });
      } else {
        const dmarc = dmarcRecords[0];
        const policyMatch = dmarc.match(/p=(none|quarantine|reject)/i);
        const policy = policyMatch ? policyMatch[1].toLowerCase() : "unknown";
        if (policy === "none") {
          findings.push({ id: "DNS-DMARC-NONE", test: "DMARC Policy (Monitoring)", severity: "low", status: "info", detail: "DMARC policy is 'none' (monitoring mode). This is a valid initial deployment phase for collecting reports before enforcing.", recommendation: "Consider upgrading to p=quarantine or p=reject after reviewing DMARC reports." });
        } else {
          findings.push({ id: "DNS-DMARC-OK", test: "DMARC Record Present", severity: "info", status: "pass", detail: `DMARC policy: ${policy}`, evidence: { dmarc } });
        }
      }
    } catch {}

    // MX records analysis
    try {
      const mxResponse = await fetch(`https://dns.google/resolve?name=${hostname}&type=MX`, { signal: AbortSignal.timeout(5000) });
      const mxData = await mxResponse.json();
      const mxRecords = (mxData.Answer || []).map((a: any) => a.data);
      if (mxRecords.length > 0) {
        findings.push({ id: "DNS-MX", test: "MX Records", severity: "info", status: "info", detail: `Found ${mxRecords.length} MX record(s)`, evidence: { mx: mxRecords.slice(0, 5) } });
      }
    } catch {}

    // NS records (already fetched above)
    if (nsRecords.length > 0) {
      findings.push({ id: "DNS-NS", test: "Nameservers", severity: "info", status: "info", detail: `Using ${nsRecords.length} nameserver(s)`, evidence: { ns: nsRecords } });

      const uniqueProviders = new Set(nsRecords.map((ns: string) => ns.split(".").slice(-2).join(".")));
      if (uniqueProviders.size === 1) {
        if (isCloudflare) {
          findings.push({ id: "DNS-NS-CF", test: "Single DNS Provider (Cloudflare)", severity: "info", status: "pass", detail: "All nameservers are from Cloudflare, which provides built-in redundancy across its global anycast network." });
        } else {
          findings.push({ id: "DNS-NS-SINGLE", test: "Single DNS Provider", severity: "low", status: "fail", detail: "All nameservers are from a single provider. If that provider has an outage, your domain goes offline.", recommendation: "Consider using a secondary DNS provider for redundancy" });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, test: "dns_security", findingsCount: findings.length, findings, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, test: "dns_security", error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
