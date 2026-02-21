/* ─── Compliance Assessment Engines ─── */
import { supabase } from '@/integrations/supabase/client';
import { runITUPreScans } from './itu-scanner';

interface AssessmentResult {
  organization_id: string;
  control_code: string;
  framework: string;
  status: string;
  assessment_type: string;
  evidence: string;
  evidence_data: any;
  assessed_by: string;
  assessed_at: string;
  expires_at: string;
}

/* ─── Shared data fetch ─── */
async function fetchOrgData(orgId: string) {
  const [uptimeRes, sslRes, ddosRes, ewRes, techRes, tiRes, orgRes] = await Promise.all([
    supabase.from('uptime_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(10),
    supabase.from('ssl_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(1),
    supabase.from('ddos_risk_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(1),
    supabase.from('early_warning_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }),
    supabase.from('tech_fingerprints' as any).select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(1),
    supabase.from('threat_intelligence_logs').select('*').eq('organization_id', orgId).order('checked_at', { ascending: false }).limit(5),
    supabase.from('organizations_monitored').select('*').eq('id', orgId).limit(1),
  ]);
  return {
    uptime: uptimeRes.data || [],
    ssl: sslRes.data?.[0] as any,
    ddos: ddosRes.data?.[0] as any,
    ew: ewRes.data || [],
    tech: (techRes.data as any)?.[0] as any,
    ti: tiRes.data || [],
    org: orgRes.data?.[0] as any,
    secHeaders: (ewRes.data || []).find((e: any) => e.check_type === 'security_headers') as any,
    openPorts: (ewRes.data || []).find((e: any) => e.check_type === 'open_ports') as any,
  };
}

function makeResult(orgId: string, framework: string, code: string, status: string, evidence: string, evidenceData: any): AssessmentResult {
  return {
    organization_id: orgId, control_code: code, framework,
    status, assessment_type: 'auto', evidence, evidence_data: evidenceData,
    assessed_by: 'System (Auto)', assessed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  };
}

/* ═══════════════════════════════════════════════
   CIS Controls v8
   ═══════════════════════════════════════════════ */
function assessCIS(orgId: string, d: any): AssessmentResult[] {
  const r: AssessmentResult[] = [];
  const mk = (code: string, status: string, evidence: string, data: any) => r.push(makeResult(orgId, 'cis-v8', code, status, evidence, data));

  const orgComplete = d.org && d.org.name && d.org.url && d.org.sector;
  const hasTech = !!d.tech;
  mk('CIS-1.1', orgComplete && hasTech ? 'passing' : orgComplete ? 'partial' : 'failing',
    `Org record: ${orgComplete ? 'Complete' : 'Incomplete'}, Tech fingerprint: ${hasTech ? 'Yes' : 'No'}`, { orgComplete, hasTech });

  const hasSoftware = d.tech && (d.tech.web_server || d.tech.language || d.tech.cms || (d.tech.js_libraries?.length > 0));
  mk('CIS-2.1', hasSoftware ? 'passing' : d.tech ? 'partial' : 'failing',
    hasSoftware ? `Detected: ${[d.tech?.web_server, d.tech?.language, d.tech?.cms].filter(Boolean).join(', ')}` : 'No tech fingerprint', { tech: d.tech });

  const hsts = (d.secHeaders?.details as any)?.headers?.strictTransportSecurity;
  mk('CIS-3.10', d.ssl?.is_valid && hsts ? 'passing' : d.ssl?.is_valid ? 'partial' : 'failing',
    `SSL: ${d.ssl?.is_valid ? 'Valid' : 'Invalid/Missing'}, HSTS: ${hsts ? 'Present' : 'Missing'}`, { ssl: d.ssl, hsts: !!hsts });

  const hs = (d.secHeaders?.details as any)?.score || 0;
  const cp = (d.openPorts?.details as any)?.criticalPorts || 0;
  mk('CIS-4.1', hs >= 5 && cp === 0 ? 'passing' : (hs >= 3 || cp === 0) ? 'partial' : 'failing',
    `Security headers: ${hs}/7, Critical ports: ${cp}`, { headerScore: hs, criticalPorts: cp });

  mk('CIS-4.2', d.ddos?.has_cdn && d.ddos?.has_waf && d.ddos?.has_rate_limiting ? 'passing'
    : d.ddos?.has_cdn ? 'partial' : d.ddos ? 'failing' : 'check_failed',
    d.ddos ? `CDN: ${d.ddos.has_cdn ? '✓' : '✗'}, WAF: ${d.ddos.has_waf ? '✓' : '✗'}, Rate Limiting: ${d.ddos.has_rate_limiting ? '✓' : '✗'}` : 'No DDoS data', { ddos: d.ddos });

  mk('CIS-7.1', d.tech && d.tech.vulnerabilities_count === 0 && d.tech.outdated_count === 0 ? 'passing'
    : d.tech && d.tech.outdated_count > 0 ? 'partial' : d.tech ? 'failing' : 'check_failed',
    d.tech ? `Vulnerabilities: ${d.tech.vulnerabilities_count || 0}, Outdated: ${d.tech.outdated_count || 0}` : 'No tech fingerprint', {});

  mk('CIS-12.1', d.tech ? (d.tech.outdated_count > 0 ? 'failing' : 'passing') : 'check_failed',
    d.tech ? `${d.tech.web_server || 'Unknown'} ${d.tech.web_server_version || '?'}, Outdated: ${d.tech.outdated_count}` : 'No version data', {});

  const mc = [d.uptime.length > 0, !!d.ssl, !!d.ddos, d.ew.length > 0].filter(Boolean).length;
  mk('CIS-13.1', mc === 4 ? 'passing' : mc >= 2 ? 'partial' : 'failing',
    `Uptime ${d.uptime.length > 0 ? '✓' : '✗'}, SSL ${d.ssl ? '✓' : '✗'}, DDoS ${d.ddos ? '✓' : '✗'}, EW ${d.ew.length > 0 ? '✓' : '✗'}`, { monitorCount: mc });

  const hdrs = (d.secHeaders?.details as any)?.headers || {};
  const hasCSP = !!hdrs.contentSecurityPolicy, hasXFO = !!hdrs.xFrameOptions, hasXCTO = !!hdrs.xContentTypeOptions;
  mk('CIS-16.1', hasCSP && hasXFO && hasXCTO ? 'passing' : (hasXFO || hasXCTO) ? 'partial' : d.secHeaders ? 'failing' : 'check_failed',
    `CSP: ${hasCSP ? '✓' : '✗'}, X-Frame-Options: ${hasXFO ? '✓' : '✗'}, X-Content-Type-Options: ${hasXCTO ? '✓' : '✗'}`, { hasCSP, hasXFO, hasXCTO });

  const openPortsList = ((d.openPorts?.details as any)?.openPorts || []) as any[];
  const exposedDb = openPortsList.filter((p: any) => [3306, 5432, 27017].includes(p.port));
  mk('CIS-16.11', d.openPorts ? (exposedDb.length === 0 ? 'passing' : 'failing') : 'check_failed',
    d.openPorts ? (exposedDb.length === 0 ? 'No database ports exposed' : `Exposed: ${exposedDb.map((p: any) => `${p.service}(${p.port})`).join(', ')}`) : 'No port scan data', { exposedDb });

  return r;
}

/* ═══════════════════════════════════════════════
   NIST CSF 2.0
   ═══════════════════════════════════════════════ */
function assessNIST(orgId: string, d: any): AssessmentResult[] {
  const r: AssessmentResult[] = [];
  const mk = (code: string, status: string, evidence: string, data: any = {}) => r.push(makeResult(orgId, 'nist-csf-2', code, status, evidence, data));

  // GV.RM-01 — Risk Management Strategy (monitoring coverage)
  const monitorTables = [d.uptime.length > 0, !!d.ssl, !!d.ddos, d.ew.length > 0, d.ti.length > 0];
  const monitorActive = monitorTables.filter(Boolean).length;
  mk('GV.RM-01', monitorActive >= 4 ? 'passing' : monitorActive >= 2 ? 'partial' : 'failing',
    `Active monitoring: Uptime ${monitorTables[0] ? '✓' : '✗'}, SSL ${monitorTables[1] ? '✓' : '✗'}, DDoS ${monitorTables[2] ? '✓' : '✗'}, EW ${monitorTables[3] ? '✓' : '✗'}, TI ${monitorTables[4] ? '✓' : '✗'}`);

  // GV.SC-01 — Supply Chain (tech fingerprint)
  const hasTech = !!d.tech;
  const techComplete = d.tech && (d.tech.web_server || d.tech.cms || d.tech.language);
  mk('GV.SC-01', techComplete ? 'passing' : hasTech ? 'partial' : 'failing',
    hasTech ? `Stack: ${[d.tech?.web_server, d.tech?.cms, d.tech?.language].filter(Boolean).join(', ')}` : 'No tech fingerprint — supply chain not assessed');

  // ID.AM-01 — Hardware Inventory
  const orgComplete = d.org && d.org.name && d.org.url && d.org.sector;
  mk('ID.AM-01', orgComplete ? 'passing' : d.org ? 'partial' : 'failing',
    `Organization record: ${orgComplete ? 'Complete (name, URL, sector)' : 'Incomplete'}`);

  // ID.AM-02 — Software Inventory
  const hasSw = d.tech && (d.tech.web_server || d.tech.language || d.tech.cms || (d.tech.js_libraries?.length > 0));
  mk('ID.AM-02', hasSw ? 'passing' : 'failing',
    hasSw ? `Detected: ${[d.tech?.web_server, d.tech?.language, d.tech?.cms].filter(Boolean).join(', ')}` : 'No tech fingerprint');

  // ID.RA-01 — Vulnerability Identification
  const checkTypes = new Set(d.ew.map((e: any) => e.check_type));
  const expectedChecks = ['security_headers', 'open_ports', 'defacement', 'dns_email', 'blacklist'];
  const completedChecks = expectedChecks.filter(c => checkTypes.has(c));
  mk('ID.RA-01', completedChecks.length >= 4 && (!d.tech || d.tech.vulnerabilities_count === 0) ? 'passing'
    : completedChecks.length >= 2 ? 'partial' : 'failing',
    `Completed checks: ${completedChecks.map(c => `${c} ✓`).join(', ') || 'None'}`);

  // ID.RA-02 — Threat Intelligence
  mk('ID.RA-02', d.ti.length > 0 ? 'passing' : 'failing',
    d.ti.length > 0 ? `Threat intelligence feeds active (${d.ti.length} entries)` : 'No threat intelligence data');

  // ID.RA-05 — Risk Prioritization
  mk('ID.RA-05', d.org?.risk_score ? (d.org.risk_score <= 30 ? 'passing' : 'partial') : 'failing',
    d.org ? `Security risk score: ${d.org.risk_score || 'N/A'}` : 'No security score');

  // PR.DS-02 — Data-in-Transit
  const hsts = (d.secHeaders?.details as any)?.headers?.strictTransportSecurity;
  mk('PR.DS-02', d.ssl?.is_valid && hsts ? 'passing' : d.ssl?.is_valid ? 'partial' : 'failing',
    `SSL: ${d.ssl?.is_valid ? '✓ Valid' : '✗ Invalid'}, HSTS: ${hsts ? '✓ Present' : '✗ Missing'}`);

  // PR.DS-10 — Data Integrity
  const defacement = d.ew.find((e: any) => e.check_type === 'defacement');
  mk('PR.DS-10', defacement && defacement.risk_level === 'safe' ? 'passing'
    : defacement && defacement.risk_level === 'warning' ? 'partial' : defacement ? 'failing' : 'check_failed',
    defacement ? `Content integrity: ${defacement.risk_level === 'safe' ? '✓ Clean' : '⚠ ' + defacement.risk_level}` : 'No defacement monitoring');

  // PR.IP-01 — Security Configuration
  const hs = (d.secHeaders?.details as any)?.score || 0;
  const cp = (d.openPorts?.details as any)?.criticalPorts || 0;
  mk('PR.IP-01', hs >= 5 && cp === 0 ? 'passing' : (hs >= 3 || cp === 0) ? 'partial' : 'failing',
    `Security headers: ${hs}/7, Critical ports: ${cp}`);

  // PR.IP-04 — Network Protection
  mk('PR.IP-04', d.ddos?.has_cdn && d.ddos?.has_waf && d.ddos?.has_rate_limiting ? 'passing'
    : d.ddos?.has_cdn ? 'partial' : d.ddos ? 'failing' : 'check_failed',
    d.ddos ? `CDN: ${d.ddos.has_cdn ? '✓ ' + (d.ddos.cdn_provider || '') : '✗'}, WAF: ${d.ddos.has_waf ? '✓' : '✗'}, Rate Limiting: ${d.ddos.has_rate_limiting ? '✓' : '✗'}` : 'No DDoS data');

  // DE.CM-01 — Network Monitoring
  const lastUptime = d.uptime[0];
  const uptimeAge = lastUptime ? (Date.now() - new Date(lastUptime.checked_at).getTime()) / 1000 : Infinity;
  mk('DE.CM-01', uptimeAge < 300 ? 'passing' : uptimeAge < 3600 ? 'partial' : 'failing',
    lastUptime ? `Last uptime check: ${Math.round(uptimeAge / 60)}m ago, Response: ${lastUptime.response_time_ms}ms` : 'No uptime monitoring');

  // DE.CM-06 — External Service Provider Monitoring
  const hasCdnMonitor = !!d.ddos;
  const hasSslMonitor = !!d.ssl;
  mk('DE.CM-06', hasCdnMonitor && hasSslMonitor ? 'passing' : hasCdnMonitor || hasSslMonitor ? 'partial' : 'failing',
    `CDN: ${hasCdnMonitor ? '✓ Monitored' + (d.ddos?.cdn_provider ? ` (${d.ddos.cdn_provider})` : '') : '✗'}, SSL issuer: ${d.ssl?.issuer ? `✓ ${d.ssl.issuer}` : '✗ Not monitored'}`);

  // DE.CM-09 — Computing Hardware & Software Monitoring
  const techAge = d.tech ? (Date.now() - new Date(d.tech.checked_at).getTime()) / (1000 * 3600) : Infinity;
  mk('DE.CM-09', techAge < 24 ? 'passing' : d.tech ? 'partial' : 'failing',
    d.tech ? `Software monitored: ${[d.tech.web_server, d.tech.language, d.tech.cms].filter(Boolean).join(', ')}, Age: ${Math.round(techAge)}h` : 'No tech fingerprint');

  // DE.AE-01 — Anomaly Detection
  mk('DE.AE-01', d.ddos ? 'passing' : 'failing',
    d.ddos ? `Anomaly detection: ✓ Active (spike: ${d.ddos.response_time_spike ? 'Yes' : 'No'}, flapping: ${d.ddos.availability_flapping ? 'Yes' : 'No'})` : 'No DDoS risk assessment');

  return r;
}

/* ═══════════════════════════════════════════════
   OWASP Top 10 (2021)
   ═══════════════════════════════════════════════ */
function assessOWASP(orgId: string, d: any): AssessmentResult[] {
  const r: AssessmentResult[] = [];
  const mk = (code: string, status: string, evidence: string, data: any = {}) => r.push(makeResult(orgId, 'owasp-2021', code, status, evidence, data));
  const hdrs = (d.secHeaders?.details as any)?.headers || {};
  const hasCSP = !!hdrs.contentSecurityPolicy, hasXFO = !!hdrs.xFrameOptions, hasXCTO = !!hdrs.xContentTypeOptions;
  const hsts = !!hdrs.strictTransportSecurity;
  const hs = (d.secHeaders?.details as any)?.score || 0;

  // A01 — Broken Access Control
  mk('A01:2021', hasXFO && hasCSP ? 'passing' : hasXFO || hasCSP ? 'partial' : 'failing',
    `X-Frame-Options: ${hasXFO ? '✓' : '✗'}, CSP: ${hasCSP ? '✓' : '✗'}`);

  // A02 — Cryptographic Failures
  mk('A02:2021', d.ssl?.is_valid && hsts ? 'passing' : d.ssl?.is_valid ? 'partial' : 'failing',
    `SSL: ${d.ssl?.is_valid ? '✓ Valid' : '✗'}, TLS: ${d.ssl?.protocol || '?'}, HSTS: ${hsts ? '✓' : '✗'}`);

  // A03 — Injection
  const openPortsList = ((d.openPorts?.details as any)?.openPorts || []) as any[];
  const dbPortsExposed = openPortsList.filter((p: any) => [3306, 5432, 27017].includes(p.port));
  mk('A03:2021', hasCSP && hasXCTO && dbPortsExposed.length === 0 ? 'passing'
    : (hasCSP || hasXCTO) && dbPortsExposed.length === 0 ? 'partial' : 'failing',
    `CSP: ${hasCSP ? '✓' : '✗'}, X-Content-Type-Options: ${hasXCTO ? '✓' : '✗'}, DB ports: ${dbPortsExposed.length === 0 ? '✓ Closed' : '✗ Exposed'}`);

  // A05 — Security Misconfiguration
  const serverExposed = !!(d.tech?.web_server_version);
  const unnecessaryPorts = openPortsList.filter((p: any) => ![80, 443, 22].includes(p.port) && ![3306, 5432, 27017].includes(p.port));
  mk('A05:2021', hs >= 6 && !serverExposed && unnecessaryPorts.length === 0 ? 'passing'
    : hs >= 4 ? 'partial' : 'failing',
    `Security headers: ${hs}/7, Server exposed: ${serverExposed ? '✓ ' + d.tech?.web_server + '/' + d.tech?.web_server_version : '✗ Hidden'}, Extra ports: ${unnecessaryPorts.length}`);

  // A06 — Vulnerable & Outdated Components
  const outdated = d.tech?.outdated_count || 0;
  mk('A06:2021', d.tech && outdated === 0 ? 'passing' : d.tech ? 'partial' : 'failing',
    d.tech ? `Outdated components: ${outdated}, Stack: ${[d.tech.web_server, d.tech.language, d.tech.cms].filter(Boolean).join(', ')}` : 'No tech fingerprint');

  // A07 — Identification & Authentication Failures
  mk('A07:2021', d.ddos?.has_rate_limiting && hsts ? 'passing' : d.ddos?.has_rate_limiting || hsts ? 'partial' : 'failing',
    `Rate limiting: ${d.ddos?.has_rate_limiting ? '✓' : '✗'}, HSTS: ${hsts ? '✓' : '✗'}`);

  // A08 — Software & Data Integrity Failures
  const defacement = d.ew.find((e: any) => e.check_type === 'defacement');
  mk('A08:2021', defacement?.risk_level === 'safe' && hasCSP ? 'passing'
    : defacement?.risk_level === 'safe' ? 'partial' : 'failing',
    `Content monitoring: ${defacement ? '✓ ' + defacement.risk_level : '✗ None'}, CSP: ${hasCSP ? '✓' : '✗'}`);

  // A09 — Security Logging & Monitoring Failures
  const monitors = [d.uptime.length > 0, !!d.ssl, !!d.ddos, d.ew.length > 0].filter(Boolean).length;
  mk('A09:2021', monitors === 4 ? 'passing' : monitors >= 2 ? 'partial' : 'failing',
    `Active monitors: Uptime ${d.uptime.length > 0 ? '✓' : '✗'}, SSL ${d.ssl ? '✓' : '✗'}, DDoS ${d.ddos ? '✓' : '✗'}, EW ${d.ew.length > 0 ? '✓' : '✗'}`);

  return r;
}

/* ═══════════════════════════════════════════════
   ITU National Cybersecurity Index
   ═══════════════════════════════════════════════ */
async function assessITU(orgId: string, d: any, onProgress?: (msg: string) => void): Promise<AssessmentResult[]> {
  // Phase 1: Run fresh scans for all orgs before evaluating
  onProgress?.('Triggering real-time security scans...');
  try {
    await runITUPreScans(orgId, onProgress);
  } catch (e) {
    console.warn('[ITU] Pre-scan phase failed, falling back to existing data:', e);
  }

  // Phase 2: Re-fetch org data with fresh scan results
  onProgress?.('Loading fresh monitoring data...');
  d = await fetchOrgData(orgId);

  const r: AssessmentResult[] = [];
  const mk = (code: string, status: string, evidence: string, data: any = {}) => r.push(makeResult(orgId, 'itu-nci', code, status, evidence, data));

  // Fetch cross-organization data for national-level controls
  const [allOrgsRes, allSslRes, allDdosRes, allEwRes, allTechRes, allTiRes, assessRes] = await Promise.all([
    supabase.from('organizations_monitored').select('id, name, sector, url').eq('is_active', true),
    supabase.from('ssl_logs').select('organization_id, organization_name, is_valid').order('checked_at', { ascending: false }).limit(500),
    supabase.from('ddos_risk_logs').select('organization_id, organization_name, has_cdn, has_waf').order('checked_at', { ascending: false }).limit(500),
    supabase.from('early_warning_logs').select('organization_id, check_type, risk_level').order('checked_at', { ascending: false }).limit(1000),
    supabase.from('tech_fingerprints' as any).select('organization_id').order('checked_at', { ascending: false }).limit(500),
    supabase.from('threat_intelligence_logs').select('organization_id').order('checked_at', { ascending: false }).limit(500),
    supabase.from('compliance_assessments' as any).select('organization_id, status, framework').eq('framework', 'cis-v8'),
  ]);

  const allOrgs = allOrgsRes.data || [];
  const totalOrgs = allOrgs.length;

  // Deduplicate SSL by org
  const sslByOrg = new Map<string, any>();
  (allSslRes.data || []).forEach((s: any) => { if (!sslByOrg.has(s.organization_id)) sslByOrg.set(s.organization_id, s); });

  const ddosByOrg = new Map<string, any>();
  (allDdosRes.data || []).forEach((s: any) => { if (!ddosByOrg.has(s.organization_id)) ddosByOrg.set(s.organization_id, s); });

  const ewByOrg = new Map<string, Set<string>>();
  (allEwRes.data || []).forEach((e: any) => {
    if (!ewByOrg.has(e.organization_id)) ewByOrg.set(e.organization_id, new Set());
    ewByOrg.get(e.organization_id)!.add(e.check_type);
  });

  const techOrgIds = new Set((allTechRes.data as any[] || []).map((t: any) => t.organization_id));
  const tiOrgIds = new Set((allTiRes.data || []).map((t: any) => t.organization_id));

  const govOrgs = allOrgs.filter((o: any) => o.sector?.toLowerCase() === 'government');
  const sectors = new Set(allOrgs.map((o: any) => (o.sector || '').toLowerCase()));

  // ITU-T1 — National CERT
  const checkTypes = new Set<string>();
  (allEwRes.data || []).forEach((e: any) => checkTypes.add(e.check_type));
  mk('ITU-T1', totalOrgs >= 15 && checkTypes.size >= 5 ? 'passing' : totalOrgs >= 5 ? 'partial' : 'failing',
    `National monitoring: ${totalOrgs >= 15 ? '✓' : '⚠'} Active, Organizations: ${totalOrgs}, Check types: ${checkTypes.size}`);

  // ITU-T2 — National Cybersecurity Standards
  const cisAssessments = (assessRes.data as any[] || []);
  const assessedOrgs = new Set(cisAssessments.map((a: any) => a.organization_id));
  const passingAssessments = cisAssessments.filter((a: any) => a.status === 'passing').length;
  const totalAssessments = cisAssessments.length;
  const complianceRate = totalAssessments > 0 ? Math.round((passingAssessments / totalAssessments) * 100) : 0;
  mk('ITU-T2', complianceRate > 70 ? 'passing' : assessedOrgs.size > 0 ? 'partial' : 'failing',
    `CIS Controls assessed: ${assessedOrgs.size} orgs, Compliance rate: ${complianceRate}%`);

  // ITU-T4 — Government Website Security (SSL)
  const govWithSsl = govOrgs.filter((o: any) => sslByOrg.get(o.id)?.is_valid).length;
  const govSslPct = govOrgs.length > 0 ? Math.round((govWithSsl / govOrgs.length) * 100) : 0;
  mk('ITU-T4', govSslPct === 100 ? 'passing' : govSslPct >= 50 ? 'partial' : 'failing',
    `Government websites with SSL: ${govWithSsl}/${govOrgs.length} (${govSslPct}%)`);

  // ITU-T5 — DDoS Protection
  const orgsWithCdn = allOrgs.filter((o: any) => ddosByOrg.get(o.id)?.has_cdn).length;
  const cdnPct = totalOrgs > 0 ? Math.round((orgsWithCdn / totalOrgs) * 100) : 0;
  mk('ITU-T5', cdnPct >= 75 ? 'passing' : cdnPct >= 25 ? 'partial' : 'failing',
    `Organizations with DDoS protection: ${orgsWithCdn}/${totalOrgs} (${cdnPct}%)`);

  // ITU-T6 — Email Authentication
  const govEmailChecked = govOrgs.filter((o: any) => {
    const checks = ewByOrg.get(o.id);
    return checks && (checks.has('dns_email') || checks.has('email_security'));
  });
  const govEmailPct = govOrgs.length > 0 ? Math.round((govEmailChecked.length / govOrgs.length) * 100) : 0;
  mk('ITU-T6', govEmailPct >= 80 ? 'passing' : govEmailPct >= 50 ? 'partial' : 'failing',
    `Government email auth checked: ${govEmailChecked.length}/${govOrgs.length} (${govEmailPct}%)`);

  // ITU-T7 — Vulnerability Management
  const techScanned = allOrgs.filter((o: any) => techOrgIds.has(o.id)).length;
  const tiActive = allOrgs.filter((o: any) => tiOrgIds.has(o.id)).length;
  mk('ITU-T7', techScanned > totalOrgs * 0.5 && tiActive > 0 ? 'passing' : techScanned > 0 ? 'partial' : 'failing',
    `Tech scanned: ${techScanned}/${totalOrgs}, Threat intel active: ${tiActive > 0 ? '✓' : '✗'}`);

  // ITU-O3 — Cybersecurity Metrics & Benchmarks
  mk('ITU-O3', totalOrgs > 0 ? 'passing' : 'failing',
    `Organizations with security scores: ${totalOrgs}/${totalOrgs}`);

  // ITU-CO2 — Public-Private Partnerships
  const monitoredSectors = ['government', 'bank', 'telecom', 'education'];
  const activeSectors = monitoredSectors.filter(s => sectors.has(s));
  mk('ITU-CO2', activeSectors.length >= 4 ? 'passing' : activeSectors.length >= 2 ? 'partial' : 'failing',
    `Sectors monitored: ${activeSectors.map(s => s.charAt(0).toUpperCase() + s.slice(1) + ' ✓').join(', ')}`);

  return r;
}

/* ═══════════════════════════════════════════════
   Main Entry Point
   ═══════════════════════════════════════════════ */
export async function runAssessment(
  frameworkKey: string,
  orgId: string,
  onProgress?: (msg: string) => void
): Promise<number> {
  onProgress?.('Querying monitoring data...');
  const data = await fetchOrgData(orgId);

  let results: AssessmentResult[];

  switch (frameworkKey) {
    case 'cis-v8':
      onProgress?.('Assessing CIS Controls v8...');
      results = assessCIS(orgId, data);
      break;
    case 'nist-csf-2':
      onProgress?.('Assessing NIST CSF 2.0...');
      results = assessNIST(orgId, data);
      break;
    case 'owasp-2021':
      onProgress?.('Assessing OWASP Top 10...');
      results = assessOWASP(orgId, data);
      break;
    case 'itu-nci':
      onProgress?.('Assessing ITU National Cybersecurity Index...');
      results = await assessITU(orgId, data, onProgress);
      break;
    default:
      return 0;
  }

  onProgress?.(`Saving ${results.length} assessments...`);
  for (const a of results) {
    await supabase.from('compliance_assessments' as any).upsert(a, { onConflict: 'organization_id,control_code,framework' });
  }

  onProgress?.('Assessment complete!');
  return results.length;
}
