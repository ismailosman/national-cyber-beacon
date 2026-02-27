import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchLogoPngData } from "../_shared/logoUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function s(text: string | null | undefined, maxLen = 90): string {
  return (text || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/[()\\]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, maxLen);
}

function getGrade(score: number) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function buildLogoXObject(logoData: { width: number; height: number; rgbHex: string }, objId: number): string {
  const { width, height, rgbHex } = logoData;
  return `${objId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgbHex.length} /Filter /ASCIIHexDecode >>\nstream\n${rgbHex}>\nendstream\nendobj\n`;
}

/* ─── PDF Generator ─── */
function generateCompliancePDF(
  results: any,
  orgName: string,
  targetUrl: string,
  logoData: { width: number; height: number; rgbHex: string } | null,
): Uint8Array {
  const now = new Date().toISOString().split('T')[0];
  const hasLogo = !!logoData;
  const tx = hasLogo ? 82 : 40;
  const score = results.overall_score ?? 0;
  const grade = results.grade || getGrade(score);
  const passed = results.passed ?? 0;
  const failed = results.failed ?? 0;
  const total = results.total_controls ?? (passed + failed);
  const frameworks = results.frameworks || {};
  const findings = (results.compliance_findings || []).sort((a: any, b: any) => {
    const ord: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
    return (ord[a.severity] ?? 5) - (ord[b.severity] ?? 5);
  });
  const rawChecks = results.raw_checks || {};
  const checkedAt = results.checked_at
    ? new Date(results.checked_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : now;

  const pages: string[][] = [];

  function addHeader(p: string[], title: string) {
    p.push(`0.08 0.12 0.2 rg`, `0 790 595 52 re f`);
    p.push(`0.85 0.15 0.1 rg`, `0 788 595 2 re f`);
    if (hasLogo) p.push(`q 36 0 0 36 40 798 cm /Logo Do Q`);
    p.push(`BT /F2 16 Tf 1 1 1 rg ${tx} 812 Td (SOMALIA CYBER DEFENCE) Tj ET`);
    p.push(`BT /F1 9 Tf 0.8 0.85 0.9 rg ${tx} 800 Td (${title}) Tj ET`);
  }

  function addFooter(p: string[], pageNum: number) {
    p.push(`0.93 0.94 0.95 rg`, `0 0 595 40 re f`);
    p.push(`0.08 0.12 0.2 rg`, `0 40 595 1 re f`);
    p.push(`BT /F1 7 Tf 0.4 0.45 0.5 rg 40 22 Td (Somalia Cyber Defence | ${now} | CONFIDENTIAL) Tj ET`);
    p.push(`BT /F1 7 Tf 0.4 0.45 0.5 rg 480 22 Td (Page ${pageNum}) Tj ET`);
    p.push(`BT /F1 6 Tf 0.5 0.55 0.6 rg 40 12 Td (This report contains sensitive compliance information. Handle with appropriate care.) Tj ET`);
  }

  function scoreColorPdf(sc: number): string {
    if (sc >= 80) return '0.1 0.6 0.3';
    if (sc >= 60) return '0.8 0.6 0';
    if (sc >= 40) return '0.85 0.45 0';
    return '0.8 0.15 0.1';
  }

  function barBg(sc: number): string {
    if (sc >= 80) return '0.85 0.96 0.85';
    if (sc >= 60) return '1 0.96 0.85';
    if (sc >= 40) return '1 0.93 0.85';
    return '1 0.9 0.9';
  }

  // ══════════════════════════════════════════════
  // PAGE 1 — Executive Summary
  // ══════════════════════════════════════════════
  const p1: string[] = [];
  p1.push(`1 1 1 rg`, `0 0 595 842 re f`);
  addHeader(p1, 'Compliance Assessment Report');

  // Info box
  p1.push(`0.95 0.96 0.97 rg`, `30 700 535 80 re f`);
  p1.push(`0.85 0.15 0.1 rg`, `30 700 3 80 re f`);
  p1.push(`BT /F2 12 Tf 0.08 0.12 0.2 rg 45 758 Td (Organization: ${s(orgName, 50)}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.3 0.35 0.4 rg 45 742 Td (Target: ${s(targetUrl, 60)}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.3 0.35 0.4 rg 45 726 Td (Scan Date: ${s(checkedAt, 40)} | Generated: ${now}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.3 0.35 0.4 rg 45 710 Td (Frameworks: NIST CSF 2.0, ISO 27001, GDPR, ITU NCI) Tj ET`);

  // Score box
  const sc = scoreColorPdf(score);
  p1.push(`${sc} rg`, `460 715 105 65 re f`);
  p1.push(`BT /F2 36 Tf 1 1 1 rg 476 743 Td (${score}) Tj ET`);
  p1.push(`BT /F1 10 Tf 1 1 1 rg 490 728 Td (/ 100) Tj ET`);
  p1.push(`BT /F2 11 Tf 1 1 1 rg 478 715 Td (Grade: ${grade}) Tj ET`);

  // Pass/Fail Summary
  p1.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 682 Td (COMPLIANCE SUMMARY) Tj ET`);
  p1.push(`0.85 0.15 0.1 rg`, `40 678 130 2 re f`);

  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  // Pass/fail boxes
  const summaryBoxes = [
    { label: 'TOTAL', value: total, bg: '0.93 0.94 0.96', color: '0.08 0.12 0.2' },
    { label: 'PASSED', value: passed, bg: '0.88 0.96 0.88', color: '0.1 0.6 0.3' },
    { label: 'FAILED', value: failed, bg: '1 0.92 0.92', color: '0.8 0.15 0.1' },
    { label: 'PASS RATE', value: `${passRate}%`, bg: '0.9 0.93 1', color: '0.15 0.3 0.7' },
  ];
  summaryBoxes.forEach((b, i) => {
    const bx = 40 + i * 132;
    p1.push(`${b.bg} rg`, `${bx} 635 120 38 re f`);
    p1.push(`BT /F2 20 Tf ${b.color} rg ${bx + 35} 650 Td (${b.value}) Tj ET`);
    p1.push(`BT /F1 7 Tf 0.4 0.45 0.5 rg ${bx + 30} 638 Td (${b.label}) Tj ET`);
  });

  // Progress bar
  p1.push(`0.9 0.9 0.9 rg`, `40 620 515 8 re f`);
  const barW = Math.round(515 * passRate / 100);
  p1.push(`${scoreColorPdf(score)} rg`, `40 620 ${barW} 8 re f`);
  p1.push(`BT /F1 7 Tf 0.4 0.45 0.5 rg 40 610 Td (${passed} of ${total} controls passed) Tj ET`);

  // Framework Averages
  p1.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 590 Td (FRAMEWORK AVERAGES) Tj ET`);
  p1.push(`0.85 0.15 0.1 rg`, `40 586 130 2 re f`);

  const fwList = [
    { key: 'nist_csf', label: 'NIST CSF 2.0' },
    { key: 'iso_27001', label: 'ISO 27001' },
    { key: 'gdpr', label: 'GDPR' },
    { key: 'itu_nci', label: 'ITU NCI' },
  ];

  let fy = 568;
  for (const fw of fwList) {
    const fwData = frameworks[fw.key];
    const avg = fwData?.average ?? 0;
    const fwBarW = Math.round(350 * avg / 100);

    p1.push(`BT /F2 9 Tf 0.08 0.12 0.2 rg 50 ${fy} Td (${fw.label}) Tj ET`);
    p1.push(`BT /F2 9 Tf ${scoreColorPdf(avg)} rg 510 ${fy} Td (${Math.round(avg)}) Tj ET`);
    fy -= 4;
    // Bar background
    p1.push(`0.9 0.91 0.92 rg`, `160 ${fy - 4} 350 10 re f`);
    // Bar fill
    p1.push(`${scoreColorPdf(avg)} rg`, `160 ${fy - 4} ${fwBarW} 10 re f`);
    fy -= 22;
  }

  addFooter(p1, 1);
  pages.push(p1);

  // ══════════════════════════════════════════════
  // PAGE 2 — Framework Breakdown
  // ══════════════════════════════════════════════
  const p2: string[] = [];
  p2.push(`1 1 1 rg`, `0 0 595 842 re f`);
  addHeader(p2, 'Framework Category Breakdown');

  let y2 = 770;

  for (const fw of fwList) {
    const fwData = frameworks[fw.key];
    if (!fwData?.scores) continue;
    const categories = Object.entries(fwData.scores) as [string, number][];
    if (categories.length === 0) continue;

    if (y2 < 120) break;

    p2.push(`0.08 0.12 0.2 rg`, `40 ${y2 - 2} 515 18 re f`);
    p2.push(`BT /F2 9 Tf 1 1 1 rg 50 ${y2 + 2} Td (${fw.label}  -  Average: ${Math.round(fwData.average)}/100) Tj ET`);
    y2 -= 22;

    for (const [cat, catScore] of categories) {
      if (y2 < 70) break;
      const cScore = Math.round(catScore as number);
      const catBarW = Math.round(280 * cScore / 100);

      p2.push(`BT /F1 8 Tf 0.2 0.25 0.3 rg 50 ${y2} Td (${s(cat, 30)}) Tj ET`);
      // Bar bg
      p2.push(`0.92 0.93 0.94 rg`, `200 ${y2 - 3} 280 12 re f`);
      // Bar fill
      p2.push(`${scoreColorPdf(cScore)} rg`, `200 ${y2 - 3} ${catBarW} 12 re f`);
      // Score label
      p2.push(`BT /F2 8 Tf ${scoreColorPdf(cScore)} rg 490 ${y2} Td (${cScore}) Tj ET`);
      y2 -= 18;
    }
    y2 -= 10;
  }

  addFooter(p2, 2);
  pages.push(p2);

  // ══════════════════════════════════════════════
  // PAGE 3+ — Compliance Findings Table
  // ══════════════════════════════════════════════
  if (findings.length > 0) {
    const findingsPerPage = 10;
    for (let pageIdx = 0; pageIdx < findings.length; pageIdx += findingsPerPage) {
      const pageFindings = findings.slice(pageIdx, pageIdx + findingsPerPage);
      const pf: string[] = [];
      pf.push(`1 1 1 rg`, `0 0 595 842 re f`);
      addHeader(pf, `Compliance Findings ${pageIdx > 0 ? '(continued)' : ''}`);

      let yf = 770;

      // Table header
      pf.push(`0.08 0.12 0.2 rg`, `30 ${yf - 2} 535 16 re f`);
      pf.push(`BT /F2 7 Tf 1 1 1 rg 35 ${yf + 2} Td (SEV) Tj ET`);
      pf.push(`BT /F2 7 Tf 1 1 1 rg 80 ${yf + 2} Td (CONTROL) Tj ET`);
      pf.push(`BT /F2 7 Tf 1 1 1 rg 155 ${yf + 2} Td (ISSUE) Tj ET`);
      pf.push(`BT /F2 7 Tf 1 1 1 rg 370 ${yf + 2} Td (NIST) Tj ET`);
      pf.push(`BT /F2 7 Tf 1 1 1 rg 430 ${yf + 2} Td (ISO) Tj ET`);
      pf.push(`BT /F2 7 Tf 1 1 1 rg 490 ${yf + 2} Td (GDPR) Tj ET`);
      yf -= 18;

      for (let fi = 0; fi < pageFindings.length; fi++) {
        const f = pageFindings[fi];
        if (yf < 100) break;

        const sevColor =
          f.severity === 'CRITICAL' ? '0.8 0.15 0.1' :
          f.severity === 'HIGH' ? '0.85 0.45 0' :
          f.severity === 'MEDIUM' ? '0.7 0.6 0' : '0.15 0.4 0.8';
        const sevBg =
          f.severity === 'CRITICAL' ? '1 0.92 0.92' :
          f.severity === 'HIGH' ? '1 0.95 0.9' :
          f.severity === 'MEDIUM' ? '1 0.98 0.9' : '0.9 0.95 1';

        const isAlt = fi % 2 === 0;
        if (isAlt) pf.push(`0.97 0.97 0.98 rg`, `30 ${yf - 3} 535 28 re f`);

        // Severity badge
        pf.push(`${sevBg} rg`, `35 ${yf - 1} 38 12 re f`);
        pf.push(`BT /F2 6 Tf ${sevColor} rg 37 ${yf + 2} Td (${f.severity}) Tj ET`);

        // Control key
        pf.push(`BT /F2 7 Tf 0.08 0.12 0.2 rg 80 ${yf + 2} Td (${s(f.control_key, 12)}) Tj ET`);
        // Issue detail
        pf.push(`BT /F1 6 Tf 0.2 0.25 0.3 rg 155 ${yf + 2} Td (${s(f.detail, 38)}) Tj ET`);
        // Framework mappings
        pf.push(`BT /F1 6 Tf 0.4 0.45 0.5 rg 370 ${yf + 2} Td (${s(f.nist_control, 10)}) Tj ET`);
        pf.push(`BT /F1 6 Tf 0.4 0.45 0.5 rg 430 ${yf + 2} Td (${s(f.iso_control, 10)}) Tj ET`);
        pf.push(`BT /F1 6 Tf 0.4 0.45 0.5 rg 490 ${yf + 2} Td (${s(f.gdpr_article, 10)}) Tj ET`);

        yf -= 14;

        // Remediation line
        if (f.remediation) {
          pf.push(`0.9 0.95 0.9 rg`, `40 ${yf - 3} 520 12 re f`);
          pf.push(`0.1 0.6 0.3 rg`, `40 ${yf - 3} 2 12 re f`);
          pf.push(`BT /F1 6 Tf 0.1 0.5 0.25 rg 48 ${yf} Td (Fix: ${s(f.remediation, 85)}) Tj ET`);
          yf -= 16;
        }
        yf -= 4;
      }

      addFooter(pf, pages.length + 1);
      pages.push(pf);
    }
  }

  // ══════════════════════════════════════════════
  // PAGE 4 — Technical Evidence Summary
  // ══════════════════════════════════════════════
  const p4: string[] = [];
  p4.push(`1 1 1 rg`, `0 0 595 842 re f`);
  addHeader(p4, 'Technical Evidence Summary');

  let y4 = 770;

  p4.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${y4} Td (TECHNICAL CHECK RESULTS) Tj ET`);
  p4.push(`0.85 0.15 0.1 rg`, `40 ${y4 - 4} 170 2 re f`);
  y4 -= 24;

  const checks = [
    {
      label: 'SSL / TLS Certificate',
      status: rawChecks.ssl?.valid ? 'PASS' : 'FAIL',
      detail: rawChecks.ssl
        ? `${rawChecks.ssl.valid ? 'Valid' : 'Invalid'}${rawChecks.ssl.issuer ? ' | Issuer: ' + s(rawChecks.ssl.issuer, 30) : ''}${rawChecks.ssl.days_until_expiry != null ? ' | Expires in ' + rawChecks.ssl.days_until_expiry + ' days' : ''}`
        : 'No SSL data',
    },
    {
      label: 'Website Uptime',
      status: rawChecks.uptime?.verdict === 'ONLINE' || rawChecks.uptime?.verdict === 'online' ? 'PASS' : rawChecks.uptime ? 'WARN' : 'N/A',
      detail: rawChecks.uptime?.verdict || 'No uptime data',
    },
    {
      label: 'Security Headers',
      status: rawChecks.headers?.grade
        ? (['A', 'B'].includes(rawChecks.headers.grade) ? 'PASS' : 'WARN')
        : 'N/A',
      detail: rawChecks.headers?.grade ? `Grade: ${rawChecks.headers.grade}` : 'No header data',
    },
    {
      label: 'DDoS Protection',
      status: rawChecks.ddos?.verdict === 'protected' ? 'PASS' : rawChecks.ddos ? 'WARN' : 'N/A',
      detail: rawChecks.ddos?.verdict || 'No DDoS data',
    },
    {
      label: 'DNS Security',
      status: (() => {
        const dns = rawChecks.dns?.results;
        if (!dns) return 'N/A';
        if (dns.spf?.present && dns.dmarc?.present && !dns.zone_transfer?.allowed) return 'PASS';
        return 'WARN';
      })(),
      detail: (() => {
        const dns = rawChecks.dns?.results;
        if (!dns) return 'No DNS data';
        const parts: string[] = [];
        if (dns.spf) parts.push(`SPF: ${dns.spf.present ? 'Yes' : 'No'}`);
        if (dns.dmarc) parts.push(`DMARC: ${dns.dmarc.present ? 'Yes' : 'No'}`);
        if (dns.zone_transfer) parts.push(`Zone Transfer: ${dns.zone_transfer.allowed ? 'Allowed' : 'Blocked'}`);
        return parts.join(' | ') || 'No DNS data';
      })(),
    },
  ];

  for (const chk of checks) {
    if (y4 < 100) break;
    const isPassed = chk.status === 'PASS';
    const isWarn = chk.status === 'WARN';
    const bg = isPassed ? '0.9 0.97 0.9' : isWarn ? '1 0.96 0.88' : '0.95 0.96 0.97';
    const statusColor = isPassed ? '0.1 0.6 0.3' : isWarn ? '0.85 0.45 0' : '0.5 0.5 0.5';
    const accent = isPassed ? '0.1 0.6 0.3' : isWarn ? '0.85 0.45 0' : '0.8 0.15 0.1';

    p4.push(`${bg} rg`, `40 ${y4 - 10} 515 32 re f`);
    p4.push(`${accent} rg`, `40 ${y4 - 10} 3 32 re f`);

    // Status badge
    const badgeBg = isPassed ? '0.85 0.96 0.85' : isWarn ? '1 0.93 0.85' : '1 0.9 0.9';
    p4.push(`${badgeBg} rg`, `50 ${y4 - 2} 40 14 re f`);
    p4.push(`BT /F2 7 Tf ${statusColor} rg 53 ${y4 + 1} Td (${chk.status}) Tj ET`);

    p4.push(`BT /F2 9 Tf 0.08 0.12 0.2 rg 100 ${y4 + 1} Td (${chk.label}) Tj ET`);
    p4.push(`BT /F1 7 Tf 0.3 0.35 0.4 rg 100 ${y4 - 10} Td (${s(chk.detail, 70)}) Tj ET`);
    y4 -= 40;
  }

  // General compliance recommendations
  y4 -= 15;
  if (y4 > 200) {
    p4.push(`BT /F2 11 Tf 0.08 0.12 0.2 rg 40 ${y4} Td (RECOMMENDATIONS) Tj ET`);
    p4.push(`0.85 0.15 0.1 rg`, `40 ${y4 - 4} 120 2 re f`);
    y4 -= 22;

    const recs = [
      'Review and remediate all CRITICAL and HIGH findings within 48 hours',
      'Implement continuous compliance monitoring with automated scanning',
      'Ensure SSL certificates are renewed before expiration',
      'Deploy SPF, DKIM, and DMARC records for email authentication',
      'Enable Web Application Firewall with OWASP Core Rule Set',
      'Conduct quarterly compliance assessments against NIST CSF and ISO 27001',
    ];

    for (const rec of recs) {
      if (y4 < 80) break;
      p4.push(`BT /F1 8 Tf 0.3 0.35 0.4 rg 50 ${y4} Td (${s(rec, 90)}) Tj ET`);
      y4 -= 14;
    }
  }

  addFooter(p4, pages.length + 1);
  pages.push(p4);

  // ══════════════════════════════════════════════
  // ASSEMBLE PDF
  // ══════════════════════════════════════════════
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
    const { results, org_name, target_url } = body;

    if (!results) {
      return new Response(JSON.stringify({ error: 'Missing compliance results' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const logoData = await fetchLogoPngData();
    const pdfBytes = generateCompliancePDF(results, org_name || 'Unknown', target_url || '', logoData);

    // Encode as base64
    const base64 = btoa(String.fromCharCode(...pdfBytes));

    return new Response(JSON.stringify({ pdf_base64: base64 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Compliance PDF generation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
