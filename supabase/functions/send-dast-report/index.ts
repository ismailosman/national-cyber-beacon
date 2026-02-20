import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

function generateDastPDF(data: {
  organizationName: string;
  url: string;
  dastScore: number;
  summary: any;
  results: any[];
}): Uint8Array {
  const { organizationName, url, dastScore, summary, results } = data;
  const grade = getGrade(dastScore);
  const now = new Date().toISOString().split("T")[0];
  const scoreColor = dastScore >= 75 ? "0.2 0.8 0.4" : dastScore >= 50 ? "1 0.7 0" : "0.9 0.2 0.2";
  const orgName = s(organizationName);

  const pages: string[][] = [];

  // ── Page 1: Executive Summary ──
  const p1: string[] = [];
  p1.push(`0.05 0.07 0.1 rg`, `0 790 595 52 re f`);
  p1.push(`BT /F2 18 Tf 1 1 1 rg 40 810 Td (DAST SECURITY SCAN REPORT) Tj ET`);
  p1.push(`BT /F1 10 Tf 1 1 1 rg 40 797 Td (Dynamic Application Security Testing) Tj ET`);

  // Background
  p1.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

  // Org info bar
  p1.push(`0.12 0.15 0.2 rg`, `30 700 535 80 re f`);
  p1.push(`BT /F2 16 Tf 0.9 0.95 1 rg 50 758 Td (${orgName}) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.6 0.7 0.8 rg 50 742 Td (${s(url, 70)}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.6 0.7 0.8 rg 50 726 Td (Scan Date: ${now}) Tj ET`);

  // Score box
  p1.push(`${scoreColor} rg`, `460 710 105 70 re f`);
  p1.push(`BT /F2 32 Tf 0.05 0.07 0.1 rg 478 738 Td (${dastScore}) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.05 0.07 0.1 rg 520 738 Td (/ 100) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.05 0.07 0.1 rg 470 722 Td (DAST SCORE) Tj ET`);
  p1.push(`BT /F2 10 Tf 0.05 0.07 0.1 rg 472 710 Td (Grade ${grade.grade} - ${grade.label}) Tj ET`);

  // Severity summary
  p1.push(`BT /F2 12 Tf ${scoreColor} rg 50 688 Td (Vulnerability Summary) Tj ET`);

  const crit = summary?.critical || 0;
  const high = summary?.high || 0;
  const med = summary?.medium || 0;
  const low = summary?.low || 0;
  const passed = summary?.passed || 0;

  // Summary boxes
  p1.push(`0.12 0.15 0.2 rg`);
  p1.push(`50 635 90 40 re f`, `150 635 90 40 re f`, `250 635 90 40 re f`, `350 635 90 40 re f`, `450 635 90 40 re f`);
  p1.push(`BT /F2 18 Tf 0.9 0.2 0.2 rg 80 653 Td (${crit}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.6 0.7 0.8 rg 68 640 Td (CRITICAL) Tj ET`);
  p1.push(`BT /F2 18 Tf 1 0.5 0 rg 180 653 Td (${high}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.6 0.7 0.8 rg 175 640 Td (HIGH) Tj ET`);
  p1.push(`BT /F2 18 Tf 1 0.8 0 rg 280 653 Td (${med}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.6 0.7 0.8 rg 270 640 Td (MEDIUM) Tj ET`);
  p1.push(`BT /F2 18 Tf 0.4 0.6 1 rg 380 653 Td (${low}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.6 0.7 0.8 rg 378 640 Td (LOW) Tj ET`);
  p1.push(`BT /F2 18 Tf 0.2 0.8 0.4 rg 480 653 Td (${passed}) Tj ET`);
  p1.push(`BT /F1 7 Tf 0.6 0.7 0.8 rg 472 640 Td (PASSED) Tj ET`);

  // Test results overview table
  p1.push(`BT /F2 12 Tf ${scoreColor} rg 50 610 Td (Test Module Results) Tj ET`);

  p1.push(`0.12 0.15 0.2 rg`, `50 586 480 18 re f`);
  p1.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 55 590 Td (TEST MODULE) Tj ET`);
  p1.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 280 590 Td (FINDINGS) Tj ET`);
  p1.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 340 590 Td (FAILED) Tj ET`);
  p1.push(`BT /F2 8 Tf 0.6 0.7 0.8 rg 400 590 Td (STATUS) Tj ET`);

  let y = 572;
  for (const test of (results || []).slice(0, 14)) {
    if (y < 100) break;
    const findings = test.findings || [];
    const fails = findings.filter((f: any) => f.status === "fail");
    const hasCrit = fails.some((f: any) => f.severity === "critical" || f.severity === "high");
    const statusText = fails.length === 0 ? "PASS" : hasCrit ? "FAIL" : "WARN";
    const stColor = statusText === "PASS" ? "0.2 0.8 0.4" : statusText === "FAIL" ? "0.9 0.2 0.2" : "1 0.7 0";

    if ((results.indexOf(test)) % 2 === 0) {
      p1.push(`0.1 0.13 0.17 rg`, `50 ${y - 4} 480 16 re f`);
    }
    p1.push(`BT /F1 8 Tf 0.9 0.95 1 rg 55 ${y} Td (${s(test.testName, 35)}) Tj ET`);
    p1.push(`BT /F1 8 Tf 0.7 0.8 0.9 rg 280 ${y} Td (${findings.length}) Tj ET`);
    p1.push(`BT /F1 8 Tf 0.9 0.4 0.2 rg 340 ${y} Td (${fails.length}) Tj ET`);
    p1.push(`BT /F2 8 Tf ${stColor} rg 400 ${y} Td (${statusText}) Tj ET`);
    y -= 16;
  }

  // Footer
  p1.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
  p1.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (CyberDefense DAST Report | ${now} | CONFIDENTIAL) Tj ET`);
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
    // Group into pages of ~20 findings
    const perPage = 20;
    for (let pageIdx = 0; pageIdx < Math.ceil(allFails.length / perPage); pageIdx++) {
      const p: string[] = [];
      p.push(`0.05 0.07 0.1 rg`, `0 790 595 52 re f`);
      p.push(`BT /F2 18 Tf 1 1 1 rg 40 810 Td (FAILED FINDINGS) Tj ET`);
      p.push(`BT /F1 10 Tf 1 1 1 rg 40 797 Td (${orgName} - ${s(url, 50)}) Tj ET`);
      p.push(`0.08 0.1 0.14 rg`, `30 60 535 720 re f`);

      // Table header
      p.push(`0.12 0.15 0.2 rg`, `50 758 480 18 re f`);
      p.push(`BT /F2 7 Tf 0.6 0.7 0.8 rg 55 762 Td (SEV) Tj ET`);
      p.push(`BT /F2 7 Tf 0.6 0.7 0.8 rg 95 762 Td (MODULE) Tj ET`);
      p.push(`BT /F2 7 Tf 0.6 0.7 0.8 rg 220 762 Td (FINDING) Tj ET`);
      p.push(`BT /F2 7 Tf 0.6 0.7 0.8 rg 400 762 Td (RECOMMENDATION) Tj ET`);

      let fy = 742;
      const chunk = allFails.slice(pageIdx * perPage, (pageIdx + 1) * perPage);

      for (let i = 0; i < chunk.length; i++) {
        if (fy < 80) break;
        const { testName, finding: f } = chunk[i];
        const sevColor = f.severity === "critical" ? "0.9 0.2 0.2" : f.severity === "high" ? "1 0.5 0" : f.severity === "medium" ? "1 0.8 0" : "0.4 0.6 1";

        if (i % 2 === 0) {
          p.push(`0.1 0.13 0.17 rg`, `50 ${fy - 6} 480 32 re f`);
        }

        p.push(`BT /F2 7 Tf ${sevColor} rg 55 ${fy} Td (${(f.severity || "").toUpperCase().substring(0, 4)}) Tj ET`);
        p.push(`BT /F1 7 Tf 0.9 0.95 1 rg 95 ${fy} Td (${s(testName, 20)}) Tj ET`);
        p.push(`BT /F1 7 Tf 0.7 0.8 0.9 rg 220 ${fy} Td (${s(f.test || f.detail, 30)}) Tj ET`);
        p.push(`BT /F1 6 Tf 0.5 0.8 0.85 rg 400 ${fy} Td (${s(f.recommendation || "", 25)}) Tj ET`);

        // Detail line
        fy -= 12;
        p.push(`BT /F1 6 Tf 0.5 0.6 0.7 rg 95 ${fy} Td (${s(f.detail, 80)}) Tj ET`);
        fy -= 20;
      }

      p.push(`0.15 0.19 0.25 rg`, `0 0 595 50 re f`);
      p.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 30 Td (Failed Findings | ${now} | Page ${pageIdx + 2}) Tj ET`);
      pages.push(p);
    }
  }

  // Build multi-page PDF
  const pageCount = pages.length;
  const fontObj1 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  const fontObj2 = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  const streams = pages.map((p) => new TextEncoder().encode(p.join("\n")));
  const baseObj = 5;
  const pageObjIds = pages.map((_, i) => baseObj + i * 2);
  const streamObjIds = pages.map((_, i) => baseObj + i * 2 + 1);
  const totalObjects = baseObj + pageCount * 2;

  let pdf = `%PDF-1.4\n`;
  pdf += `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  pdf += `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>\nendobj\n`;
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
    pdf += `${String(i * 100).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organizationName, url, dastScore, summary, results } = await req.json();
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const grade = getGrade(dastScore);
    const scanDate = new Date().toISOString().split("T")[0];

    // Generate PDF
    const pdfBytes = generateDastPDF({ organizationName, url, dastScore, summary, results });
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);

    // Brief HTML summary email body
    const scoreColor = dastScore >= 75 ? "#22c55e" : dastScore >= 50 ? "#eab308" : "#dc2626";
    const html = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#0f1729;color:#e2e8f0;padding:32px;border-radius:8px">
  <h1 style="color:#22d3ee;margin:0 0 16px">🛡️ DAST Scan Report</h1>
  <table style="width:100%;margin-bottom:20px">
    <tr>
      <td style="padding:12px;background:#1e293b;border-radius:8px 0 0 8px">
        <div style="font-size:12px;color:#94a3b8">Organization</div>
        <div style="font-size:16px;font-weight:bold;margin-top:4px">${organizationName}</div>
      </td>
      <td style="padding:12px;background:#1e293b">
        <div style="font-size:12px;color:#94a3b8">URL</div>
        <div style="font-size:14px;margin-top:4px">${url}</div>
      </td>
      <td style="padding:12px;background:#1e293b;text-align:center;border-radius:0 8px 8px 0">
        <div style="font-size:12px;color:#94a3b8">DAST Score</div>
        <div style="font-size:28px;font-weight:bold;color:${scoreColor}">${dastScore}/100</div>
        <div style="font-size:12px;color:${scoreColor}">Grade ${grade.grade} — ${grade.label}</div>
      </td>
    </tr>
  </table>
  <table style="width:100%;margin-bottom:20px;text-align:center">
    <tr>
      <td style="padding:10px;background:#1e293b;border-radius:8px 0 0 8px"><div style="font-size:11px;color:#94a3b8">CRITICAL</div><div style="font-size:22px;font-weight:bold;color:#dc2626">${summary?.critical || 0}</div></td>
      <td style="padding:10px;background:#1e293b"><div style="font-size:11px;color:#94a3b8">HIGH</div><div style="font-size:22px;font-weight:bold;color:#f97316">${summary?.high || 0}</div></td>
      <td style="padding:10px;background:#1e293b"><div style="font-size:11px;color:#94a3b8">MEDIUM</div><div style="font-size:22px;font-weight:bold;color:#eab308">${summary?.medium || 0}</div></td>
      <td style="padding:10px;background:#1e293b"><div style="font-size:11px;color:#94a3b8">LOW</div><div style="font-size:22px;font-weight:bold;color:#3b82f6">${summary?.low || 0}</div></td>
      <td style="padding:10px;background:#1e293b;border-radius:0 8px 8px 0"><div style="font-size:11px;color:#94a3b8">PASSED</div><div style="font-size:22px;font-weight:bold;color:#22c55e">${summary?.passed || 0}</div></td>
    </tr>
  </table>
  <p style="color:#94a3b8;font-size:13px">📎 The full DAST report with detailed findings is attached as a PDF.</p>
  <p style="color:#64748b;font-size:11px;margin:20px 0 0;border-top:1px solid #333;padding-top:12px">Generated by CyberDefense DAST Scanner · ${scanDate}</p>
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
        to: ["osmando@gmail.com"],
        subject: `DAST Report: ${organizationName} — Score ${dastScore}/100 (Grade ${grade.grade})`,
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
