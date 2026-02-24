import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchLogoPngData } from "../_shared/logoUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ─── PDF text sanitizer ─── */
function s(text: string | null | undefined, maxLen = 90): string {
  return (text || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/[()\\]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, maxLen);
}

/* ─── Remediation Knowledge Base ─── */
function getRemediation(finding: { tool: string; severity: string; name: string; description: string }): string {
  const key = (finding.name + ' ' + finding.description).toLowerCase();

  if (key.includes('xss') || key.includes('cross-site scripting')) return 'Sanitize all user inputs; implement Content-Security-Policy header';
  if (key.includes('sql') && key.includes('inject')) return 'Use parameterized queries; never concatenate user input into SQL';
  if (key.includes('csrf') || key.includes('cross-site request')) return 'Implement anti-CSRF tokens on all state-changing forms';
  if (key.includes('open-redirect') || key.includes('open redirect')) return 'Validate redirect URLs against a strict allowlist';
  if (key.includes('jwt') || key.includes('token')) return 'Rotate exposed secrets immediately; use short-lived tokens';
  if (key.includes('missing-integrity') || key.includes('subresource')) return 'Add Subresource Integrity (SRI) attributes to external scripts';
  if (key.includes('csp') || key.includes('content-security-policy')) return 'Add a strict Content-Security-Policy header to all responses';
  if (key.includes('hsts') || key.includes('strict-transport')) return 'Add Strict-Transport-Security header with min 1-year max-age';
  if (key.includes('ssl') || key.includes('tls') || key.includes('certificate')) return 'Renew SSL/TLS certificate; enable auto-renewal via Lets Encrypt';
  if (key.includes('cors')) return 'Restrict Access-Control-Allow-Origin to trusted domains only';
  if (key.includes('cookie') && (key.includes('secure') || key.includes('httponly'))) return 'Set Secure, HttpOnly, and SameSite flags on all cookies';
  if (key.includes('header') && key.includes('missing')) return 'Add recommended security headers: CSP, HSTS, X-Frame-Options';
  if (key.includes('directory') && (key.includes('listing') || key.includes('traversal'))) return 'Disable directory listing; restrict file access to intended paths';
  if (key.includes('information') && key.includes('disclos')) return 'Remove server version headers; disable verbose error messages';
  if (key.includes('clickjack') || key.includes('x-frame')) return 'Add X-Frame-Options: DENY or use CSP frame-ancestors directive';
  if (key.includes('format') && key.includes('string')) return 'Use parameterized formatting functions; avoid user-controlled format strings';
  if (key.includes('deserialization') || key.includes('deserializ')) return 'Avoid deserializing untrusted data; use safe serialization formats';
  if (key.includes('upload') || key.includes('file')) return 'Validate file types and sizes; store uploads outside web root';
  if (key.includes('command') && key.includes('inject')) return 'Avoid shell commands; use safe APIs with parameterized arguments';
  if (key.includes('ssrf') || key.includes('server-side request')) return 'Validate and restrict outbound URLs; block internal IP ranges';
  if (key.includes('outdated') || key.includes('version')) return 'Update to the latest stable version; enable automatic security patches';
  if (key.includes('phishing') || key.includes('lookalike')) return 'Monitor and report lookalike domains; implement DMARC policy';
  if (key.includes('brute') || key.includes('rate limit')) return 'Implement rate limiting and account lockout after failed attempts';
  if (key.includes('waf')) return 'Deploy a Web Application Firewall with OWASP Core Rule Set';
  if (key.includes('port') && key.includes('open')) return 'Close unnecessary ports; restrict access via firewall rules';
  if (key.includes('dns') && (key.includes('zone') || key.includes('transfer'))) return 'Disable DNS zone transfers; restrict to authorized nameservers';
  if (key.includes('spf') || key.includes('dmarc') || key.includes('dkim')) return 'Configure SPF, DKIM, and DMARC records for email authentication';
  if (key.includes('ip address') || key.includes('private ip')) return 'Remove IP addresses from headers and cookies; use domain names instead';
  if (key.includes('content-type') || key.includes('mime')) return 'Set X-Content-Type-Options: nosniff on all responses';
  if (key.includes('breach') || key.includes('compression')) return 'Disable HTTP compression on pages with sensitive data or CSRF tokens';
  if (key.includes('robots')) return 'Review robots.txt entries; ensure no sensitive paths are exposed';

  if (finding.severity === 'CRITICAL') return 'Investigate and patch immediately; this poses an active exploitation risk';
  if (finding.severity === 'HIGH') return 'Schedule remediation within 48 hours; review related attack surfaces';
  if (finding.severity === 'MEDIUM') return 'Plan remediation within 2 weeks; monitor for exploitation attempts';
  return 'Review and address in next maintenance cycle';
}

