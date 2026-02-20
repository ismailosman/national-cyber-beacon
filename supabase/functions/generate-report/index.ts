import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  // SSL
  if (sslLog && (!sslLog.is_valid || sslLog.is_expired)) {
    rems.push({
      issue: 'SSL Certificate Invalid or Expired',
      severity: 'critical',
      steps: [
        'Use Let\'s Encrypt (free) to issue a new SSL certificate: certbot certonly --webroot -w /var/www/html -d yourdomain.so',
        'Install the certificate on your web server (Apache/Nginx)',
        'Set up auto-renewal: add cron job "0 0 1 * * certbot renew --quiet"',
        'Verify with: openssl s_client -connect yourdomain.so:443',
      ],
      estimatedTime: '15 minutes',
    });
  } else if (sslLog?.is_expiring_soon) {
    rems.push({
      issue: `SSL Certificate Expiring in ${sslLog.days_until_expiry} days`,
      severity: 'high',
      steps: ['Renew certificate before expiry using certbot renew or your CA portal', 'Enable auto-renewal to prevent future expiry'],
      estimatedTime: '10 minutes',
    });
  }

  // DDoS Protection
  if (ddosLog) {
    if (!ddosLog.has_cdn) {
      rems.push({
        issue: 'No CDN Protection',
        severity: 'critical',
        steps: [
          'Sign up for Cloudflare free tier at cloudflare.com',
          'Update your domain nameservers to Cloudflare nameservers',
          'Enable "Always Use HTTPS" and "Auto Minify" in Cloudflare',
          'This also provides WAF, DDoS protection, and caching',
        ],
        estimatedTime: '30 minutes',
      });
    }
    if (!ddosLog.has_waf) {
      rems.push({
        issue: 'No Web Application Firewall (WAF)',
        severity: 'critical',
        steps: [
          'If using Cloudflare: enable WAF rules under Security > WAF',
          'Enable OWASP ModSecurity Core Rule Set managed rules',
          'Set Security Level to "High" under Security > Settings',
        ],
        estimatedTime: '15 minutes',
      });
    }
    if (!ddosLog.has_rate_limiting) {
      rems.push({
        issue: 'No Rate Limiting',
        severity: 'high',
        steps: [
          'If using Cloudflare: create rate limiting rules under Security > WAF > Rate limiting',
          'Set login page limit: 10 requests/minute per IP',
          'Set general page limit: 100 requests/minute per IP',
        ],
        estimatedTime: '10 minutes',
      });
    }
    if (ddosLog.origin_exposed) {
      rems.push({
        issue: 'Origin Server IP Exposed',
        severity: 'high',
        steps: [
          'Ensure DNS is proxied through CDN (orange cloud in Cloudflare)',
          'Change origin server IP if it was previously exposed',
          'Block direct IP access on the origin server firewall',
        ],
        estimatedTime: '20 minutes',
      });
    }
  }

  // Security Headers
  const headersLog = ewLogs.find(e => e.check_type === 'security_headers');
  if (headersLog) {
    const det = headersLog.details as any;
    const headers = det?.headers || {};
    const missing: string[] = [];
    if (!headers['strict-transport-security']) missing.push('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    if (!headers['content-security-policy']) missing.push('Content-Security-Policy: default-src \'self\'');
    if (!headers['x-frame-options']) missing.push('X-Frame-Options: DENY');
    if (!headers['x-content-type-options']) missing.push('X-Content-Type-Options: nosniff');
    if (missing.length > 0) {
      rems.push({
        issue: `${missing.length} Missing Security Headers`,
        severity: missing.length >= 3 ? 'high' : 'medium',
        steps: [
          'Add the following headers to your web server configuration:',
          ...missing.map(h => `  ${h}`),
          'For Nginx: add_header directive in server block',
          'For Apache: Header set directive in .htaccess or httpd.conf',
        ],
        estimatedTime: '5 minutes',
      });
    }
  }

  // Email Security
  const emailLog = ewLogs.find(e => e.check_type === 'email_security' || e.check_type === 'dns');
  if (emailLog) {
    const es = (emailLog.details as any)?.emailSecurity;
    if (es && !es.spfExists) {
      rems.push({
        issue: 'No SPF Record - Email Spoofing Possible',
        severity: 'critical',
        steps: [
          'Add TXT record to DNS: v=spf1 include:_spf.google.com ~all',
          'Adjust "include:" for your email provider',
          'Test with: dig TXT yourdomain.so',
        ],
        estimatedTime: '5 minutes',
      });
    }
    if (es && !es.dmarcExists) {
      rems.push({
        issue: 'No DMARC Record',
        severity: 'high',
        steps: [
          'Add TXT record at _dmarc.yourdomain.so:',
          '  v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.so',
          'Start with p=none to monitor, then move to p=reject',
        ],
        estimatedTime: '10 minutes',
      });
    }
  }

  // Open Ports
  const portsLog = ewLogs.find(e => e.check_type === 'open_ports');
  if (portsLog && portsLog.risk_level !== 'safe') {
    const det = portsLog.details as any;
    const critical = det?.openPorts?.filter((p: any) => p.risk === 'critical') || [];
    if (critical.length > 0) {
      rems.push({
        issue: `${critical.length} Critical Database Port(s) Exposed`,
        severity: 'critical',
        steps: [
          `Close these ports IMMEDIATELY: ${critical.map((p: any) => `${p.port} (${p.service})`).join(', ')}`,
          'Linux: sudo ufw deny 3306 && sudo ufw deny 5432 && sudo ufw deny 27017',
          'Cloud: update security group/firewall rules',
          'Restrict database access to localhost or VPN only',
        ],
        estimatedTime: '5 minutes',
      });
    }
  }

  // Software
  if (techFp && techFp.outdated_count > 0) {
    rems.push({
      issue: `${techFp.outdated_count} Outdated Software Component(s)`,
      severity: 'medium',
      steps: [
        techFp.cms ? `Update ${techFp.cms} to the latest version` : 'Update all CMS software',
        'Update all plugins and extensions',
        'Remove unused plugins and themes',
        'Enable automatic security updates where possible',
      ],
      estimatedTime: '30 minutes',
    });
  }

  // Sort by severity
  const order = { critical: 0, high: 1, medium: 2 };
  rems.sort((a, b) => order[a.severity] - order[b.severity]);
  return rems;
}

