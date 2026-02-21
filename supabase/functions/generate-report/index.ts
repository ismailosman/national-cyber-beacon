import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchLogoPngData } from "../_shared/logoUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/* ─── Remediation Map ─── */
interface Remediation {
  issue: string;
  severity: 'critical' | 'high' | 'medium';
  steps: string[];
  estimatedTime: string;
}

function buildRemediations(data: {
  sslLog: any; ddosLog: any; ewLogs: any[]; techFp: any;
}): Remediation[] {
  const rems: Remediation[] = [];
  const { sslLog, ddosLog, ewLogs, techFp } = data;

  if (sslLog && (!sslLog.is_valid || sslLog.is_expired)) {
    rems.push({ issue: 'SSL Certificate Invalid or Expired', severity: 'critical', steps: [
      'Use Let\'s Encrypt to issue a new SSL certificate', 'Install the certificate on your web server',
      'Set up auto-renewal cron job', 'Verify with: openssl s_client -connect yourdomain:443',
    ], estimatedTime: '15 minutes' });
  } else if (sslLog?.is_expiring_soon) {
    rems.push({ issue: `SSL Expiring in ${sslLog.days_until_expiry} days`, severity: 'high', steps: [
      'Renew certificate before expiry', 'Enable auto-renewal',
    ], estimatedTime: '10 minutes' });
  }

  if (ddosLog) {
    if (!ddosLog.has_cdn) rems.push({ issue: 'No CDN Protection', severity: 'critical', steps: [
      'Sign up for Cloudflare free tier', 'Update nameservers', 'Enable Always Use HTTPS',
    ], estimatedTime: '30 minutes' });
    if (!ddosLog.has_waf) rems.push({ issue: 'No WAF', severity: 'critical', steps: [
      'Enable WAF rules in Cloudflare', 'Enable OWASP ModSecurity rules',
    ], estimatedTime: '15 minutes' });
    if (!ddosLog.has_rate_limiting) rems.push({ issue: 'No Rate Limiting', severity: 'high', steps: [
      'Create rate limiting rules: 10 req/min login, 100 req/min general',
    ], estimatedTime: '10 minutes' });
    if (ddosLog.origin_exposed) rems.push({ issue: 'Origin IP Exposed', severity: 'high', steps: [
      'Proxy DNS through CDN', 'Block direct IP access on firewall',
    ], estimatedTime: '20 minutes' });
  }

  const headersLog = ewLogs.find(e => e.check_type === 'security_headers');
  if (headersLog) {
    const det = headersLog.details as any;
    const headers = det?.headers || {};
    const missing: string[] = [];
    if (!headers['strict-transport-security']) missing.push('HSTS');
    if (!headers['content-security-policy']) missing.push('CSP');
    if (!headers['x-frame-options']) missing.push('X-Frame-Options');
    if (!headers['x-content-type-options']) missing.push('X-Content-Type-Options');
    if (missing.length > 0) rems.push({ issue: `${missing.length} Missing Security Headers`, severity: missing.length >= 3 ? 'high' : 'medium', steps: [
      `Add missing headers: ${missing.join(', ')}`, 'Configure in web server (Nginx/Apache)',
    ], estimatedTime: '5 minutes' });
  }

  const emailLog = ewLogs.find(e => e.check_type === 'email_security' || e.check_type === 'dns');
  if (emailLog) {
    const es = (emailLog.details as any)?.emailSecurity;
    if (es && !es.spfExists) rems.push({ issue: 'No SPF Record', severity: 'critical', steps: [
      'Add TXT DNS record: v=spf1 include:_spf.google.com ~all',
    ], estimatedTime: '5 minutes' });
    if (es && !es.dmarcExists) rems.push({ issue: 'No DMARC Record', severity: 'high', steps: [
      'Add TXT record at _dmarc: v=DMARC1; p=reject; rua=mailto:dmarc@domain',
    ], estimatedTime: '10 minutes' });
  }

  const portsLog = ewLogs.find(e => e.check_type === 'open_ports');
  if (portsLog && portsLog.risk_level !== 'safe') {
    const critical = ((portsLog.details as any)?.openPorts || []).filter((p: any) => p.risk === 'critical');
    if (critical.length > 0) rems.push({ issue: `${critical.length} Critical Port(s) Exposed`, severity: 'critical', steps: [
      `Close ports: ${critical.map((p: any) => `${p.port} (${p.service})`).join(', ')}`,
      'Restrict database access to localhost or VPN',
    ], estimatedTime: '5 minutes' });
  }

  if (techFp && techFp.outdated_count > 0) rems.push({ issue: `${techFp.outdated_count} Outdated Software`, severity: 'medium', steps: [
    'Update all CMS and plugins', 'Enable automatic security updates',
  ], estimatedTime: '30 minutes' });

  const order = { critical: 0, high: 1, medium: 2 };
  rems.sort((a, b) => order[a.severity] - order[b.severity]);
  return rems;
}