/* ─── Resolve results: API returns vuln_results, frontend sends dast_results ─── */
function resolveResults(result: any) {
  return {
    nuclei: result.dast_results?.nuclei || result.vuln_results?.nuclei || { findings: [], findings_count: 0 },
    nikto: result.dast_results?.nikto || result.vuln_results?.nikto || null,
    zap: result.dast_results?.zap || result.vuln_results?.zap || null,
    sqlmap: result.vuln_results?.sqlmap || null,
    semgrep: result.sast_results?.semgrep || null,
  };
}

/* ─── Compute stats from scan result ─── */
function computeStats(result: any) {
  const resolved = resolveResults(result);
  const nuclei = resolved.nuclei?.findings || [];
  const semgrep = resolved.semgrep?.findings || [];
  const zapAlerts = resolved.zap?.site?.[0]?.alerts || [];
  const niktoVulns = resolved.nikto?.vulnerabilities || [];

  const sevAliases: Record<string, string[]> = {
    critical: ['critical'],
    high: ['high', 'error'],
    medium: ['medium', 'warning'],
    low: ['low'],
    info: ['info', 'informational'],
  };

  const countSev = (sev: string) => {
    const aliases = sevAliases[sev] || [sev];
    let c = 0;
    c += nuclei.filter((f: any) => aliases.includes((f.info?.severity || '').toLowerCase())).length;
    c += semgrep.filter((f: any) => aliases.includes((f.extra?.severity || '').toLowerCase())).length;
    c += zapAlerts.filter((a: any) => {
      const riskLower = (a.riskdesc || '').toLowerCase();
      return aliases.some(a => riskLower.startsWith(a));
    }).length;
    return c;
  };

  const critical = countSev('critical');
  const high = countSev('high');
  const medium = countSev('medium');
  const low = countSev('low');
  const info = countSev('info');
  const total = critical + high + medium + low + info + niktoVulns.length;
  const score = Math.max(0, Math.min(100, 100 - (critical * 25 + high * 10 + medium * 3 + low * 1 + niktoVulns.length * 2)));

  return { critical, high, medium, low, info, total, score, nuclei, semgrep, zapAlerts, niktoVulns, resolved };
}

function getGrade(score: number) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/* ─── Build normalized findings with remediation ─── */
function normalizeFindings(result: any) {
  const findings: { tool: string; severity: string; name: string; description: string; location: string; remediation: string }[] = [];
  const resolved = resolveResults(result);

  const normalizeSev = (sev: string): string => {
    const upper = sev.toUpperCase();
    if (upper === 'ERROR') return 'HIGH';
    if (upper === 'WARNING') return 'MEDIUM';
    return upper;
  };

  for (const f of (resolved.semgrep?.findings || [])) {
    const entry = {
      tool: 'Semgrep',
      severity: normalizeSev(f.extra?.severity || 'info'),
      name: s(f.check_id?.split('.')?.slice(-1)[0] || 'Finding'),
      description: s(f.extra?.message || '', 120),
      location: s(`${f.path}:${f.start?.line}`, 40),
      remediation: '',
    };
    entry.remediation = getRemediation(entry);
    findings.push(entry);
  }

  for (const f of (resolved.nuclei?.findings || [])) {
    const entry = {
      tool: 'Nuclei',
      severity: (f.info?.severity || 'info').toUpperCase(),
      name: s(f.info?.name || 'Finding'),
      description: s(f.info?.description || '', 120),
      location: s(f.matched_at || '', 40),
      remediation: '',
    };
    entry.remediation = getRemediation(entry);
    findings.push(entry);
  }

  for (const a of (resolved.zap?.site?.[0]?.alerts || [])) {
    const risk = (a.riskdesc || '').split(' ')[0] || 'Info';
    const entry = {
      tool: 'ZAP',
      severity: risk.toUpperCase(),
      name: s(a.alert || 'Finding'),
      description: s(a.desc || '', 120),
      location: s(a.url || '', 40),
      remediation: '',
    };
    entry.remediation = getRemediation(entry);
    findings.push(entry);
  }

  for (const v of (resolved.nikto?.vulnerabilities || [])) {
    const entry = {
      tool: 'Nikto',
      severity: 'MEDIUM',
      name: s(v.id || 'Finding'),
      description: s(v.msg || v.message || '', 120),
      location: s(v.url || result.target || '', 40),
      remediation: '',
    };
    entry.remediation = getRemediation(entry);
    findings.push(entry);
  }

  const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4, INFORMATIONAL: 4 };
  findings.sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));
  return findings;
}