/* ─── PDF Generator ─── */
function generatePDF(data: {
  org: any; checks: any[]; alerts: any[]; history: any[];
  dateFrom: string; dateTo: string; remediations: Remediation[];
  includeRemediation: boolean;
}): Uint8Array {
  const { org, checks, alerts, dateFrom, dateTo, remediations, includeRemediation } = data;
  const now = new Date().toISOString().split('T')[0];
  const passCount = checks.filter(c => c.result === 'pass').length;
  const failCount = checks.filter(c => c.result === 'fail').length;
  const warnCount = checks.filter(c => c.result === 'warn').length;
  const scoreColor = org.risk_score >= 75 ? '0.2 0.8 0.4' : org.risk_score >= 50 ? '1 0.7 0' : '0.9 0.2 0.2';

  const checkTypeLabels: Record<string, string> = {
    ssl: 'SSL Certificate', https: 'HTTPS Enforcement',
    headers: 'Security Headers', dns: 'DNS Resolution', uptime: 'Uptime Check'
  };

  const recMap: Record<string, string> = {
    ssl: 'Renew/fix SSL certificate immediately.',
    https: 'Enable HTTPS redirect on your web server.',
    headers: 'Implement HSTS, CSP, X-Frame-Options headers.',
    dns: 'Review DNS configuration for the domain.',
    uptime: 'Investigate downtime. Add redundant servers.'
  };

  // Build pages
  const pages: string[][] = [];

  // Page 1: Main report
  const p1: string[] = [];
  p1.push(`% Header bar`);
  p1.push(`0.05 0.07 0.1 rg`);
  p1.push(`0 790 595 52 re f`);
  p1.push(`0 0.4 0.6 rg`);
  p1.push(`BT /F2 20 Tf 1 1 1 rg 40 810 Td (SOMALIA CYBER DEFENSE OBSERVATORY) Tj ET`);
  p1.push(`BT /F2 11 Tf 1 1 1 rg 40 797 Td (Security Risk Assessment Report) Tj ET`);

  p1.push(`% Body`);
  p1.push(`0.08 0.1 0.14 rg`);
  p1.push(`30 120 535 660 re f`);
  p1.push(`0.12 0.15 0.2 rg`);
  p1.push(`30 680 535 90 re f`);

  const orgName = (org.name || '').replace(/[()\\]/g, ' ');
  const domain = (org.domain || '').replace(/[()\\]/g, ' ');
  p1.push(`BT /F2 16 Tf 0.9 0.95 1 rg 50 748 Td (${orgName}) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.6 0.7 0.8 rg 50 732 Td (${domain} | ${org.sector} | Report: ${dateFrom} to ${dateTo}) Tj ET`);

  p1.push(`${scoreColor} rg`);
  p1.push(`460 700 105 70 re f`);
  p1.push(`BT /F2 32 Tf 0.05 0.07 0.1 rg 478 728 Td (${org.risk_score}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.05 0.07 0.1 rg 487 712 Td (/ 100) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.05 0.07 0.1 rg 480 700 Td (${(org.status || '').toUpperCase()}) Tj ET`);

  p1.push(`BT /F2 11 Tf ${scoreColor} rg 50 670 Td (Security Check Summary) Tj ET`);
  p1.push(`0.12 0.15 0.2 rg`);
  p1.push(`50 620 130 40 re f`);
  p1.push(`200 620 130 40 re f`);
  p1.push(`350 620 130 40 re f`);
  p1.push(`BT /F2 16 Tf 0.2 0.9 0.4 rg 90 638 Td (${passCount}) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 82 625 Td (Checks Passed) Tj ET`);
  p1.push(`BT /F2 16 Tf 0.9 0.4 0.2 rg 240 638 Td (${failCount}) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 232 625 Td (Checks Failed) Tj ET`);
  p1.push(`BT /F2 16 Tf 1 0.8 0 rg 390 638 Td (${warnCount}) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 382 625 Td (Warnings) Tj ET`);

  p1.push(`BT /F2 11 Tf ${scoreColor} rg 50 600 Td (Security Check Results) Tj ET`);
  p1.push(`0.12 0.15 0.2 rg`);
  p1.push(`50 565 480 28 re f`);
  p1.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 55 577 Td (CHECK TYPE) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 280 577 Td (RESULT) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 380 577 Td (TIMESTAMP) Tj ET`);

  const uniqueChecks = checks.filter((c, i, arr) => arr.findIndex(x => x.check_type === c.check_type) === i).slice(0, 5);
  uniqueChecks.forEach((c, i) => {
    const y = 550 - i * 22;
    if (i % 2 === 0) {
      p1.push(`0.1 0.13 0.17 rg`);
      p1.push(`50 ${y - 6} 480 22 re f`);
    }
    const label = checkTypeLabels[c.check_type] || c.check_type;
    const rc = c.result === 'pass' ? '0.2 0.8 0.4' : c.result === 'fail' ? '0.9 0.2 0.2' : '1 0.7 0';
    const ts = c.checked_at ? c.checked_at.substring(0, 16).replace('T', ' ') : now;
    p1.push(`BT /F1 9 Tf 0.9 0.95 1 rg 55 ${y + 2} Td (${label}) Tj ET`);
    p1.push(`BT /F2 9 Tf ${rc} rg 280 ${y + 2} Td (${(c.result || '').toUpperCase()}) Tj ET`);
    p1.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 380 ${y + 2} Td (${ts}) Tj ET`);
  });

  // Basic recommendations
  const recY = 420;
  p1.push(`BT /F2 11 Tf ${scoreColor} rg 50 ${recY} Td (Recommendations) Tj ET`);
  const failedChecks = checks.filter(c => c.result !== 'pass');
  if (failedChecks.length === 0) {
    p1.push(`BT /F1 10 Tf 0.2 0.8 0.4 rg 50 ${recY - 20} Td (All security checks passed. Maintain current security posture.) Tj ET`);
  } else {
    const uniqueFailed = failedChecks.filter((c, i, arr) => arr.findIndex(x => x.check_type === c.check_type) === i).slice(0, 5);
    uniqueFailed.forEach((c, i) => {
      const ry = recY - 20 - i * 25;
      const rec = recMap[c.check_type] || 'Review and remediate this security check.';
      p1.push(`BT /F2 9 Tf 1 0.7 0 rg 50 ${ry} Td (-> ) Tj ET`);
      p1.push(`BT /F1 9 Tf 0.9 0.95 1 rg 62 ${ry} Td (${rec.replace(/[()\\]/g, ' ')}) Tj ET`);
    });
  }

  const alertY = 200;
  p1.push(`BT /F2 11 Tf ${scoreColor} rg 50 ${alertY} Td (Alert Summary) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.9 0.95 1 rg 50 ${alertY - 18} Td (${alerts.length} total alerts in period. ${alerts.filter((a: any) => !a.is_read).length} unread.) Tj ET`);

  p1.push(`0.15 0.19 0.25 rg`);
  p1.push(`0 0 595 70 re f`);
  p1.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 45 Td (Generated by Somalia Cyber Defense Observatory | ${now} | CONFIDENTIAL) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 32 Td (This report contains sensitive security information. Handle with appropriate care.) Tj ET`);

  pages.push(p1);

  // Page 2: Remediation Report (if enabled and there are issues)
  if (includeRemediation && remediations.length > 0) {
    const p2: string[] = [];
    p2.push(`0.05 0.07 0.1 rg`);
    p2.push(`0 790 595 52 re f`);
    p2.push(`BT /F2 18 Tf 1 1 1 rg 40 810 Td (REMEDIATION ACTION PLAN) Tj ET`);
    p2.push(`BT /F1 10 Tf 1 1 1 rg 40 797 Td (${orgName} - Step-by-Step Fix Instructions) Tj ET`);

    p2.push(`0.08 0.1 0.14 rg`);
    p2.push(`30 100 535 680 re f`);

    // Summary
    const critCount = remediations.filter(r => r.severity === 'critical').length;
    const highCount = remediations.filter(r => r.severity === 'high').length;
    const medCount = remediations.filter(r => r.severity === 'medium').length;
    p2.push(`BT /F2 12 Tf 0.9 0.95 1 rg 50 760 Td (${remediations.length} Issues Found: ${critCount} Critical, ${highCount} High, ${medCount} Medium) Tj ET`);

    let y = 735;
    remediations.slice(0, 6).forEach((rem, idx) => {
      if (y < 130) return;
      const sevColor = rem.severity === 'critical' ? '0.9 0.2 0.2' : rem.severity === 'high' ? '1 0.5 0' : '1 0.8 0';

      // Issue header with severity badge
      p2.push(`${sevColor} rg`);
      p2.push(`50 ${y - 5} 8 14 re f`);
      const issueText = rem.issue.replace(/[()\\]/g, ' ').substring(0, 80);
      p2.push(`BT /F2 10 Tf 0.9 0.95 1 rg 65 ${y} Td (${issueText}) Tj ET`);
      p2.push(`BT /F1 8 Tf ${sevColor} rg 65 ${y - 12} Td (${rem.severity.toUpperCase()} | Est. time: ${rem.estimatedTime}) Tj ET`);
      y -= 28;

      // Steps (max 4 per remediation)
      rem.steps.slice(0, 4).forEach((step, si) => {
        if (y < 130) return;
        const stepText = step.replace(/[()\\]/g, ' ').substring(0, 90);
        p2.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 75 ${y} Td (${si + 1}. ${stepText}) Tj ET`);
        y -= 14;
      });
      y -= 10;
    });

    // Footer
    p2.push(`0.15 0.19 0.25 rg`);
    p2.push(`0 0 595 70 re f`);
    p2.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 45 Td (Remediation Plan | ${now} | Priority: Critical fixes first, then High, then Medium) Tj ET`);
    p2.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 32 Td (Contact CERT-SO for assistance with remediation implementation.) Tj ET`);

    pages.push(p2);
  }

  // Build multi-page PDF
  const pageCount = pages.length;
  const fontObj1 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  const fontObj2 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;

  // Encode all streams
  const streams = pages.map(p => new TextEncoder().encode(p.join('\n')));

  // Object numbering: 1=catalog, 2=pages, 3=font1, 4=font2, then per page: pageObj, streamObj
  const baseObj = 5;
  const pageObjIds = pages.map((_, i) => baseObj + i * 2);
  const streamObjIds = pages.map((_, i) => baseObj + i * 2 + 1);
  const totalObjects = baseObj + pageCount * 2;

  let pdf = `%PDF-1.4\n`;
  pdf += `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  pdf += `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`;
  pdf += `3 0 obj\n${fontObj1}\nendobj\n`;
  pdf += `4 0 obj\n${fontObj2}\nendobj\n`;

  for (let i = 0; i < pageCount; i++) {
    pdf += `${pageObjIds[i]} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObjIds[i]} 0 R >>\nendobj\n`;
    pdf += `${streamObjIds[i]} 0 obj\n<< /Length ${streams[i].length} >>\nstream\n`;
    pdf += new TextDecoder().decode(streams[i]);
    pdf += `\nendstream\nendobj\n`;
  }

  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < totalObjects; i++) {
    pdf += `${String(i * 100).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { org_id, date_from, date_to, includeRemediation } = await req.json();
    if (!org_id) return new Response(JSON.stringify({ error: 'org_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    // Fetch all data in parallel
    const [orgData, checksData, alertsData, historyData, sslData, ddosData, ewData, techData] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', org_id).single(),
      supabase.from('security_checks').select('*')
        .gte('checked_at', date_from || '2020-01-01')
        .lte('checked_at', (date_to || new Date().toISOString().split('T')[0]) + 'T23:59:59')
        .order('checked_at', { ascending: false }).limit(100),
      supabase.from('alerts').select('*').eq('organization_id', org_id)
        .gte('created_at', date_from || '2020-01-01')
        .order('created_at', { ascending: false }),
      supabase.from('risk_history').select('*').eq('organization_id', org_id)
        .order('created_at', { ascending: true }).limit(30),
      // Additional tables for remediation
      supabase.from('ssl_logs').select('*').eq('organization_id', org_id)
        .order('checked_at', { ascending: false }).limit(1),
      supabase.from('ddos_risk_logs').select('*').eq('organization_id', org_id)
        .order('checked_at', { ascending: false }).limit(1),
      supabase.from('early_warning_logs').select('*').eq('organization_id', org_id)
        .order('checked_at', { ascending: false }).limit(50),
      supabase.from('tech_fingerprints').select('*').eq('organization_id', org_id)
        .order('checked_at', { ascending: false }).limit(1),
    ]);

    // Build remediations from monitoring data
    const remediations = includeRemediation ? buildRemediations({
      sslLog: sslData.data?.[0] || null,
      ddosLog: ddosData.data?.[0] || null,
      ewLogs: ewData.data || [],
      techFp: techData.data?.[0] || null,
    }) : [];

    const pdfBytes = generatePDF({
      org: orgData.data,
      checks: checksData.data || [],
      alerts: alertsData.data || [],
      history: historyData.data || [],
      dateFrom: date_from || 'all time',
      dateTo: date_to || new Date().toISOString().split('T')[0],
      remediations,
      includeRemediation: !!includeRemediation,
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
