/* ─── ITU Pre-Assessment Scanner ───
   Triggers real edge-function scans for all monitored organizations
   and saves results to the DB tables the ITU assessment reads from.
*/
import { supabase } from '@/integrations/supabase/client';

interface MonitoredOrg {
  id: string;
  name: string;
  url: string;
  sector: string;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function invokeQuiet(fnName: string, body: Record<string, unknown>): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) { console.warn(`[ITU-scan] ${fnName} error:`, error); return null; }
    return data;
  } catch (e) { console.warn(`[ITU-scan] ${fnName} exception:`, e); return null; }
}

/* ── Scan a single org and save results to all relevant tables ── */
async function scanOrg(org: MonitoredOrg, onProgress?: (msg: string) => void) {
  const hostname = (() => { try { return new URL(org.url).hostname; } catch { return org.url.replace(/^https?:\/\//, ''); } })();

  // 1. SSL
  onProgress?.(`Checking SSL for ${org.name}...`);
  const sslData = await invokeQuiet('check-ssl', { url: org.url });
  if (sslData?.results?.[0]) {
    const ssl = sslData.results[0].ssl;
    await supabase.from('ssl_logs').insert({
      organization_id: org.id, organization_name: org.name, url: org.url,
      is_valid: ssl.isValid ?? false, is_expired: ssl.isExpired ?? false,
      is_expiring_soon: ssl.isExpiringSoon ?? false, issuer: ssl.issuer || null,
      protocol: ssl.protocol || null, valid_from: ssl.validFrom || null,
      valid_to: ssl.validTo || null, days_until_expiry: ssl.daysUntilExpiry ?? null,
    });
  }

  // 2. DDoS risk
  onProgress?.(`Checking DDoS protection for ${org.name}...`);
  const ddosData = await invokeQuiet('check-ddos-risk', { urls: [org.url] });
  if (ddosData?.results?.[0]) {
    const dp = ddosData.results[0].ddosProtection;
    const riskFactors: string[] = [];
    let riskLevel = 'low';
    if (dp.originExposed) { riskFactors.push('Origin IP exposed'); riskLevel = 'medium'; }
    if (!dp.hasCDN) { riskFactors.push('No CDN'); riskLevel = 'medium'; }
    if (!dp.hasWAF) riskFactors.push('No WAF');
    if (!dp.hasRateLimiting) riskFactors.push('No rate limiting');
    if (riskFactors.length >= 3) riskLevel = 'high';
    await supabase.from('ddos_risk_logs').insert({
      organization_id: org.id, organization_name: org.name, url: org.url,
      has_cdn: dp.hasCDN, cdn_provider: dp.cdnProvider, has_waf: dp.hasWAF,
      has_rate_limiting: dp.hasRateLimiting, origin_exposed: dp.originExposed,
      protection_headers: dp.protectionHeaders || [], server_header: dp.serverHeader,
      risk_level: riskLevel, risk_factors: riskFactors,
    });
  }

  // 3. Security Headers → early_warning_logs
  onProgress?.(`Checking security headers for ${org.name}...`);
  const headersData = await invokeQuiet('check-security-headers', { urls: [org.url] });
  if (headersData?.results?.[0] && headersData.results[0].success) {
    const r = headersData.results[0];
    const riskLevel = r.score >= 5 ? 'safe' : r.score >= 3 ? 'warning' : 'critical';
    await supabase.from('early_warning_logs').insert({
      organization_id: org.id, organization_name: org.name, url: r.url,
      check_type: 'security_headers', risk_level: riskLevel,
      details: { headers: r.headers, score: r.score, maxScore: r.maxScore, grade: r.grade },
    });
  }

  // 4. DNS / Email security → early_warning_logs
  onProgress?.(`Checking DNS & email security for ${org.name}...`);
  const dnsData = await invokeQuiet('check-dns', { domains: [hostname] });
  if (dnsData?.results?.[0]) {
    const r = dnsData.results[0];
    await supabase.from('early_warning_logs').insert({
      organization_id: org.id, organization_name: org.name, url: org.url,
      check_type: 'dns_email', risk_level: r.emailSecurity?.spfExists ? 'safe' : 'warning',
      details: { records: r.records, emailSecurity: r.emailSecurity },
    });
  }

  // 5. Open Ports → early_warning_logs
  onProgress?.(`Checking open ports for ${org.name}...`);
  const portsData = await invokeQuiet('check-ports', { hostnames: [hostname] });
  if (portsData?.results?.[0]) {
    const r = portsData.results[0];
    let riskLevel = 'safe';
    if (r.criticalPorts > 0) riskLevel = 'critical';
    else if (r.totalOpen > 0) riskLevel = 'warning';
    await supabase.from('early_warning_logs').insert({
      organization_id: org.id, organization_name: org.name, url: org.url,
      check_type: 'open_ports', risk_level: riskLevel,
      details: { openPorts: r.openPorts, totalOpen: r.totalOpen, criticalPorts: r.criticalPorts, portsAvailable: r.portsAvailable },
    });
  }

  // 6. Tech fingerprinting
  onProgress?.(`Fingerprinting technology for ${org.name}...`);
  const techData = await invokeQuiet('fingerprint-tech', { urls: [org.url] });
  if (techData?.results?.[0]?.technologies) {
    const r = techData.results[0];
    const t = r.technologies;
    await supabase.from('tech_fingerprints' as any).upsert({
      organization_id: org.id, url: r.url,
      web_server: t.webServer, web_server_version: t.webServerVersion,
      language: t.language, language_version: t.languageVersion,
      cms: t.cms, cms_version: t.cmsVersion,
      cdn: t.cdn, js_libraries: t.jsLibraries || [],
      checked_at: r.checkedAt,
    }, { onConflict: 'url' });
  }

  // 7. Uptime ping
  const pingData = await invokeQuiet('ping-website', { url: org.url });
  if (pingData) {
    await supabase.from('uptime_logs').insert({
      organization_id: org.id, organization_name: org.name, url: org.url,
      status: pingData.status || (pingData.ok ? 'up' : 'down'),
      status_code: pingData.statusCode || pingData.status_code || null,
      response_time_ms: pingData.responseTime || pingData.response_time_ms || null,
    });
  }
}

/* ── Main: scan all monitored orgs for national-level ITU assessment ── */
export async function runITUPreScans(
  targetOrgId: string,
  onProgress?: (msg: string) => void
): Promise<void> {
  // Fetch all monitored orgs
  const { data: allOrgs } = await supabase
    .from('organizations_monitored')
    .select('id, name, url, sector')
    .eq('is_active', true);

  const orgs = (allOrgs || []) as MonitoredOrg[];
  if (orgs.length === 0) return;

  // Scan the target org first (full scan)
  const targetOrg = orgs.find(o => o.id === targetOrgId);
  if (targetOrg) {
    onProgress?.(`Running full scan for ${targetOrg.name}...`);
    await scanOrg(targetOrg, onProgress);
  }

  // Scan remaining orgs (for national-level controls like gov SSL, DDoS coverage)
  const otherOrgs = orgs.filter(o => o.id !== targetOrgId);
  for (let i = 0; i < otherOrgs.length; i++) {
    const org = otherOrgs[i];
    onProgress?.(`Scanning organizations for national assessment (${i + 1}/${otherOrgs.length})...`);
    await scanOrg(org);
    // Small delay between orgs to avoid rate limiting
    if (i < otherOrgs.length - 1) await delay(1000);
  }

  // Fetch threat intelligence (global, not per-org)
  onProgress?.('Fetching threat intelligence feeds...');
  const tiData = await invokeQuiet('fetch-threat-intel', { orgTechnologies: [] });
  if (tiData) {
    // Save a summary to threat_intelligence_logs for the target org
    const entries: any[] = [];
    if (tiData.cisaKEV?.length > 0) {
      entries.push({
        organization_id: targetOrgId, organization_name: targetOrg?.name || '',
        check_type: 'cisa_kev', risk_level: 'info',
        details: { count: tiData.cisaKEV.length, latest: tiData.cisaKEV.slice(0, 5) },
      });
    }
    if (tiData.latestCVEs?.length > 0) {
      entries.push({
        organization_id: targetOrgId, organization_name: targetOrg?.name || '',
        check_type: 'nvd_cves', risk_level: tiData.latestCVEs.some((c: any) => c.severity === 'critical') ? 'critical' : 'info',
        details: { count: tiData.latestCVEs.length, latest: tiData.latestCVEs.slice(0, 5) },
      });
    }
    if (entries.length > 0) {
      await supabase.from('threat_intelligence_logs').insert(entries);
    }
  }

  // Allow DB writes to settle
  onProgress?.('Finalizing scan data...');
  await delay(2000);
}