/* ─── Classify Nikto findings into security categories ─── */
function classifyNiktoFindings(nikto: any) {
  const vulns = nikto?.vulnerabilities || [];
  const checks: { category: string; findings: { msg: string; status: 'fail' | 'pass' | 'info'; severity: string; recommendation: string }[] }[] = [];

  const headerFindings: any[] = [];
  const cookieFindings: any[] = [];
  const infoDisclosureFindings: any[] = [];
  const configFindings: any[] = [];

  for (const v of vulns) {
    const msg = (v.msg || v.message || '').toLowerCase();
    if (msg.includes('x-frame') || msg.includes('x-content-type') || msg.includes('strict-transport') || msg.includes('csp') || msg.includes('header')) {
      headerFindings.push(v);
    } else if (msg.includes('cookie') || msg.includes('set-cookie')) {
      cookieFindings.push(v);
    } else if (msg.includes('ip address') || msg.includes('version') || msg.includes('server') || msg.includes('disclos')) {
      infoDisclosureFindings.push(v);
    } else {
      configFindings.push(v);
    }
  }

  if (headerFindings.length > 0 || vulns.length > 0) {
    checks.push({
      category: 'Security Headers',
      findings: headerFindings.length > 0
        ? headerFindings.map(v => ({
            msg: s(v.msg || v.message, 85),
            status: 'fail' as const,
            severity: 'medium',
            recommendation: getRemediation({ tool: 'Nikto', severity: 'MEDIUM', name: v.id || '', description: v.msg || '' }),
          }))
        : [{ msg: 'All security headers present', status: 'pass' as const, severity: 'info', recommendation: '' }],
    });
  }

  if (cookieFindings.length > 0) {
    checks.push({
      category: 'Cookie Security',
      findings: cookieFindings.map(v => ({
        msg: s(v.msg || v.message, 85),
        status: 'fail' as const,
        severity: 'medium',
        recommendation: getRemediation({ tool: 'Nikto', severity: 'MEDIUM', name: v.id || '', description: v.msg || '' }),
      })),
    });
  }

  if (infoDisclosureFindings.length > 0) {
    checks.push({
      category: 'Information Disclosure',
      findings: infoDisclosureFindings.map(v => ({
        msg: s(v.msg || v.message, 85),
        status: 'fail' as const,
        severity: 'low',
        recommendation: getRemediation({ tool: 'Nikto', severity: 'LOW', name: v.id || '', description: v.msg || '' }),
      })),
    });
  }

  if (configFindings.length > 0) {
    checks.push({
      category: 'Server Configuration',
      findings: configFindings.map(v => ({
        msg: s(v.msg || v.message, 85),
        status: 'fail' as const,
        severity: 'medium',
        recommendation: getRemediation({ tool: 'Nikto', severity: 'MEDIUM', name: v.id || '', description: v.msg || '' }),
      })),
    });
  }

  return checks;
}

/* ─── Logo XObject builder ─── */
function buildLogoXObject(logoData: { width: number; height: number; rgbHex: string }, objId: number): string {
  const { width, height, rgbHex } = logoData;
  return `${objId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgbHex.length} /Filter /ASCIIHexDecode >>\nstream\n${rgbHex}>\nendstream\nendobj\n`;
}

