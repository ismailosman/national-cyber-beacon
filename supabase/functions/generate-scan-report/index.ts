import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ─── PDF text sanitizer ─── */
function s(text: string | null | undefined, maxLen = 90): string {
  return (text || '').replace(/[()\\]/g, ' ').substring(0, maxLen);
}

/* ─── Compute stats from scan result ─── */
function computeStats(result: any) {
  const nuclei = result.dast_results?.nuclei?.findings || [];
  const semgrep = result.sast_results?.semgrep?.findings || [];
  const zapAlerts = result.dast_results?.zap?.site?.[0]?.alerts || [];
  const niktoVulns = result.dast_results?.nikto?.vulnerabilities || [];

  const countSev = (sev: string) => {
    let c = 0;
    c += nuclei.filter((f: any) => (f.info?.severity || '').toLowerCase() === sev).length;
    c += semgrep.filter((f: any) => (f.extra?.severity || '').toLowerCase() === sev).length;
    c += zapAlerts.filter((a: any) => (a.riskdesc || '').toLowerCase().startsWith(sev)).length;
    return c;
  };

  const critical = countSev('critical');
  const high = countSev('high');
  const medium = countSev('medium');
  const low = countSev('low');
  const info = countSev('info') + countSev('informational');
  const total = critical + high + medium + low + info;
  const score = Math.max(0, Math.min(100, 100 - (critical * 25 + high * 10 + medium * 3 + low * 1)));

  return { critical, high, medium, low, info, total, score, nuclei, semgrep, zapAlerts, niktoVulns };
}

function getGrade(score: number) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/* ─── Build normalized findings ─── */
function normalizeFindings(result: any) {
  const findings: { tool: string; severity: string; name: string; description: string; location: string }[] = [];

  for (const f of (result.sast_results?.semgrep?.findings || [])) {
    findings.push({
      tool: 'Semgrep',
      severity: (f.extra?.severity || 'info').toUpperCase(),
      name: s(f.check_id?.split('.')?.slice(-1)[0] || 'Finding'),
      description: s(f.extra?.message || '', 70),
      location: s(`${f.path}:${f.start?.line}`, 40),
    });
  }

  for (const f of (result.dast_results?.nuclei?.findings || [])) {
    findings.push({
      tool: 'Nuclei',
      severity: (f.info?.severity || 'info').toUpperCase(),
      name: s(f.info?.name || 'Finding'),
      description: s(f.info?.description || '', 70),
      location: s(f.matched_at || '', 40),
    });
  }

  for (const a of (result.dast_results?.zap?.site?.[0]?.alerts || [])) {
    const risk = (a.riskdesc || '').split(' ')[0] || 'Info';
    findings.push({
      tool: 'ZAP',
      severity: risk.toUpperCase(),
      name: s(a.alert || 'Finding'),
      description: s(a.desc || '', 70),
      location: s(a.url || '', 40),
    });
  }

  for (const v of (result.dast_results?.nikto?.vulnerabilities || [])) {
    findings.push({
      tool: 'Nikto',
      severity: (v.severity || 'MEDIUM').toUpperCase(),
      name: s(v.id || 'Finding'),
      description: s(v.msg || v.message || '', 70),
      location: s(v.url || result.target || '', 40),
    });
  }

  // Sort by severity
  const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4, INFORMATIONAL: 4 };
  findings.sort((a, b) => (order[a.severity] ?? 5) - (order[b.severity] ?? 5));
  return findings;
}

