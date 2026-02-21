import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchLogoPngData } from "../_shared/logoUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getGrade = (score: number) => {
  if (score >= 90) return { grade: "A", label: "Excellent" };
  if (score >= 75) return { grade: "B", label: "Good" };
  if (score >= 60) return { grade: "C", label: "Fair" };
  if (score >= 40) return { grade: "D", label: "Needs Work" };
  return { grade: "F", label: "Critical" };
};

function s(text: string | null | undefined, maxLen = 90): string {
  return (text || "").replace(/[()\\]/g, " ").substring(0, maxLen);
}

function getRiskLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Low", color: "0.2 0.7 0.3" };
  if (score >= 75) return { label: "Medium", color: "0.9 0.7 0.1" };
  if (score >= 50) return { label: "High", color: "0.9 0.5 0.1" };
  return { label: "Critical", color: "0.8 0.15 0.15" };
}

function buildLogoXObject(logoData: { width: number; height: number; rgbHex: string }, objId: number): string {
  const { width, height, rgbHex } = logoData;
  return `${objId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${rgbHex.length} /Filter /ASCIIHexDecode >>\nstream\n${rgbHex}>\nendstream\nendobj\n`;
}

function generateDastPDF(data: {
  organizationName: string;
  url: string;
  dastScore: number;
  summary: any;
  results: any[];
  logoData: { width: number; height: number; rgbHex: string } | null;
}): Uint8Array {
  const { organizationName, url, dastScore, summary, results, logoData } = data;
  const grade = getGrade(dastScore);
  const risk = getRiskLabel(dastScore);
  const now = new Date().toISOString().split("T")[0];
  const timeStr = new Date().toISOString().split("T")[1]?.substring(0, 5) || "00:00";
  const orgName = s(organizationName);

  const crit = summary?.critical || 0;
  const high = summary?.high || 0;
  const med = summary?.medium || 0;
  const low = summary?.low || 0;
  const passed = summary?.passed || 0;
  const totalFindings = summary?.totalFindings || 0;
  const totalFailed = crit + high + med + low;

  const hasLogo = !!logoData;
  // Text x-offset: shift right if logo present
  const tx = hasLogo ? 72 : 30;

  const pages: string[][] = [];

  // ── Page 1: Executive Summary ──
  const p1: string[] = [];
  p1.push(`1 1 1 rg`, `0 0 595 842 re f`);

  // Top header bar - dark navy
  p1.push(`0.08 0.12 0.2 rg`, `0 790 595 52 re f`);
  p1.push(`0.8 0.15 0.15 rg`, `0 788 595 3 re f`);

  // Logo
  if (hasLogo) {
    p1.push(`q 36 0 0 36 30 798 cm /Logo Do Q`);
  }

  // Branding text
  p1.push(`BT /F2 16 Tf 1 1 1 rg ${tx} 810 Td (SOMALIA CYBER DEFENCE) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.8 0.85 0.9 rg ${tx} 798 Td (National Cybersecurity Authority) Tj ET`);
  p1.push(`BT /F2 11 Tf 1 1 1 rg 400 810 Td (DAST Scan Report) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.8 0.85 0.9 rg 400 798 Td (Detailed Security Assessment) Tj ET`);

  // Info section
  p1.push(`0.95 0.96 0.97 rg`, `30 720 535 60 re f`);
  p1.push(`0.85 0.87 0.9 rg`, `30 720 535 0.5 re f`);
  p1.push(`BT /F2 9 Tf 0.3 0.3 0.35 rg 40 762 Td (TARGET) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.15 0.15 0.2 rg 40 750 Td (${s(url, 60)}) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.3 0.3 0.35 rg 40 736 Td (Organization: ${orgName}) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.3 0.3 0.35 rg 350 762 Td (SCAN DATE) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.15 0.15 0.2 rg 350 750 Td (${now} ${timeStr} UTC) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.3 0.3 0.35 rg 350 736 Td (Grade: ${grade.grade} - ${grade.label}) Tj ET`);

  // Risk Level box
  p1.push(`${risk.color} rg`, `470 726 90 40 re f`);
  p1.push(`BT /F2 10 Tf 1 1 1 rg 480 750 Td (RISK LEVEL) Tj ET`);
  p1.push(`BT /F2 14 Tf 1 1 1 rg 485 732 Td (${risk.label}) Tj ET`);

  // Score section
  p1.push(`BT /F2 12 Tf 0.15 0.15 0.2 rg 30 700 Td (Security Score) Tj ET`);
  p1.push(`0.95 0.96 0.97 rg`, `30 640 120 50 re f`);
  const scoreColor = dastScore >= 75 ? "0.2 0.7 0.3" : dastScore >= 50 ? "0.9 0.7 0.1" : "0.8 0.15 0.15";
  p1.push(`BT /F2 28 Tf ${scoreColor} rg 50 655 Td (${dastScore}) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.4 0.4 0.45 rg 95 655 Td (/100) Tj ET`);

  // Vulnerability summary boxes
  p1.push(`BT /F2 12 Tf 0.15 0.15 0.2 rg 30 625 Td (Vulnerability Summary) Tj ET`);

  p1.push(`0.93 0.94 0.96 rg`, `30 575 120 40 re f`);
  p1.push(`BT /F2 20 Tf 0.2 0.25 0.4 rg 55 590 Td (${totalFindings}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.4 0.4 0.5 rg 40 578 Td (IDENTIFIED) Tj ET`);

  p1.push(`0.93 0.94 0.96 rg`, `160 575 120 40 re f`);
  p1.push(`BT /F2 20 Tf 0.8 0.15 0.15 rg 190 590 Td (${totalFailed}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.4 0.4 0.5 rg 175 578 Td (FAILED) Tj ET`);

  p1.push(`0.93 0.94 0.96 rg`, `290 575 120 40 re f`);
  p1.push(`BT /F2 20 Tf 0.2 0.7 0.3 rg 315 590 Td (${passed}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.4 0.4 0.5 rg 300 578 Td (PASSED) Tj ET`);

  p1.push(`0.93 0.94 0.96 rg`, `420 575 140 40 re f`);
  p1.push(`BT /F2 20 Tf ${scoreColor} rg 455 590 Td (${grade.grade}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.4 0.4 0.5 rg 435 578 Td (GRADE) Tj ET`);

  // Severity breakdown
  p1.push(`BT /F2 11 Tf 0.15 0.15 0.2 rg 30 550 Td (Severity Breakdown) Tj ET`);
  const sevBoxes = [
    { label: "CRITICAL", count: crit, color: "0.8 0.15 0.15", bg: "0.95 0.9 0.9" },
    { label: "HIGH", count: high, color: "0.9 0.45 0.1", bg: "0.97 0.93 0.88" },
    { label: "MEDIUM", count: med, color: "0.85 0.7 0.1", bg: "0.97 0.96 0.88" },
    { label: "LOW", count: low, color: "0.3 0.5 0.85", bg: "0.9 0.93 0.97" },
  ];
  let bx = 30;
  for (const sev of sevBoxes) {
    p1.push(`${sev.color} rg`, `${bx} 510 4 30 re f`);
    p1.push(`${sev.bg} rg`, `${bx + 4} 510 126 30 re f`);
    p1.push(`BT /F2 16 Tf ${sev.color} rg ${bx + 50} 522 Td (${sev.count}) Tj ET`);
    p1.push(`BT /F1 7 Tf 0.4 0.4 0.5 rg ${bx + 15} 514 Td (${sev.label}) Tj ET`);
    bx += 135;
  }

  // Test results table
  p1.push(`BT /F2 11 Tf 0.15 0.15 0.2 rg 30 490 Td (Test Module Results) Tj ET`);
  p1.push(`0.08 0.12 0.2 rg`, `30 468 535 18 re f`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 35 472 Td (TEST MODULE) Tj ET`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 280 472 Td (FINDINGS) Tj ET`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 340 472 Td (FAILED) Tj ET`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 400 472 Td (STATUS) Tj ET`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 480 472 Td (SEVERITY) Tj ET`);

  let y = 454;
  for (const test of (results || []).slice(0, 16)) {
    if (y < 80) break;
    const findings = test.findings || [];
    const fails = findings.filter((f: any) => f.status === "fail");
    const hasCrit = fails.some((f: any) => f.severity === "critical" || f.severity === "high");
    const statusText = fails.length === 0 ? "PASS" : hasCrit ? "FAIL" : "WARN";
    const stColor = statusText === "PASS" ? "0.2 0.7 0.3" : statusText === "FAIL" ? "0.8 0.15 0.15" : "0.85 0.7 0.1";

    if (results.indexOf(test) % 2 === 0) {
      p1.push(`0.96 0.97 0.98 rg`, `30 ${y - 4} 535 16 re f`);
    }
    p1.push(`BT /F1 8 Tf 0.15 0.15 0.2 rg 35 ${y} Td (${s(test.testName, 40)}) Tj ET`);
    p1.push(`BT /F1 8 Tf 0.3 0.3 0.4 rg 290 ${y} Td (${findings.length}) Tj ET`);
    p1.push(`BT /F1 8 Tf 0.8 0.15 0.15 rg 350 ${y} Td (${fails.length}) Tj ET`);
    p1.push(`BT /F2 8 Tf ${stColor} rg 405 ${y} Td (${statusText}) Tj ET`);

    const maxSev = fails.some((f: any) => f.severity === "critical") ? "CRITICAL" :
      fails.some((f: any) => f.severity === "high") ? "HIGH" :
      fails.some((f: any) => f.severity === "medium") ? "MEDIUM" :
      fails.length > 0 ? "LOW" : "-";
    const mColor = maxSev === "CRITICAL" ? "0.8 0.15 0.15" : maxSev === "HIGH" ? "0.9 0.45 0.1" : maxSev === "MEDIUM" ? "0.85 0.7 0.1" : "0.3 0.5 0.85";
    p1.push(`BT /F1 7 Tf ${mColor} rg 482 ${y} Td (${maxSev}) Tj ET`);
    y -= 16;
  }

  // Footer
  p1.push(`0.08 0.12 0.2 rg`, `0 0 595 40 re f`);
  p1.push(`0.8 0.15 0.15 rg`, `0 40 595 2 re f`);
  p1.push(`BT /F1 7 Tf 0.7 0.75 0.8 rg 30 18 Td (Somalia Cyber Defence DAST Report | ${now} | CONFIDENTIAL | Page 1) Tj ET`);
  pages.push(p1);

  // ── Page 2+: Failed Findings Detail ──
  const allFails: { testName: string; finding: any }[] = [];
  for (const test of (results || [])) {
    for (const f of (test.findings || [])) {
      if (f.status === "fail") {
        allFails.push({ testName: test.testName, finding: f });
      }
    }
  }

  if (allFails.length > 0) {
    const perPage = 18;
    for (let pageIdx = 0; pageIdx < Math.ceil(allFails.length / perPage); pageIdx++) {
      const p: string[] = [];
      p.push(`1 1 1 rg`, `0 0 595 842 re f`);

      // Header bar
      p.push(`0.08 0.12 0.2 rg`, `0 790 595 52 re f`);
      p.push(`0.8 0.15 0.15 rg`, `0 788 595 3 re f`);
      if (hasLogo) {
        p.push(`q 36 0 0 36 30 798 cm /Logo Do Q`);
      }
      p.push(`BT /F2 14 Tf 1 1 1 rg ${tx} 810 Td (SOMALIA CYBER DEFENCE) Tj ET`);
      p.push(`BT /F1 9 Tf 0.8 0.85 0.9 rg ${tx} 798 Td (Failed Findings Detail) Tj ET`);
      p.push(`BT /F1 8 Tf 0.8 0.85 0.9 rg 400 810 Td (${orgName}) Tj ET`);
      p.push(`BT /F1 8 Tf 0.8 0.85 0.9 rg 400 798 Td (${s(url, 30)}) Tj ET`);

      // Table header
      p.push(`0.08 0.12 0.2 rg`, `30 760 535 18 re f`);
      p.push(`BT /F2 7 Tf 1 1 1 rg 35 764 Td (SEV) Tj ET`);
      p.push(`BT /F2 7 Tf 1 1 1 rg 80 764 Td (MODULE) Tj ET`);
      p.push(`BT /F2 7 Tf 1 1 1 rg 200 764 Td (FINDING) Tj ET`);
      p.push(`BT /F2 7 Tf 1 1 1 rg 380 764 Td (RECOMMENDATION) Tj ET`);

      let fy = 744;
      const chunk = allFails.slice(pageIdx * perPage, (pageIdx + 1) * perPage);

      for (let i = 0; i < chunk.length; i++) {
        if (fy < 60) break;
        const { testName, finding: f } = chunk[i];
        const sevText = (f.severity || "").toUpperCase().substring(0, 4);
        const sevColor = f.severity === "critical" ? "0.8 0.15 0.15" : f.severity === "high" ? "0.9 0.45 0.1" : f.severity === "medium" ? "0.85 0.7 0.1" : "0.3 0.5 0.85";

        if (i % 2 === 0) {
          p.push(`0.96 0.97 0.98 rg`, `30 ${fy - 8} 535 34 re f`);
        }
        p.push(`${sevColor} rg`, `35 ${fy - 2} 35 12 re f`);
        p.push(`BT /F2 6 Tf 1 1 1 rg 38 ${fy} Td (${sevText}) Tj ET`);
        p.push(`BT /F1 7 Tf 0.15 0.15 0.2 rg 80 ${fy} Td (${s(testName, 18)}) Tj ET`);
        p.push(`BT /F1 7 Tf 0.25 0.25 0.3 rg 200 ${fy} Td (${s(f.test || f.detail, 28)}) Tj ET`);
        p.push(`BT /F1 6 Tf 0.3 0.5 0.6 rg 380 ${fy} Td (${s(f.recommendation || "", 28)}) Tj ET`);

        fy -= 12;
        p.push(`BT /F1 6 Tf 0.4 0.4 0.5 rg 80 ${fy} Td (${s(f.detail, 75)}) Tj ET`);
        fy -= 22;
      }

      // Footer
      p.push(`0.08 0.12 0.2 rg`, `0 0 595 40 re f`);
      p.push(`0.8 0.15 0.15 rg`, `0 40 595 2 re f`);
      p.push(`BT /F1 7 Tf 0.7 0.75 0.8 rg 30 18 Td (Somalia Cyber Defence DAST Report | ${now} | CONFIDENTIAL | Page ${pageIdx + 2}) Tj ET`);
      pages.push(p);
    }
  }

  // Build multi-page PDF
  const pageCount = pages.length;
  const fontObj1 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  const fontObj2 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  const streams = pages.map((p) => new TextEncoder().encode(p.join("\n")));

  // Object layout: 1=catalog, 2=pages, 3=font1, 4=font2, 5=logo (if present), then page+stream pairs
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
  addObj(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>\nendobj\n`);
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
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationName, url, dastScore, summary, results, to } = await req.json();
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientEmail = to || "osmando@gmail.com";
    const grade = getGrade(dastScore);
    const scanDate = new Date().toISOString().split("T")[0];

    // Fetch logo for PDF
    const logoData = await fetchLogoPngData();

    // Generate PDF
    const pdfBytes = generateDastPDF({ organizationName, url, dastScore, summary, results, logoData });
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);

    // White background email HTML
    const scoreColor = dastScore >= 75 ? "#22c55e" : dastScore >= 50 ? "#eab308" : "#dc2626";
    const logoUrl = "https://awdysfgjmhnqwsoyhbah.supabase.co/storage/v1/object/public/media/logo.png";
    const html = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#ffffff;color:#1e293b;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <!-- Header -->
  <div style="background:#0d1520;padding:20px 30px;border-bottom:3px solid #cc2626">
    <table style="width:100%"><tr>
      <td style="vertical-align:middle"><img src="${logoUrl}" alt="Logo" width="40" height="40" style="display:block;border-radius:4px" /></td>
      <td style="vertical-align:middle;padding-left:12px">
        <div style="color:#ffffff;font-size:18px;font-weight:bold;margin:0">SOMALIA CYBER DEFENCE</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:2px">DAST Security Scan Report</div>
      </td>
      <td style="vertical-align:middle;text-align:right">
        <div style="color:#94a3b8;font-size:11px">${scanDate}</div>
      </td>
    </tr></table>
  </div>

  <div style="padding:24px 30px">
    <!-- Info Cards -->
    <table style="width:100%;margin-bottom:20px;border-collapse:collapse">
      <tr>
        <td style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 0 0 8px;width:40%">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Organization</div>
          <div style="font-size:16px;font-weight:bold;color:#0f172a;margin-top:4px">${organizationName}</div>
          <div style="font-size:13px;color:#475569;margin-top:2px">${url}</div>
        </td>
        <td style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;width:30%">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Security Score</div>
          <div style="font-size:36px;font-weight:bold;color:${scoreColor};margin-top:4px">${dastScore}</div>
          <div style="font-size:12px;color:#475569">/100</div>
        </td>
        <td style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;border-radius:0 8px 8px 0;width:30%">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Grade</div>
          <div style="font-size:36px;font-weight:bold;color:${scoreColor};margin-top:4px">${grade.grade}</div>
          <div style="font-size:12px;color:#475569">${grade.label}</div>
        </td>
      </tr>
    </table>

    <!-- Severity Summary -->
    <div style="font-size:13px;font-weight:bold;color:#0f172a;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">Vulnerability Summary</div>
    <table style="width:100%;margin-bottom:24px;text-align:center;border-collapse:collapse">
      <tr>
        <td style="padding:12px 8px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px 0 0 8px">
          <div style="font-size:10px;color:#991b1b;text-transform:uppercase;font-weight:bold">Critical</div>
          <div style="font-size:24px;font-weight:bold;color:#dc2626">${summary?.critical || 0}</div>
        </td>
        <td style="padding:12px 8px;background:#fff7ed;border:1px solid #fed7aa">
          <div style="font-size:10px;color:#9a3412;text-transform:uppercase;font-weight:bold">High</div>
          <div style="font-size:24px;font-weight:bold;color:#f97316">${summary?.high || 0}</div>
        </td>
        <td style="padding:12px 8px;background:#fefce8;border:1px solid #fef08a">
          <div style="font-size:10px;color:#854d0e;text-transform:uppercase;font-weight:bold">Medium</div>
          <div style="font-size:24px;font-weight:bold;color:#eab308">${summary?.medium || 0}</div>
        </td>
        <td style="padding:12px 8px;background:#eff6ff;border:1px solid #bfdbfe">
          <div style="font-size:10px;color:#1e40af;text-transform:uppercase;font-weight:bold">Low</div>
          <div style="font-size:24px;font-weight:bold;color:#3b82f6">${summary?.low || 0}</div>
        </td>
        <td style="padding:12px 8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0 8px 8px 0">
          <div style="font-size:10px;color:#166534;text-transform:uppercase;font-weight:bold">Passed</div>
          <div style="font-size:24px;font-weight:bold;color:#22c55e">${summary?.passed || 0}</div>
        </td>
      </tr>
    </table>

    <p style="color:#475569;font-size:13px;line-height:1.6;margin:0">The full DAST report with detailed findings and recommendations is attached as a PDF document.</p>
  </div>

  <!-- Footer -->
  <div style="padding:16px 30px;border-top:1px solid #e2e8f0;background:#f8fafc">
    <p style="color:#94a3b8;font-size:11px;margin:0">Somalia Cyber Defence &bull; DAST Scanner &bull; ${scanDate} &bull; CONFIDENTIAL</p>
  </div>
</div>`;

    const safeOrgName = organizationName.replace(/[^a-zA-Z0-9-_]/g, "-");
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "noreply@cyberdefense.so",
        to: [recipientEmail],
        subject: `DAST Report: ${organizationName} - Score ${dastScore}/100 (Grade ${grade.grade})`,
        html,
        attachments: [
          {
            filename: `DAST-Report-${safeOrgName}-${scanDate}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    const emailResult = await emailRes.json();
    console.log("Resend result:", JSON.stringify(emailResult));

    return new Response(JSON.stringify({ success: emailRes.ok, emailResult, pdf: pdfBase64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-dast-report error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