/* ─── PDF Generator ─── */
function generatePDF(result: any, logoData: { width: number; height: number; rgbHex: string } | null): Uint8Array {
  const stats = computeStats(result);
  const grade = getGrade(stats.score);
  const findings = normalizeFindings(result);
  const now = new Date().toISOString().split('T')[0];
  const target = s(result.target || 'Unknown', 60);
  const scanType = (result.type || 'unknown').toUpperCase();
  const scanDate = result.created_at ? new Date(result.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : now;
  const hasLogo = !!logoData;
  const tx = hasLogo ? 82 : 40;

  const pages: string[][] = [];

  function addHeader(p: string[], title: string, _subtitle: string) {
    p.push(`0.08 0.12 0.2 rg`, `0 790 595 52 re f`);
    p.push(`0.85 0.15 0.1 rg`, `0 788 595 2 re f`);
    if (hasLogo) {
      p.push(`q 36 0 0 36 40 798 cm /Logo Do Q`);
    }
    p.push(`BT /F2 16 Tf 1 1 1 rg ${tx} 812 Td (SOMALIA CYBER DEFENCE) Tj ET`);
    p.push(`BT /F1 9 Tf 0.8 0.85 0.9 rg ${tx} 800 Td (${title}) Tj ET`);
  }

  function addFooter(p: string[], pageNum: number) {
    p.push(`0.93 0.94 0.95 rg`, `0 0 595 40 re f`);
    p.push(`0.08 0.12 0.2 rg`, `0 40 595 1 re f`);
    p.push(`BT /F1 7 Tf 0.4 0.45 0.5 rg 40 22 Td (Somalia Cyber Defence | ${now} | CONFIDENTIAL) Tj ET`);
    p.push(`BT /F1 7 Tf 0.4 0.45 0.5 rg 480 22 Td (Page ${pageNum}) Tj ET`);
    p.push(`BT /F1 6 Tf 0.5 0.55 0.6 rg 40 12 Td (This report contains sensitive security information. Handle with appropriate care.) Tj ET`);
  }

  // ── Page 1: Executive Summary ──
  const p1: string[] = [];
  p1.push(`1 1 1 rg`, `0 0 595 842 re f`);
  addHeader(p1, 'Security Scan Report', '');

  // Info section
  p1.push(`0.95 0.96 0.97 rg`, `30 700 535 80 re f`);
  p1.push(`0.85 0.15 0.1 rg`, `30 700 3 80 re f`);
  p1.push(`BT /F2 12 Tf 0.08 0.12 0.2 rg 45 758 Td (Target: ${target}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.3 0.35 0.4 rg 45 742 Td (Scan Type: ${scanType} | Scan ID: ${s(result.scan_id, 30)}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.3 0.35 0.4 rg 45 726 Td (Scan Date: ${s(scanDate, 30)} | Generated: ${now}) Tj ET`);

  const riskLabel = stats.score >= 75 ? 'LOW RISK' : stats.score >= 50 ? 'MEDIUM RISK' : 'HIGH RISK';
  const riskColor = stats.score >= 75 ? '0.1 0.6 0.3' : stats.score >= 50 ? '0.8 0.6 0' : '0.8 0.15 0.1';
  p1.push(`BT /F2 10 Tf ${riskColor} rg 45 710 Td (${riskLabel}) Tj ET`);

  // Score box
  const scoreColor = stats.score >= 75 ? '0.1 0.6 0.3' : stats.score >= 50 ? '0.8 0.6 0' : '0.8 0.15 0.1';
  p1.push(`${scoreColor} rg`, `460 715 105 65 re f`);
  p1.push(`BT /F2 36 Tf 1 1 1 rg 476 743 Td (${stats.score}) Tj ET`);
  p1.push(`BT /F1 10 Tf 1 1 1 rg 490 728 Td (/ 100) Tj ET`);
  p1.push(`BT /F2 11 Tf 1 1 1 rg 478 715 Td (Grade: ${grade}) Tj ET`);

  // Vulnerability Summary
  p1.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 682 Td (VULNERABILITY SUMMARY) Tj ET`);
  p1.push(`0.85 0.15 0.1 rg`, `40 678 100 2 re f`);

  const boxes = [
    { label: 'TOTAL', value: stats.total, bg: '0.93 0.94 0.96', color: '0.08 0.12 0.2' },
    { label: 'CRITICAL', value: stats.critical, bg: '1 0.92 0.92', color: '0.8 0.15 0.1' },
    { label: 'HIGH', value: stats.high, bg: '1 0.95 0.9', color: '0.85 0.45 0' },
    { label: 'MEDIUM', value: stats.medium, bg: '1 0.98 0.9', color: '0.7 0.6 0' },
    { label: 'LOW', value: stats.low, bg: '0.9 0.95 1', color: '0.15 0.4 0.8' },
  ];
  boxes.forEach((b, i) => {
    const bx = 40 + i * 105;
    p1.push(`${b.bg} rg`, `${bx} 635 95 38 re f`);
    p1.push(`BT /F2 22 Tf ${b.color} rg ${bx + 35} 650 Td (${b.value}) Tj ET`);
    p1.push(`BT /F1 7 Tf 0.4 0.45 0.5 rg ${bx + 25} 638 Td (${b.label}) Tj ET`);
  });

  // Scanner Breakdown - always show all scanners
  p1.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 618 Td (SCANNER BREAKDOWN) Tj ET`);
  p1.push(`0.85 0.15 0.1 rg`, `40 614 100 2 re f`);

  const scanners = [
    { name: 'Nikto (Web Scanner)', count: stats.niktoVulns.length },
    { name: 'Nuclei (DAST)', count: stats.nuclei.length },
    { name: 'Semgrep (SAST)', count: stats.semgrep.length },
    { name: 'ZAP (DAST)', count: stats.zapAlerts.length },
  ];

  let sy = 598;
  p1.push(`0.08 0.12 0.2 rg`, `40 ${sy - 2} 515 18 re f`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 50 ${sy + 3} Td (SCANNER) Tj ET`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 250 ${sy + 3} Td (FINDINGS) Tj ET`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 350 ${sy + 3} Td (STATUS) Tj ET`);
  sy -= 18;

  for (const sc of scanners) {
    if (sy < 80) break;
    const isAlt = scanners.indexOf(sc) % 2 === 0;
    if (isAlt) p1.push(`0.97 0.97 0.98 rg`, `40 ${sy - 2} 515 16 re f`);
    p1.push(`BT /F1 9 Tf 0.2 0.25 0.3 rg 50 ${sy + 2} Td (${sc.name}) Tj ET`);
    p1.push(`BT /F2 9 Tf 0.08 0.12 0.2 rg 250 ${sy + 2} Td (${sc.count}) Tj ET`);
    const statusText = sc.count === 0 ? 'Clean' : `${sc.count} issue${sc.count > 1 ? 's' : ''}`;
    const statusColor = sc.count === 0 ? '0.1 0.6 0.3' : '0.85 0.45 0';
    p1.push(`BT /F2 8 Tf ${statusColor} rg 340 ${sy + 2} Td (${statusText}) Tj ET`);
    if (sc.count > 0) {
      const barW = Math.min(sc.count * 8, 80);
      p1.push(`0.85 0.15 0.1 rg`, `430 ${sy} ${barW} 8 re f`);
    }
    sy -= 18;
  }

  // Server Info from Nikto
  const niktoData = stats.resolved.nikto;
  if (niktoData && sy > 120) {
    sy -= 20;
    p1.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${sy} Td (SERVER INFORMATION) Tj ET`);
    p1.push(`0.85 0.15 0.1 rg`, `40 ${sy - 4} 120 2 re f`);
    sy -= 18;

    const serverInfo = [
      { label: 'Host', value: niktoData.host || result.target || 'N/A' },
      { label: 'IP Address', value: niktoData.ip || 'N/A' },
      { label: 'Port', value: niktoData.port || '443' },
      { label: 'Web Server', value: niktoData.banner || 'Unknown' },
    ];

    p1.push(`0.95 0.96 0.97 rg`, `40 ${sy - 4} 515 ${serverInfo.length * 16 + 8} re f`);
    for (const info of serverInfo) {
      p1.push(`BT /F2 8 Tf 0.4 0.45 0.5 rg 50 ${sy} Td (${info.label}:) Tj ET`);
      p1.push(`BT /F1 8 Tf 0.15 0.2 0.25 rg 140 ${sy} Td (${s(info.value, 60)}) Tj ET`);
      sy -= 16;
    }
  }

  // Top Findings preview - show as many as fit on page
  if (findings.length > 0 && sy > 100) {
    sy -= 8;
    p1.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${sy} Td (TOP FINDINGS) Tj ET`);
    p1.push(`0.85 0.15 0.1 rg`, `40 ${sy - 4} 80 2 re f`);
    sy -= 16;

    p1.push(`0.08 0.12 0.2 rg`, `40 ${sy - 2} 515 16 re f`);
    p1.push(`BT /F2 7 Tf 1 1 1 rg 50 ${sy + 2} Td (SEVERITY) Tj ET`);
    p1.push(`BT /F2 7 Tf 1 1 1 rg 115 ${sy + 2} Td (TOOL) Tj ET`);
    p1.push(`BT /F2 7 Tf 1 1 1 rg 170 ${sy + 2} Td (FINDING) Tj ET`);
    p1.push(`BT /F2 7 Tf 1 1 1 rg 420 ${sy + 2} Td (LOCATION) Tj ET`);
    sy -= 16;

    let shownCount = 0;
    for (const f of findings) {
      if (sy < 70) break;
      const isAlt = shownCount % 2 === 0;
      if (isAlt) p1.push(`0.97 0.97 0.98 rg`, `40 ${sy - 2} 515 14 re f`);

      const sevLabel = f.severity === 'INFORMATIONAL' ? 'INFO' : f.severity;
      const sevColor =
        f.severity === 'CRITICAL' ? '0.8 0.15 0.1' :
        f.severity === 'HIGH' ? '0.85 0.45 0' :
        f.severity === 'MEDIUM' ? '0.7 0.6 0' :
        f.severity === 'LOW' ? '0.15 0.4 0.8' : '0.5 0.5 0.5';

      p1.push(`BT /F2 7 Tf ${sevColor} rg 50 ${sy + 1} Td (${sevLabel}) Tj ET`);
      p1.push(`BT /F1 7 Tf 0.3 0.35 0.4 rg 115 ${sy + 1} Td (${f.tool}) Tj ET`);
      p1.push(`BT /F1 7 Tf 0.15 0.2 0.25 rg 170 ${sy + 1} Td (${s(f.name, 40)}) Tj ET`);
      p1.push(`BT /F1 6 Tf 0.4 0.45 0.5 rg 420 ${sy + 1} Td (${s(f.location, 25)}) Tj ET`);
      sy -= 14;
      shownCount++;
    }

    if (shownCount < findings.length) {
      p1.push(`BT /F1 8 Tf 0.4 0.45 0.5 rg 50 ${sy + 1} Td (... and ${findings.length - shownCount} more findings - see detailed report) Tj ET`);
    }
  } else if (findings.length === 0) {
    // No findings -- show a clean bill of health
    sy -= 12;
    p1.push(`0.9 0.97 0.9 rg`, `40 ${sy - 20} 515 40 re f`);
    p1.push(`0.1 0.6 0.3 rg`, `40 ${sy - 20} 3 40 re f`);
    p1.push(`BT /F2 11 Tf 0.1 0.5 0.25 rg 55 ${sy - 2} Td (No Critical Vulnerabilities Found) Tj ET`);
    p1.push(`BT /F1 8 Tf 0.2 0.4 0.2 rg 55 ${sy - 16} Td (All vulnerability scanners completed without detecting critical or high-severity issues.) Tj ET`);
  }

  addFooter(p1, 1);
  pages.push(p1);

  // ── Page 2: Infrastructure Assessment ──
  if (niktoData || findings.length > 0) {
    const p2: string[] = [];
    p2.push(`1 1 1 rg`, `0 0 595 842 re f`);
    addHeader(p2, 'Infrastructure Security Assessment', `${target}`);

    let iy = 770;

    // Nikto categorized findings
    const categories = classifyNiktoFindings(niktoData);

    if (categories.length > 0) {
      p2.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${iy} Td (WEB SERVER SECURITY CHECKS) Tj ET`);
      p2.push(`0.85 0.15 0.1 rg`, `40 ${iy - 4} 170 2 re f`);
      iy -= 22;

      for (const cat of categories) {
        if (iy < 120) break;

        // Category header
        const failCount = cat.findings.filter(f => f.status === 'fail').length;
        const passCount = cat.findings.filter(f => f.status === 'pass').length;
        const catColor = failCount > 0 ? '0.85 0.15 0.1' : '0.1 0.6 0.3';
        const catStatus = failCount > 0 ? `${failCount} Issue${failCount > 1 ? 's' : ''}` : 'Passed';

        p2.push(`0.08 0.12 0.2 rg`, `40 ${iy - 2} 515 18 re f`);
        p2.push(`BT /F2 9 Tf 1 1 1 rg 50 ${iy + 2} Td (${cat.category}) Tj ET`);
        p2.push(`BT /F2 8 Tf ${catColor === '0.1 0.6 0.3' ? '0.5 0.9 0.5' : '1 0.7 0.7'} rg 450 ${iy + 2} Td (${catStatus}) Tj ET`);
        iy -= 20;

        for (const finding of cat.findings) {
          if (iy < 100) break;

          const icon = finding.status === 'pass' ? 'PASS' : 'FAIL';
          const iconColor = finding.status === 'pass' ? '0.1 0.6 0.3' : '0.85 0.15 0.1';

          // Status badge
          const badgeBg = finding.status === 'pass' ? '0.9 0.97 0.9' : '1 0.92 0.92';
          p2.push(`${badgeBg} rg`, `50 ${iy - 3} 35 14 re f`);
          p2.push(`BT /F2 7 Tf ${iconColor} rg 53 ${iy} Td (${icon}) Tj ET`);

          // Finding description
          p2.push(`BT /F1 7 Tf 0.15 0.2 0.25 rg 92 ${iy} Td (${s(finding.msg, 80)}) Tj ET`);
          iy -= 14;

          // Remediation if fail
          if (finding.status === 'fail' && finding.recommendation) {
            p2.push(`0.93 0.96 0.93 rg`, `92 ${iy - 2} 460 12 re f`);
            p2.push(`BT /F1 6 Tf 0.1 0.5 0.25 rg 96 ${iy + 1} Td (Fix: ${s(finding.recommendation, 80)}) Tj ET`);
            iy -= 14;
          }
        }
        iy -= 8;
      }
    }

    // SQLMap section
    const sqlmapOutput = stats.resolved.sqlmap?.output;
    if (sqlmapOutput !== undefined) {
      if (iy > 150) {
        iy -= 12; // gap before section
        p2.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${iy} Td (SQL INJECTION TEST) Tj ET`);
        p2.push(`0.85 0.15 0.1 rg`, `40 ${iy - 4} 120 2 re f`);
        iy -= 22;

        const sqlmapClean = !sqlmapOutput || sqlmapOutput.trim() === '';
        const sqlBg = sqlmapClean ? '0.9 0.97 0.9' : '1 0.92 0.92';
        const sqlColor = sqlmapClean ? '0.1 0.6 0.3' : '0.85 0.15 0.1';
        const sqlStatus = sqlmapClean ? 'PASS' : 'FAIL';
        const sqlMsg = sqlmapClean ? 'No SQL injection vulnerabilities detected' : 'Potential SQL injection vulnerabilities found';

        p2.push(`${sqlBg} rg`, `40 ${iy - 8} 515 24 re f`);
        p2.push(`${sqlColor} rg`, `40 ${iy - 8} 3 24 re f`);
        p2.push(`BT /F2 8 Tf ${sqlColor} rg 55 ${iy - 1} Td (${sqlStatus}) Tj ET`);
        p2.push(`BT /F1 8 Tf 0.15 0.2 0.25 rg 92 ${iy - 1} Td (${sqlMsg}) Tj ET`);
        iy -= 28;
      }
    }

    // Scan Methodology section
    if (iy > 200) {
      iy -= 12; // gap before section
      p2.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${iy} Td (SCAN METHODOLOGY) Tj ET`);
      p2.push(`0.85 0.15 0.1 rg`, `40 ${iy - 4} 120 2 re f`);
      iy -= 20;

      const methodology = [
        { tool: 'Nikto', desc: 'Web server scanner for dangerous files, outdated software, and misconfigurations' },
        { tool: 'Nuclei', desc: 'Template-based vulnerability scanner with 8000+ security checks' },
        { tool: 'ZAP', desc: 'OWASP web application security scanner for DAST analysis' },
        { tool: 'Semgrep', desc: 'Static analysis tool scanning source code for security patterns' },
        { tool: 'SQLMap', desc: 'Automated SQL injection detection and exploitation testing' },
      ];

      const methHeight = methodology.length * 16 + 8;
      p2.push(`0.95 0.96 0.97 rg`, `40 ${iy - methHeight + 12} 515 ${methHeight} re f`);
      for (const m of methodology) {
        if (iy < 80) break;
        p2.push(`BT /F2 8 Tf 0.08 0.12 0.2 rg 50 ${iy} Td (${m.tool}) Tj ET`);
        p2.push(`BT /F1 7 Tf 0.3 0.35 0.4 rg 120 ${iy} Td (${s(m.desc, 75)}) Tj ET`);
        iy -= 16;
      }
    }

    addFooter(p2, pages.length + 1);
    pages.push(p2);
  }

  // ── Page 3+: Detailed Findings with Remediation ──
  if (findings.length > 0) {
    const findingsPerPage = 8;
    for (let pageIdx = 0; pageIdx < findings.length; pageIdx += findingsPerPage) {
      const pageFindings = findings.slice(pageIdx, pageIdx + findingsPerPage);
      const pf: string[] = [];
      pf.push(`1 1 1 rg`, `0 0 595 842 re f`);
      addHeader(pf, 'Detailed Findings & Remediation', `${target} | Page ${pages.length + 1}`);

      let fy = 770;

      for (const f of pageFindings) {
        if (fy < 100) break;

        const cardH = 72;
        pf.push(`0.97 0.97 0.98 rg`, `40 ${fy - cardH + 10} 515 ${cardH} re f`);

        const sevColor =
          f.severity === 'CRITICAL' ? '0.8 0.15 0.1' :
          f.severity === 'HIGH' ? '0.85 0.45 0' :
          f.severity === 'MEDIUM' ? '0.7 0.6 0' :
          f.severity === 'LOW' ? '0.15 0.4 0.8' : '0.5 0.5 0.5';
        const sevBg =
          f.severity === 'CRITICAL' ? '1 0.92 0.92' :
          f.severity === 'HIGH' ? '1 0.95 0.9' :
          f.severity === 'MEDIUM' ? '1 0.98 0.9' :
          f.severity === 'LOW' ? '0.9 0.95 1' : '0.95 0.95 0.95';

        // Abbreviate INFORMATIONAL to INFO for badge display
        const sevLabel = f.severity === 'INFORMATIONAL' ? 'INFO' : f.severity;

        pf.push(`${sevBg} rg`, `50 ${fy - 2} 55 14 re f`);
        pf.push(`BT /F2 7 Tf ${sevColor} rg 55 ${fy + 1} Td (${sevLabel}) Tj ET`);

        pf.push(`0.93 0.94 0.96 rg`, `110 ${fy - 2} 42 14 re f`);
        pf.push(`BT /F1 7 Tf 0.3 0.35 0.4 rg 115 ${fy + 1} Td (${f.tool}) Tj ET`);

        pf.push(`BT /F2 9 Tf 0.08 0.12 0.2 rg 160 ${fy + 1} Td (${s(f.name, 55)}) Tj ET`);

        fy -= 16;

        pf.push(`BT /F1 7 Tf 0.3 0.35 0.4 rg 55 ${fy} Td (${s(f.description, 90)}) Tj ET`);
        fy -= 12;

        pf.push(`BT /F2 6 Tf 0.4 0.45 0.5 rg 55 ${fy} Td (Location:) Tj ET`);
        pf.push(`BT /F1 6 Tf 0.3 0.35 0.4 rg 100 ${fy} Td (${s(f.location, 70)}) Tj ET`);
        fy -= 12;

        pf.push(`0.9 0.95 0.9 rg`, `50 ${fy - 3} 500 12 re f`);
        pf.push(`0.1 0.6 0.3 rg`, `50 ${fy - 3} 3 12 re f`);
        pf.push(`BT /F2 6 Tf 0.1 0.5 0.25 rg 58 ${fy} Td (Remediation:) Tj ET`);
        pf.push(`BT /F1 6 Tf 0.15 0.4 0.2 rg 120 ${fy} Td (${s(f.remediation, 75)}) Tj ET`);
        fy -= 18;
      }

      addFooter(pf, pages.length + 1);
      pages.push(pf);
    }
  }

  // ── Remediation Summary Page ──
  if (findings.length > 0) {
    const ps: string[] = [];
    ps.push(`1 1 1 rg`, `0 0 595 842 re f`);
    addHeader(ps, 'Remediation Action Plan', `${target}`);

    let ry = 770;

    const critCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const highCount = findings.filter(f => f.severity === 'HIGH').length;
    const medCount = findings.filter(f => f.severity === 'MEDIUM').length;
    const lowCount = findings.filter(f => f.severity === 'LOW').length;

    ps.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${ry} Td (PRIORITIZED REMEDIATION PLAN) Tj ET`);
    ps.push(`0.85 0.15 0.1 rg`, `40 ${ry - 4} 180 2 re f`);
    ry -= 22;

    ps.push(`BT /F1 9 Tf 0.3 0.35 0.4 rg 40 ${ry} Td (Total findings: ${findings.length} | Critical: ${critCount} | High: ${highCount} | Medium: ${medCount} | Low: ${lowCount}) Tj ET`);
    ry -= 25;

    const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
    const sevLabels: Record<string, { color: string; effort: string; timeline: string }> = {
      CRITICAL: { color: '0.8 0.15 0.1', effort: 'Immediate', timeline: 'Fix within 24 hours' },
      HIGH: { color: '0.85 0.45 0', effort: 'Urgent', timeline: 'Fix within 48 hours' },
      MEDIUM: { color: '0.7 0.6 0', effort: 'Planned', timeline: 'Fix within 2 weeks' },
      LOW: { color: '0.15 0.4 0.8', effort: 'Maintenance', timeline: 'Next maintenance cycle' },
    };

    for (const sev of severities) {
      const sevFindings = findings.filter(f => f.severity === sev);
      if (sevFindings.length === 0) continue;
      if (ry < 100) break;

      const info = sevLabels[sev];

      ps.push(`${info.color} rg`, `40 ${ry - 2} 515 18 re f`);
      ps.push(`BT /F2 9 Tf 1 1 1 rg 50 ${ry + 2} Td (${sev} - ${sevFindings.length} finding${sevFindings.length > 1 ? 's' : ''} | ${info.effort} | ${info.timeline}) Tj ET`);
      ry -= 22;

      const uniqueRemediations = [...new Set(sevFindings.map(f => f.remediation))];

      for (const rem of uniqueRemediations.slice(0, 6)) {
        if (ry < 100) break;
        const relatedFindings = sevFindings.filter(f => f.remediation === rem);
        ps.push(`0.97 0.97 0.98 rg`, `40 ${ry - 3} 515 16 re f`);
        ps.push(`BT /F1 8 Tf 0.15 0.2 0.25 rg 50 ${ry} Td (${s(rem, 75)}) Tj ET`);
        ps.push(`BT /F1 7 Tf 0.4 0.45 0.5 rg 450 ${ry} Td (${relatedFindings.length} finding${relatedFindings.length > 1 ? 's' : ''}) Tj ET`);
        ry -= 18;
      }
      ry -= 8;
    }

    // General recommendations
    if (ry > 180) {
      ry -= 10;
      ps.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${ry} Td (GENERAL RECOMMENDATIONS) Tj ET`);
      ps.push(`0.85 0.15 0.1 rg`, `40 ${ry - 4} 150 2 re f`);
      ry -= 20;

      const recommendations = [
        'Implement a vulnerability management program with regular scanning schedules',
        'Establish a patch management policy with defined SLAs per severity level',
        'Deploy a Web Application Firewall  WAF  with OWASP Core Rule Set',
        'Enable security headers on all web applications  CSP, HSTS, X-Frame-Options ',
        'Conduct regular penetration testing and code reviews',
        'Implement monitoring and alerting for security events',
      ];

      for (const rec of recommendations) {
        if (ry < 80) break;
        ps.push(`BT /F1 8 Tf 0.3 0.35 0.4 rg 50 ${ry} Td (${s(rec, 90)}) Tj ET`);
        ry -= 14;
      }
    }

    addFooter(ps, pages.length + 1);
    pages.push(ps);
  }

  // ── Assemble PDF ──
  const pageCount = pages.length;
  const streams = pages.map(p => new TextEncoder().encode(p.join('\n')));

  const baseObj = hasLogo ? 6 : 5;
  const pageObjIds = pages.map((_, i) => baseObj + i * 2);
  const streamObjIds = pages.map((_, i) => baseObj + i * 2 + 1);
  const totalObjects = baseObj + pageCount * 2;

  const resourceDict = hasLogo
    ? `/Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >>`
    : `/Font << /F1 3 0 R /F2 4 0 R >>`;

  const encoder = new TextEncoder();
  const offsets: number[] = [];
  let pdf = `%PDF-1.4\n`;

  function addObj(content: string) {
    offsets.push(encoder.encode(pdf).length);
    pdf += content;
  }

  addObj(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  addObj(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`);
  addObj(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);
  addObj(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`);

  if (hasLogo && logoData) {
    addObj(buildLogoXObject(logoData, 5));
  }

  for (let i = 0; i < pageCount; i++) {
    addObj(`${pageObjIds[i]} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << ${resourceDict} >> /Contents ${streamObjIds[i]} 0 R >>\nendobj\n`);
    const streamContent = new TextDecoder().decode(streams[i]);
    addObj(`${streamObjIds[i]} 0 obj\n<< /Length ${streams[i].length} >>\nstream\n${streamContent}\nendstream\nendobj\n`);
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const result = body.result;

    if (!result) {
      return new Response(JSON.stringify({ error: 'Missing result data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const logoData = await fetchLogoPngData();
    const pdfBytes = generatePDF(result, logoData);

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="scan-report-${result.scan_id || 'unknown'}.pdf"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