/* ─── PDF Generator ─── */
function generatePDF(result: any): Uint8Array {
  const stats = computeStats(result);
  const grade = getGrade(stats.score);
  const findings = normalizeFindings(result);
  const now = new Date().toISOString().split('T')[0];
  const target = s(result.target || 'Unknown', 60);
  const scanType = (result.type || 'unknown').toUpperCase();
  const scanDate = new Date(result.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const scoreColor = stats.score >= 75 ? '0.2 0.8 0.4' : stats.score >= 50 ? '1 0.7 0' : '0.9 0.2 0.2';

  const pages: string[][] = [];

  // ── Page 1: Summary ──
  const p1: string[] = [];
  // Header bar
  p1.push(`0.05 0.07 0.1 rg`, `0 790 595 52 re f`);
  p1.push(`BT /F2 18 Tf 1 1 1 rg 40 810 Td (SECURITY SCAN REPORT) Tj ET`);
  p1.push(`BT /F1 10 Tf 1 1 1 rg 40 797 Td (CyberDefense Scanner | ${s(scanDate, 30)}) Tj ET`);

  // Background
  p1.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

  // Target info bar
  p1.push(`0.12 0.15 0.2 rg`, `30 710 535 70 re f`);
  p1.push(`BT /F2 14 Tf 0.9 0.95 1 rg 50 756 Td (Target: ${target}) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.6 0.7 0.8 rg 50 738 Td (Scan Type: ${scanType} | Scan ID: ${s(result.scan_id, 30)}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.6 0.7 0.8 rg 50 722 Td (Generated: ${now}) Tj ET`);

  // Score box
  p1.push(`${scoreColor} rg`, `460 720 105 60 re f`);
  p1.push(`BT /F2 32 Tf 0.05 0.07 0.1 rg 478 742 Td (${stats.score}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.05 0.07 0.1 rg 487 728 Td (/ 100) Tj ET`);
  p1.push(`BT /F2 10 Tf 0.05 0.07 0.1 rg 470 715 Td (Grade: ${grade}) Tj ET`);

  // Severity summary boxes
  const boxes = [
    { label: 'TOTAL', value: stats.total, color: '0.9 0.95 1' },
    { label: 'CRITICAL', value: stats.critical, color: '0.9 0.2 0.2' },
    { label: 'HIGH', value: stats.high, color: '1 0.5 0' },
    { label: 'MEDIUM', value: stats.medium, color: '0.9 0.8 0' },
    { label: 'LOW', value: stats.low, color: '0.2 0.5 1' },
  ];
  boxes.forEach((b, i) => {
    const bx = 50 + i * 100;
    p1.push(`0.12 0.15 0.2 rg`, `${bx} 650 90 45 re f`);
    p1.push(`BT /F2 20 Tf ${b.color} rg ${bx + 30} 670 Td (${b.value}) Tj ET`);
    p1.push(`BT /F1 7 Tf 0.6 0.7 0.8 rg ${bx + 20} 655 Td (${b.label}) Tj ET`);
  });

  // Scanner breakdown
  p1.push(`BT /F2 11 Tf 0 0.8 0.85 rg 50 630 Td (Scanner Breakdown) Tj ET`);
  const scanners = [
    { name: 'Semgrep  SAST ', count: stats.semgrep.length },
    { name: 'Nuclei  DAST ', count: stats.nuclei.length },
    { name: 'ZAP  DAST ', count: stats.zapAlerts.length },
    { name: 'Nikto  DAST ', count: stats.niktoVulns.length },
  ].filter(sc => sc.count > 0);

  let sy = 612;
  for (const sc of scanners) {
    p1.push(`0.12 0.15 0.2 rg`, `50 ${sy - 4} 480 18 re f`);
    p1.push(`BT /F1 9 Tf 0.9 0.95 1 rg 55 ${sy + 2} Td (${sc.name}) Tj ET`);
    p1.push(`BT /F2 9 Tf 0 0.8 0.85 rg 400 ${sy + 2} Td (${sc.count} findings) Tj ET`);
    // Bar
    const barW = Math.min(sc.count * 8, 300);
    p1.push(`0 0.6 0.7 rg`, `55 ${sy - 2} ${barW} 3 re f`);
    sy -= 22;
  }

  // Top findings preview
  const topFindings = findings.slice(0, 12);
  if (topFindings.length > 0) {
    p1.push(`BT /F2 11 Tf 0 0.8 0.85 rg 50 ${sy - 10} Td (Top Findings) Tj ET`);
    sy -= 28;

    // Table header
    p1.push(`0.12 0.15 0.2 rg`, `50 ${sy - 4} 480 18 re f`);
    p1.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 55 ${sy + 2} Td (SEVERITY) Tj ET`);
    p1.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 120 ${sy + 2} Td (TOOL) Tj ET`);
    p1.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 180 ${sy + 2} Td (FINDING) Tj ET`);
    p1.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 400 ${sy + 2} Td (LOCATION) Tj ET`);
    sy -= 18;

    for (const f of topFindings) {
      if (sy < 80) break;
      const sevColor =
        f.severity === 'CRITICAL' ? '0.9 0.2 0.2' :
        f.severity === 'HIGH' ? '1 0.5 0' :
        f.severity === 'MEDIUM' ? '0.9 0.8 0' :
        f.severity === 'LOW' ? '0.2 0.5 1' : '0.5 0.5 0.5';

      p1.push(`BT /F2 8 Tf ${sevColor} rg 55 ${sy + 2} Td (${f.severity}) Tj ET`);
      p1.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 120 ${sy + 2} Td (${f.tool}) Tj ET`);
      p1.push(`BT /F1 8 Tf 0.9 0.95 1 rg 180 ${sy + 2} Td (${s(f.name, 35)}) Tj ET`);
      p1.push(`BT /F1 7 Tf 0.5 0.6 0.7 rg 400 ${sy + 2} Td (${s(f.location, 25)}) Tj ET`);
      sy -= 14;
    }

    if (findings.length > 12) {
      p1.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 55 ${sy + 2} Td (... and ${findings.length - 12} more findings on next page) Tj ET`);
    }
  }

  // Footer
  p1.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
  p1.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (CyberDefense Scanner Report | ${now} | CONFIDENTIAL) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.5 0.6 0.7 rg 40 18 Td (This report contains sensitive security information. Handle with appropriate care.) Tj ET`);
  pages.push(p1);

  // ── Page 2+: Full findings ──
  if (findings.length > 12) {
    const remaining = findings.slice(12);
    let pageFindings: typeof remaining[] = [];
    for (let i = 0; i < remaining.length; i += 35) {
      pageFindings.push(remaining.slice(i, i + 35));
    }

    for (let pi = 0; pi < pageFindings.length; pi++) {
      const pf: string[] = [];
      pf.push(`0.05 0.07 0.1 rg`, `0 790 595 52 re f`);
      pf.push(`BT /F2 16 Tf 1 1 1 rg 40 810 Td (DETAILED FINDINGS) Tj ET`);
      pf.push(`BT /F1 10 Tf 1 1 1 rg 40 797 Td (${target} | Page ${pi + 2}) Tj ET`);
      pf.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

      let fy = 760;
      // Table header
      pf.push(`0.12 0.15 0.2 rg`, `50 ${fy - 4} 480 18 re f`);
      pf.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 55 ${fy + 2} Td (SEVERITY) Tj ET`);
      pf.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 120 ${fy + 2} Td (TOOL) Tj ET`);
      pf.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 180 ${fy + 2} Td (FINDING) Tj ET`);
      pf.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 400 ${fy + 2} Td (LOCATION) Tj ET`);
      fy -= 18;

      for (const f of pageFindings[pi]) {
        if (fy < 80) break;
        const sevColor =
          f.severity === 'CRITICAL' ? '0.9 0.2 0.2' :
          f.severity === 'HIGH' ? '1 0.5 0' :
          f.severity === 'MEDIUM' ? '0.9 0.8 0' :
          f.severity === 'LOW' ? '0.2 0.5 1' : '0.5 0.5 0.5';

        pf.push(`BT /F2 8 Tf ${sevColor} rg 55 ${fy + 2} Td (${f.severity}) Tj ET`);
        pf.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 120 ${fy + 2} Td (${f.tool}) Tj ET`);
        pf.push(`BT /F1 8 Tf 0.9 0.95 1 rg 180 ${fy + 2} Td (${s(f.name, 35)}) Tj ET`);
        pf.push(`BT /F1 7 Tf 0.5 0.6 0.7 rg 400 ${fy + 2} Td (${s(f.location, 25)}) Tj ET`);
        fy -= 14;
      }

      pf.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
      pf.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (CyberDefense Scanner Report | ${now} | Page ${pi + 2}) Tj ET`);
      pages.push(pf);
    }
  }

  // ── Assemble PDF ──
  const pageCount = pages.length;
  const objects: string[] = [];
  let nextObj = 1;

  // Obj 1: Catalog
  const catalogId = nextObj++;
  objects.push(`${catalogId} 0 obj\n<< /Type /Catalog /Pages ${catalogId + 1} 0 R >>\nendobj\n`);

  // Obj 2: Pages
  const pagesId = nextObj++;
  const pageIds: number[] = [];
  // Reserve page obj IDs
  const fontId1 = nextObj++;
  const fontId2 = nextObj++;

  for (let i = 0; i < pageCount; i++) pageIds.push(nextObj++);
  for (let i = 0; i < pageCount; i++) nextObj++; // stream objs

  objects.push(''); // placeholder for pages obj

  // Fonts
  objects.push(`${fontId1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);
  objects.push(`${fontId2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`);

  // Page + stream objects
  const streamIds: number[] = [];
  let sIdx = fontId2;
  for (let i = 0; i < pageCount; i++) {
    const streamId = pageIds[i] + pageCount;
    streamIds.push(streamId);
    const streamContent = pages[i].join('\n');

    objects.push(`${pageIds[i]} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${streamId} 0 R /Resources << /Font << /F1 ${fontId1} 0 R /F2 ${fontId2} 0 R >> >> >>\nendobj\n`);
    objects.push(`${streamId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`);
  }

  // Fill pages obj
  objects[1] = `${pagesId} 0 obj\n<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`;

  // Build PDF
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${offsets.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
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

    const pdfBytes = generatePDF(result);

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