/* ─── Sanitize PDF text ─── */
function s(text: string | null | undefined, maxLen = 90): string {
  return (text || '').replace(/[()\\]/g, ' ').substring(0, maxLen);
}

function buildLogoXObject(logoData: { width: number; height: number; rgbHex: string }, objId: number): string {
  const { width, height, rgbHex } = logoData;
  return `${objId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgbHex.length} /Filter /ASCIIHexDecode >>\nstream\n${rgbHex}>\nendstream\nendobj\n`;
}

/* ─── PDF Generator ─── */
function generatePDF(data: {
  org: any; alerts: any[]; dateFrom: string; dateTo: string;
  remediations: Remediation[]; includeRemediation: boolean;
  sslLog: any; ddosLog: any; ewLogs: any[]; uptimeLogs: any[];
  techFp: any; phishingDomains: any[]; tiLogs: any[];
  sections: { earlyWarning: boolean; threatIntel: boolean; alertHistory: boolean };
  logoData: { width: number; height: number; rgbHex: string } | null;
}): Uint8Array {
  const { org, alerts, dateFrom, dateTo, remediations, includeRemediation,
    sslLog, ddosLog, ewLogs, uptimeLogs, techFp, phishingDomains, tiLogs, sections, logoData } = data;
  const now = new Date().toISOString().split('T')[0];
  const scoreColor = org.risk_score >= 75 ? '0.2 0.8 0.4' : org.risk_score >= 50 ? '1 0.7 0' : '0.9 0.2 0.2';
  const orgName = s(org.name);
  const domain = s(org.domain);
  const hasLogo = !!logoData;
  const tx = hasLogo ? 82 : 40; // text x-offset after logo

  const pages: string[][] = [];

  // Helper to add header with logo to any page
  function addHeader(p: string[], title: string, subtitle: string) {
    p.push(`0.05 0.07 0.1 rg`, `0 790 595 52 re f`);
    if (hasLogo) {
      p.push(`q 36 0 0 36 40 798 cm /Logo Do Q`);
    }
    p.push(`BT /F2 18 Tf 1 1 1 rg ${tx} 810 Td (${title}) Tj ET`);
    p.push(`BT /F1 10 Tf 1 1 1 rg ${tx} 797 Td (${subtitle}) Tj ET`);
  }

  // ── Page 1: Executive Summary ──
  const p1: string[] = [];
  addHeader(p1, 'SOMALIA CYBER DEFENSE OBSERVATORY', 'Security Risk Assessment Report');

  // Background
  p1.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

  // Org info bar
  p1.push(`0.12 0.15 0.2 rg`, `30 700 535 80 re f`);
  p1.push(`BT /F2 16 Tf 0.9 0.95 1 rg 50 758 Td (${orgName}) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.6 0.7 0.8 rg 50 742 Td (${domain} | ${s(org.sector)} | ${s(org.region)}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.6 0.7 0.8 rg 50 726 Td (Report Period: ${dateFrom} to ${dateTo} | Generated: ${now}) Tj ET`);

  // Risk Score box
  p1.push(`${scoreColor} rg`, `460 710 105 70 re f`);
  p1.push(`BT /F2 32 Tf 0.05 0.07 0.1 rg 478 738 Td (${org.risk_score}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.05 0.07 0.1 rg 487 722 Td (/ 100) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.05 0.07 0.1 rg 472 710 Td (RISK SCORE) Tj ET`);

  // Security Posture Summary
  p1.push(`BT /F2 12 Tf ${scoreColor} rg 50 688 Td (Security Posture Summary) Tj ET`);

  // Build check results
  const checks: { name: string; status: string; color: string; detail: string; time: string }[] = [];

  if (sslLog) {
    const st = sslLog.is_valid && !sslLog.is_expired ? 'PASS' : 'FAIL';
    const detail = sslLog.is_valid ? `Valid, expires in ${sslLog.days_until_expiry || '?'} days` : 'Invalid or expired';
    checks.push({ name: 'SSL Certificate', status: st, color: st === 'PASS' ? '0.2 0.8 0.4' : '0.9 0.2 0.2', detail, time: (sslLog.checked_at || '').substring(0, 16) });
  }

  if (uptimeLogs.length > 0) {
    const upCount = uptimeLogs.filter((u: any) => u.status === 'up').length;
    const pct = Math.round((upCount / uptimeLogs.length) * 100);
    const st = pct >= 95 ? 'PASS' : pct >= 80 ? 'WARN' : 'FAIL';
    checks.push({ name: 'Uptime', status: st, color: st === 'PASS' ? '0.2 0.8 0.4' : st === 'WARN' ? '1 0.7 0' : '0.9 0.2 0.2', detail: `${pct}% uptime (${uptimeLogs.length} checks)`, time: (uptimeLogs[0]?.checked_at || '').substring(0, 16) });
  }

  if (ddosLog) {
    const protections = [ddosLog.has_cdn && 'CDN', ddosLog.has_waf && 'WAF', ddosLog.has_rate_limiting && 'Rate Limit'].filter(Boolean);
    const st = protections.length >= 2 ? 'PASS' : protections.length >= 1 ? 'WARN' : 'FAIL';
    checks.push({ name: 'DDoS Protection', status: st, color: st === 'PASS' ? '0.2 0.8 0.4' : st === 'WARN' ? '1 0.7 0' : '0.9 0.2 0.2', detail: protections.length > 0 ? protections.join(', ') : 'No protection', time: (ddosLog.checked_at || '').substring(0, 16) });
  }

  const ewTypes = ['security_headers', 'email_security', 'open_ports', 'defacement', 'dns', 'blacklist'];
  const ewLabels: Record<string, string> = {
    security_headers: 'Security Headers', email_security: 'Email Security',
    open_ports: 'Open Ports', defacement: 'Defacement', dns: 'DNS Integrity', blacklist: 'Blacklist',
  };
  for (const ct of ewTypes) {
    const log = ewLogs.find(e => e.check_type === ct);
    if (log) {
      const st = log.risk_level === 'safe' ? 'PASS' : log.risk_level === 'warning' ? 'WARN' : 'FAIL';
      let detail = log.risk_level.toUpperCase();
      if (ct === 'security_headers') {
        const sc = (log.details as any)?.score;
        const grade = (log.details as any)?.grade;
        detail = grade ? `Grade ${grade} (${sc}/10)` : detail;
      } else if (ct === 'email_security') {
        const es = (log.details as any)?.emailSecurity;
        if (es) detail = [es.spfExists && 'SPF', es.dmarcExists && 'DMARC', es.dkimFound && 'DKIM'].filter(Boolean).join('+') || 'None configured';
      } else if (ct === 'open_ports') {
        const det = log.details as any;
        detail = det?.totalOpen ? `${det.totalOpen} open, ${det.criticalPorts || 0} critical` : 'No exposed ports';
      }
      checks.push({ name: ewLabels[ct] || ct, status: st, color: st === 'PASS' ? '0.2 0.8 0.4' : st === 'WARN' ? '1 0.7 0' : '0.9 0.2 0.2', detail, time: (log.checked_at || '').substring(0, 16) });
    }
  }

  const passCount = checks.filter(c => c.status === 'PASS').length;
  const failCount = checks.filter(c => c.status === 'FAIL').length;
  const warnCount = checks.filter(c => c.status === 'WARN').length;

  p1.push(`0.12 0.15 0.2 rg`);
  p1.push(`50 635 130 40 re f`, `200 635 130 40 re f`, `350 635 130 40 re f`);
  p1.push(`BT /F2 18 Tf 0.2 0.9 0.4 rg 90 653 Td (${passCount}) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 80 640 Td (Checks Passed) Tj ET`);
  p1.push(`BT /F2 18 Tf 0.9 0.4 0.2 rg 245 653 Td (${failCount}) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 232 640 Td (Checks Failed) Tj ET`);
  p1.push(`BT /F2 18 Tf 1 0.8 0 rg 395 653 Td (${warnCount}) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 387 640 Td (Warnings) Tj ET`);

  p1.push(`0.12 0.15 0.2 rg`, `50 588 480 24 re f`);
  p1.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 55 596 Td (CHECK TYPE) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 220 596 Td (STATUS) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 280 596 Td (DETAILS) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 450 596 Td (TIMESTAMP) Tj ET`);

  checks.slice(0, 10).forEach((c, i) => {
    const y = 572 - i * 20;
    if (i % 2 === 0) { p1.push(`0.1 0.13 0.17 rg`, `50 ${y - 4} 480 20 re f`); }
    p1.push(`BT /F1 9 Tf 0.9 0.95 1 rg 55 ${y + 3} Td (${s(c.name)}) Tj ET`);
    p1.push(`BT /F2 9 Tf ${c.color} rg 220 ${y + 3} Td (${c.status}) Tj ET`);
    p1.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 280 ${y + 3} Td (${s(c.detail, 30)}) Tj ET`);
    p1.push(`BT /F1 7 Tf 0.5 0.6 0.7 rg 450 ${y + 3} Td (${s(c.time?.replace('T', ' '), 16)}) Tj ET`);
  });

  const alertY = 160;
  p1.push(`BT /F2 11 Tf ${scoreColor} rg 50 ${alertY} Td (Alert Summary) Tj ET`);
  const openAlerts = alerts.filter((a: any) => a.status === 'open').length;
  const critAlerts = alerts.filter((a: any) => a.severity === 'critical').length;
  p1.push(`BT /F1 10 Tf 0.9 0.95 1 rg 50 ${alertY - 18} Td (${alerts.length} total alerts | ${openAlerts} open | ${critAlerts} critical) Tj ET`);

  if (techFp) {
    p1.push(`BT /F2 11 Tf ${scoreColor} rg 50 ${alertY - 45} Td (Technology Stack) Tj ET`);
    const techInfo = [techFp.web_server, techFp.cms, techFp.language, techFp.cdn].filter(Boolean).join(' | ') || 'Unknown';
    p1.push(`BT /F1 9 Tf 0.7 0.8 0.9 rg 50 ${alertY - 60} Td (${s(techInfo, 80)}) Tj ET`);
    if (techFp.outdated_count > 0) {
      p1.push(`BT /F1 9 Tf 1 0.5 0 rg 50 ${alertY - 75} Td (${techFp.outdated_count} outdated components, ${techFp.vulnerabilities_count || 0} known vulnerabilities) Tj ET`);
    }
  }

  p1.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
  p1.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (Somalia Cyber Defense Observatory | ${now} | CONFIDENTIAL) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.5 0.6 0.7 rg 40 18 Td (This report contains sensitive security information. Handle with appropriate care.) Tj ET`);
  pages.push(p1);

  // ── Page 2: Early Warning Details ──
  if (sections.earlyWarning && ewLogs.length > 0) {
    const p2: string[] = [];
    addHeader(p2, 'EARLY WARNING DETAILS', `${orgName} - All Security Check Results`);
    p2.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

    const byType: Record<string, any[]> = {};
    for (const log of ewLogs) {
      const ct = log.check_type;
      if (!byType[ct]) byType[ct] = [];
      byType[ct].push(log);
    }

    let y = 760;
    for (const [checkType, logs] of Object.entries(byType)) {
      if (y < 120) break;
      const label = ewLabels[checkType] || checkType;
      const latest = logs[0];

      const rlColor = latest.risk_level === 'safe' ? '0.2 0.8 0.4' : latest.risk_level === 'warning' ? '1 0.7 0' : '0.9 0.2 0.2';
      p2.push(`${rlColor} rg`, `50 ${y - 3} 6 12 re f`);
      p2.push(`BT /F2 10 Tf 0.9 0.95 1 rg 62 ${y} Td (${s(label)}) Tj ET`);
      p2.push(`BT /F1 8 Tf ${rlColor} rg 250 ${y} Td (${latest.risk_level.toUpperCase()}) Tj ET`);
      p2.push(`BT /F1 7 Tf 0.5 0.6 0.7 rg 350 ${y} Td (${s((latest.checked_at || '').substring(0, 16).replace('T', ' '), 16)}) Tj ET`);
      p2.push(`BT /F1 7 Tf 0.5 0.6 0.7 rg 460 ${y} Td (${logs.length} checks) Tj ET`);
      y -= 16;

      const det = latest.details as any;
      if (det) {
        let detailStr = '';
        if (checkType === 'security_headers') detailStr = `Grade: ${det.grade || '?'}, Score: ${det.score || 0}/10`;
        else if (checkType === 'email_security') {
          const es = det.emailSecurity;
          detailStr = es ? `SPF: ${es.spfExists ? 'Yes' : 'No'}, DMARC: ${es.dmarcExists ? 'Yes' : 'No'}, DKIM: ${es.dkimFound ? 'Yes' : 'No'}` : '';
        }
        else if (checkType === 'open_ports') detailStr = `Open: ${det.totalOpen || 0}, Critical: ${det.criticalPorts || 0}`;
        else if (checkType === 'defacement') detailStr = `Status: ${det.status || 'unknown'}`;
        else if (checkType === 'dns') detailStr = det.records ? `A: ${(det.records.A || []).length}, NS: ${(det.records.NS || []).length} records` : '';
        else if (checkType === 'blacklist') detailStr = det.blacklisted ? 'BLACKLISTED' : 'Clean';

        if (detailStr) {
          p2.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 62 ${y} Td (${s(detailStr, 85)}) Tj ET`);
          y -= 14;
        }
      }
      y -= 8;
    }

    p2.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
    p2.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (Early Warning Details | ${now} | Page 2) Tj ET`);
    pages.push(p2);
  }

  // ── Page 3: Threat Intelligence ──
  if (sections.threatIntel) {
    const p3: string[] = [];
    addHeader(p3, 'THREAT INTELLIGENCE', `${orgName} - Phishing, Breaches, and Technology Risks`);
    p3.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

    let y = 760;

    p3.push(`BT /F2 12 Tf 0 0.8 0.85 rg 50 ${y} Td (Phishing / Lookalike Domains) Tj ET`);
    y -= 18;
    if (phishingDomains.length === 0) {
      p3.push(`BT /F1 9 Tf 0.2 0.8 0.4 rg 50 ${y} Td (No lookalike domains detected.) Tj ET`);
      y -= 18;
    } else {
      p3.push(`0.12 0.15 0.2 rg`, `50 ${y - 4} 480 18 re f`);
      p3.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 55 ${y + 2} Td (LOOKALIKE DOMAIN) Tj ET`);
      p3.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 230 ${y + 2} Td (ORIGINAL) Tj ET`);
      p3.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 370 ${y + 2} Td (ACTIVE) Tj ET`);
      p3.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 430 ${y + 2} Td (RISK) Tj ET`);
      y -= 18;
      for (const pd of phishingDomains.slice(0, 8)) {
        if (y < 120) break;
        const activeColor = pd.is_active ? '0.9 0.2 0.2' : '0.2 0.8 0.4';
        p3.push(`BT /F1 8 Tf 0.9 0.95 1 rg 55 ${y} Td (${s(pd.lookalike_domain, 30)}) Tj ET`);
        p3.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 230 ${y} Td (${s(pd.original_domain, 25)}) Tj ET`);
        p3.push(`BT /F2 8 Tf ${activeColor} rg 370 ${y} Td (${pd.is_active ? 'YES' : 'NO'}) Tj ET`);
        p3.push(`BT /F1 8 Tf 0.9 0.95 1 rg 430 ${y} Td (${s(pd.risk_level)}) Tj ET`);
        y -= 14;
      }
      if (phishingDomains.length > 8) {
        p3.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 50 ${y} Td (... and ${phishingDomains.length - 8} more) Tj ET`);
        y -= 14;
      }
    }

    y -= 15;

    const breachLogs = tiLogs.filter(l => l.check_type === 'breach');
    p3.push(`BT /F2 12 Tf 0 0.8 0.85 rg 50 ${y} Td (Data Breach Exposure) Tj ET`);
    y -= 18;
    if (breachLogs.length === 0) {
      p3.push(`BT /F1 9 Tf 0.2 0.8 0.4 rg 50 ${y} Td (No known breach exposure detected.) Tj ET`);
      y -= 18;
    } else {
      for (const bl of breachLogs.slice(0, 5)) {
        if (y < 120) break;
        const det = bl.details as any;
        const bCount = det?.breaches?.length || 0;
        const rlColor = bl.risk_level === 'critical' ? '0.9 0.2 0.2' : bl.risk_level === 'high' ? '1 0.5 0' : '0.2 0.8 0.4';
        p3.push(`BT /F2 9 Tf ${rlColor} rg 50 ${y} Td (${s(bl.organization_name || 'Unknown', 40)}) Tj ET`);
        p3.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 280 ${y} Td (${bCount} breaches found | Risk: ${bl.risk_level}) Tj ET`);
        y -= 16;
        for (const b of (det?.breaches || []).slice(0, 3)) {
          if (y < 120) break;
          p3.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 65 ${y} Td (- ${s(b.name || b.title, 70)} ${b.breachDate ? '(' + b.breachDate + ')' : ''}) Tj ET`);
          y -= 13;
        }
        y -= 5;
      }
    }

    y -= 15;

    if (techFp) {
      p3.push(`BT /F2 12 Tf 0 0.8 0.85 rg 50 ${y} Td (Technology Stack Analysis) Tj ET`);
      y -= 18;
      const components = [
        techFp.web_server && `Web Server: ${techFp.web_server}${techFp.web_server_version ? ' ' + techFp.web_server_version : ''}`,
        techFp.cms && `CMS: ${techFp.cms}${techFp.cms_version ? ' ' + techFp.cms_version : ''}`,
        techFp.language && `Language: ${techFp.language}${techFp.language_version ? ' ' + techFp.language_version : ''}`,
        techFp.cdn && `CDN: ${techFp.cdn}`,
      ].filter(Boolean);
      for (const comp of components) {
        p3.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 55 ${y} Td (${s(comp!, 80)}) Tj ET`);
        y -= 14;
      }
      if (techFp.outdated_count > 0 || techFp.vulnerabilities_count > 0) {
        p3.push(`BT /F2 8 Tf 1 0.5 0 rg 55 ${y} Td (${techFp.outdated_count} outdated | ${techFp.vulnerabilities_count} vulnerabilities) Tj ET`);
        y -= 14;
      }
    }

    p3.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
    p3.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (Threat Intelligence | ${now} | Page 3) Tj ET`);
    pages.push(p3);
  }

  // ── Page 4: Alert History ──
  if (sections.alertHistory && alerts.length > 0) {
    const p4: string[] = [];
    addHeader(p4, 'ALERT HISTORY', `${orgName} - ${alerts.length} Alerts in Period`);
    p4.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

    const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of alerts) sevCounts[a.severity as keyof typeof sevCounts] = (sevCounts[a.severity as keyof typeof sevCounts] || 0) + 1;
    const statusCounts = { open: 0, acknowledged: 0, closed: 0 };
    for (const a of alerts) {
      if (a.status === 'open') statusCounts.open++;
      else if (a.status === 'acknowledged') statusCounts.acknowledged++;
      else statusCounts.closed++;
    }

    let y = 760;
    p4.push(`BT /F2 11 Tf 0 0.8 0.85 rg 50 ${y} Td (Severity Breakdown) Tj ET`);
    y -= 18;
    p4.push(`BT /F1 9 Tf 0.9 0.2 0.2 rg 50 ${y} Td (Critical: ${sevCounts.critical}) Tj ET`);
    p4.push(`BT /F1 9 Tf 1 0.5 0 rg 180 ${y} Td (High: ${sevCounts.high}) Tj ET`);
    p4.push(`BT /F1 9 Tf 1 0.8 0 rg 280 ${y} Td (Medium: ${sevCounts.medium}) Tj ET`);
    p4.push(`BT /F1 9 Tf 0.4 0.6 1 rg 380 ${y} Td (Low: ${sevCounts.low}) Tj ET`);
    y -= 18;
    p4.push(`BT /F1 9 Tf 0.7 0.8 0.9 rg 50 ${y} Td (Open: ${statusCounts.open} | Acknowledged: ${statusCounts.acknowledged} | Closed: ${statusCounts.closed}) Tj ET`);
    y -= 25;

    p4.push(`0.12 0.15 0.2 rg`, `50 ${y - 4} 480 18 re f`);
    p4.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 55 ${y + 2} Td (SEVERITY) Tj ET`);
    p4.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 115 ${y + 2} Td (TITLE) Tj ET`);
    p4.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 360 ${y + 2} Td (STATUS) Tj ET`);
    p4.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 430 ${y + 2} Td (DATE) Tj ET`);
    y -= 18;

    for (const a of alerts.slice(0, 25)) {
      if (y < 100) break;
      const sevColor = a.severity === 'critical' ? '0.9 0.2 0.2' : a.severity === 'high' ? '1 0.5 0' : a.severity === 'medium' ? '1 0.8 0' : '0.4 0.6 1';
      p4.push(`BT /F2 8 Tf ${sevColor} rg 55 ${y} Td (${(a.severity || '').toUpperCase()}) Tj ET`);
      p4.push(`BT /F1 8 Tf 0.9 0.95 1 rg 115 ${y} Td (${s(a.title, 40)}) Tj ET`);
      p4.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 360 ${y} Td (${s(a.status)}) Tj ET`);
      p4.push(`BT /F1 7 Tf 0.5 0.6 0.7 rg 430 ${y} Td (${s((a.created_at || '').substring(0, 10))}) Tj ET`);
      y -= 14;
    }

    p4.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
    p4.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (Alert History | ${now} | Page 4) Tj ET`);
    pages.push(p4);
  }

  // ── Page 5: Remediation Plan ──
  if (includeRemediation && remediations.length > 0) {
    const p5: string[] = [];
    addHeader(p5, 'REMEDIATION ACTION PLAN', `${orgName} - Step-by-Step Fix Instructions`);
    p5.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

    const critCount = remediations.filter(r => r.severity === 'critical').length;
    const highCount = remediations.filter(r => r.severity === 'high').length;
    const medCount = remediations.filter(r => r.severity === 'medium').length;
    p5.push(`BT /F2 12 Tf 0.9 0.95 1 rg 50 760 Td (${remediations.length} Issues: ${critCount} Critical, ${highCount} High, ${medCount} Medium) Tj ET`);

    let y = 735;
    for (const rem of remediations.slice(0, 8)) {
      if (y < 100) break;
      const sevColor = rem.severity === 'critical' ? '0.9 0.2 0.2' : rem.severity === 'high' ? '1 0.5 0' : '1 0.8 0';
      p5.push(`${sevColor} rg`, `50 ${y - 3} 6 12 re f`);
      p5.push(`BT /F2 10 Tf 0.9 0.95 1 rg 62 ${y} Td (${s(rem.issue, 70)}) Tj ET`);
      p5.push(`BT /F1 8 Tf ${sevColor} rg 62 ${y - 12} Td (${rem.severity.toUpperCase()} | Est: ${rem.estimatedTime}) Tj ET`);
      y -= 26;
      for (const step of rem.steps.slice(0, 3)) {
        if (y < 100) break;
        p5.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 72 ${y} Td (${s(step, 85)}) Tj ET`);
        y -= 13;
      }
      y -= 8;
    }

    p5.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
    p5.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (Remediation Plan | ${now} | Priority: Critical > High > Medium) Tj ET`);
    pages.push(p5);
  }

  // Build multi-page PDF
  const pageCount = pages.length;
  const fontObj1 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  const fontObj2 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
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
  addObj(`3 0 obj\n${fontObj1}\nendobj\n`);
  addObj(`4 0 obj\n${fontObj2}\nendobj\n`);

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { org_id, date_from, date_to, includeRemediation,
      includeEarlyWarning = true, includeThreatIntel = true, includeAlertHistory = true } = await req.json();
    if (!org_id) return new Response(JSON.stringify({ error: 'org_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    const dateFromFilter = date_from || '2020-01-01';
    const dateToFilter = (date_to || new Date().toISOString().split('T')[0]) + 'T23:59:59';

    // Fetch all data in parallel from real monitoring tables + logo
    const [orgData, alertsData, sslData, ddosData, ewData, techData, uptimeData, phishingData, tiData, logoData] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', org_id).single(),
      supabase.from('alerts').select('*').eq('organization_id', org_id)
        .gte('created_at', dateFromFilter).lte('created_at', dateToFilter)
        .order('created_at', { ascending: false }).limit(100),
      supabase.from('ssl_logs').select('*').eq('organization_id', org_id)
        .order('checked_at', { ascending: false }).limit(1),
      supabase.from('ddos_risk_logs').select('*').eq('organization_id', org_id)
        .order('checked_at', { ascending: false }).limit(1),
      supabase.from('early_warning_logs').select('*').eq('organization_id', org_id)
        .gte('checked_at', dateFromFilter).lte('checked_at', dateToFilter)
        .order('checked_at', { ascending: false }).limit(200),
      supabase.from('tech_fingerprints').select('*').eq('organization_id', org_id)
        .order('checked_at', { ascending: false }).limit(1),
      supabase.from('uptime_logs').select('*').eq('organization_id', org_id)
        .gte('checked_at', dateFromFilter).lte('checked_at', dateToFilter)
        .order('checked_at', { ascending: false }).limit(500),
      supabase.from('phishing_domains').select('*').eq('organization_id', org_id),
      supabase.from('threat_intelligence_logs').select('*').eq('organization_id', org_id)
        .order('checked_at', { ascending: false }).limit(50),
      fetchLogoPngData(),
    ]);

    const sslLog = sslData.data?.[0] || null;
    const ddosLog = ddosData.data?.[0] || null;
    const ewLogs = ewData.data || [];
    const techFp = techData.data?.[0] || null;

    const remediations = includeRemediation ? buildRemediations({ sslLog, ddosLog, ewLogs, techFp }) : [];

    const pdfBytes = generatePDF({
      org: orgData.data,
      alerts: alertsData.data || [],
      dateFrom: date_from || 'all time',
      dateTo: date_to || new Date().toISOString().split('T')[0],
      remediations,
      includeRemediation: !!includeRemediation,
      sslLog, ddosLog, ewLogs,
      uptimeLogs: uptimeData.data || [],
      techFp,
      phishingDomains: phishingData.data || [],
      tiLogs: tiData.data || [],
      sections: {
        earlyWarning: includeEarlyWarning,
        threatIntel: includeThreatIntel,
        alertHistory: includeAlertHistory,
      },
      logoData,
    });

    let binary = '';
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const base64 = btoa(binary);

    return new Response(JSON.stringify({ pdf: base64, remediations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('generate-report error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
