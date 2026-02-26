import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchLogoPngData } from "../_shared/logoUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

interface SourceConfig {
  key: string;
  label: string;
}

const sourceConfigs: SourceConfig[] = [
  { key: "ransomware", label: "Ransomware" },
  { key: "hibp", label: "Credential Leaks (HIBP)" },
  { key: "pastes", label: "Paste Sites" },
  { key: "ahmia", label: "Dark Web (Ahmia)" },
  { key: "intelx", label: "Intel Database" },
  { key: "github", label: "GitHub Exposures" },
  { key: "pwned_passwords", label: "Pwned Passwords" },
  { key: "breach_directory", label: "Breach Directory" },
  { key: "scylla", label: "Scylla Database" },
  { key: "leakcheck", label: "LeakCheck" },
];

const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
function sortBySeverity(a: any, b: any) {
  return (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3);
}

function sevColor(sev: string): string {
  if (sev === "CRITICAL") return "0.8 0.15 0.15";
  if (sev === "HIGH") return "0.9 0.45 0.1";
  return "0.85 0.7 0.1";
}

function sevBgColor(sev: string): string {
  if (sev === "CRITICAL") return "0.95 0.9 0.9";
  if (sev === "HIGH") return "0.97 0.93 0.88";
  return "0.97 0.96 0.88";
}

// ── LeakCheck PDF pages builder ──
function buildLeakCheckPages(
  leakcheckFindings: any[],
  domain: string,
  hasLogo: boolean,
  startPageNum: number
): string[][] {
  const tx = hasLogo ? 72 : 30;
  const groups = [
    { label: "DOMAIN BREACHES", type: "domain_breach" },
    { label: "EMAIL BREACHES", type: "email_breach" },
    { label: "KEYWORD MENTIONS", type: "keyword_mention" },
  ];

  const pages: string[][] = [];
  let p: string[] = [];
  let y = 0;
  let pageNum = startPageNum;

  function newPage() {
    if (p.length > 0) {
      // close previous page footer
      p.push(`0.08 0.12 0.2 rg`, `0 0 595 40 re f`);
      p.push(`0.8 0.15 0.15 rg`, `0 40 595 2 re f`);
      const now = new Date().toISOString().split("T")[0];
      p.push(`BT /F1 7 Tf 0.7 0.75 0.8 rg 30 18 Td (Somalia Cyber Defence Dark Web Report | ${now} | CONFIDENTIAL | Page ${pageNum}) Tj ET`);
      pages.push(p);
      pageNum++;
    }
    p = [];
    p.push(`1 1 1 rg`, `0 0 595 842 re f`);
    p.push(`0.08 0.12 0.2 rg`, `0 790 595 52 re f`);
    p.push(`0.8 0.15 0.15 rg`, `0 788 595 3 re f`);
    if (hasLogo) p.push(`q 36 0 0 36 30 798 cm /Logo Do Q`);
    p.push(`BT /F2 14 Tf 1 1 1 rg ${tx} 810 Td (SOMALIA CYBER DEFENCE) Tj ET`);
    p.push(`BT /F1 9 Tf 0.8 0.85 0.9 rg ${tx} 798 Td (LeakCheck Pro Intelligence) Tj ET`);
    p.push(`BT /F1 8 Tf 0.8 0.85 0.9 rg 400 810 Td (${s(domain, 30)}) Tj ET`);
    y = 760;
  }

  newPage();

  for (const group of groups) {
    const items = leakcheckFindings
      .filter((f: any) => f.type === group.type)
      .sort(sortBySeverity);

    // Need space for group header
    if (y < 120) newPage();

    // Group header
    p.push(`0.08 0.12 0.2 rg`, `30 ${y} 535 20 re f`);
    p.push(`BT /F2 9 Tf 1 1 1 rg 40 ${y + 5} Td (${group.label}  -  ${items.length} found) Tj ET`);
    y -= 28;

    if (items.length === 0) {
      p.push(`BT /F1 8 Tf 0.2 0.7 0.3 rg 40 ${y + 4} Td (No findings in this category) Tj ET`);
      y -= 24;
      continue;
    }

    for (const f of items) {
      // Each finding card needs ~60px
      if (y < 100) newPage();

      const sc = sevColor(f.severity || "MEDIUM");
      const bg = sevBgColor(f.severity || "MEDIUM");

      // Left border + bg
      p.push(`${sc} rg`, `30 ${y - 42} 4 50 re f`);
      p.push(`${bg} rg`, `34 ${y - 42} 531 50 re f`);

      // Severity badge
      p.push(`${sc} rg`, `40 ${y - 2} 50 12 re f`);
      p.push(`BT /F2 7 Tf 1 1 1 rg 44 ${y + 1} Td (${s(f.severity || "MEDIUM", 10)}) Tj ET`);

      // Breach name + date
      p.push(`BT /F2 9 Tf 0.15 0.15 0.2 rg 96 ${y + 1} Td (${s(f.breach_name, 35)}) Tj ET`);
      if (f.breach_date) {
        p.push(`BT /F1 8 Tf 0.5 0.5 0.55 rg 320 ${y + 1} Td (${s(f.breach_date, 12)}) Tj ET`);
      }

      // Email / Username row
      let infoY = y - 14;
      const infoParts: string[] = [];
      if (f.email) infoParts.push(`Email: ${s(f.email, 35)}`);
      if (f.username) infoParts.push(`User: ${s(f.username, 20)}`);
      if (infoParts.length > 0) {
        p.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 44 ${infoY} Td (${infoParts.join("   |   ")}) Tj ET`);
      }

      // Password exposed badge
      if (f.has_password) {
        p.push(`0.8 0.15 0.15 rg`, `340 ${infoY - 3} 100 12 re f`);
        p.push(`BT /F2 7 Tf 1 1 1 rg 346 ${infoY} Td (PASSWORD EXPOSED) Tj ET`);
      }

      // Fields row
      infoY -= 14;
      if (f.fields && Array.isArray(f.fields) && f.fields.length > 0) {
        const fieldsStr = f.fields.slice(0, 8).join(", ");
        p.push(`BT /F1 6 Tf 0.4 0.4 0.5 rg 44 ${infoY} Td (Fields: ${s(fieldsStr, 70)}) Tj ET`);
      }

      y -= 60;
    }
    y -= 8; // gap between groups
  }

  // Close last page
  if (p.length > 0) {
    p.push(`0.08 0.12 0.2 rg`, `0 0 595 40 re f`);
    p.push(`0.8 0.15 0.15 rg`, `0 40 595 2 re f`);
    const now = new Date().toISOString().split("T")[0];
    p.push(`BT /F1 7 Tf 0.7 0.75 0.8 rg 30 18 Td (Somalia Cyber Defence Dark Web Report | ${now} | CONFIDENTIAL | Page ${pageNum}) Tj ET`);
    pages.push(p);
  }

  return pages;
}

function generateDarkWebPDF(data: {
  domain: string;
  scanId: string;
  summary: any;
  results: any;
  logoData: { width: number; height: number; rgbHex: string } | null;
}): Uint8Array {
  const { domain, scanId, summary, results, logoData } = data;

  // ── Augment counts with leakcheck + cavalier ──
  const baseCrit = summary?.critical || 0;
  const baseHigh = summary?.high || 0;
  const baseMed = summary?.medium || 0;
  const baseTotal = summary?.total_findings || 0;

  const leakcheckFindings: any[] = results?.leakcheck?.findings || [];
  const cavalierFindings: any[] = results?.cavalier?.findings || [];

  let lcCrit = 0, lcHigh = 0, lcMed = 0;
  for (const f of leakcheckFindings) {
    if (f.severity === "CRITICAL") lcCrit++;
    else if (f.severity === "HIGH") lcHigh++;
    else lcMed++;
  }
  let cavCrit = 0, cavHigh = 0, cavMed = 0;
  for (const f of cavalierFindings) {
    if (f.severity === "CRITICAL") cavCrit++;
    else if (f.severity === "HIGH") cavHigh++;
    else cavMed++;
  }

  const crit = baseCrit + lcCrit + cavCrit;
  const high = baseHigh + lcHigh + cavHigh;
  const med = baseMed + lcMed + cavMed;
  const total = baseTotal + leakcheckFindings.length + cavalierFindings.length;

  const score = Math.max(0, 100 - (crit * 25 + high * 10 + med * 3));
  const grade = getGrade(score);
  const risk = getRiskLabel(score);
  const now = new Date().toISOString().split("T")[0];
  const timeStr = new Date().toISOString().split("T")[1]?.substring(0, 5) || "00:00";
  const hasLogo = !!logoData;
  const tx = hasLogo ? 72 : 30;

  const pages: string[][] = [];

  // ── Page 1: Executive Summary ──
  const p1: string[] = [];
  p1.push(`1 1 1 rg`, `0 0 595 842 re f`);
  p1.push(`0.08 0.12 0.2 rg`, `0 790 595 52 re f`);
  p1.push(`0.8 0.15 0.15 rg`, `0 788 595 3 re f`);
  if (hasLogo) p1.push(`q 36 0 0 36 30 798 cm /Logo Do Q`);
  p1.push(`BT /F2 16 Tf 1 1 1 rg ${tx} 810 Td (SOMALIA CYBER DEFENCE) Tj ET`);
  p1.push(`BT /F1 9 Tf 0.8 0.85 0.9 rg ${tx} 798 Td (National Cybersecurity Authority) Tj ET`);
  p1.push(`BT /F2 11 Tf 1 1 1 rg 400 810 Td (Dark Web Report) Tj ET`);
  p1.push(`BT /F1 8 Tf 0.8 0.85 0.9 rg 400 798 Td (Exposure Assessment) Tj ET`);

  // Info section
  p1.push(`0.95 0.96 0.97 rg`, `30 720 535 60 re f`);
  p1.push(`0.85 0.87 0.9 rg`, `30 720 535 0.5 re f`);
  p1.push(`BT /F2 9 Tf 0.3 0.3 0.35 rg 40 762 Td (TARGET DOMAIN) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.15 0.15 0.2 rg 40 750 Td (${s(domain, 60)}) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.3 0.3 0.35 rg 40 736 Td (Scan ID: ${s(scanId, 40)}) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.3 0.3 0.35 rg 350 762 Td (SCAN DATE) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.15 0.15 0.2 rg 350 750 Td (${now} ${timeStr} UTC) Tj ET`);
  p1.push(`BT /F2 9 Tf 0.3 0.3 0.35 rg 350 736 Td (Grade: ${grade.grade} - ${grade.label}) Tj ET`);

  // Risk Level box
  p1.push(`${risk.color} rg`, `455 726 105 40 re f`);
  p1.push(`BT /F2 9 Tf 1 1 1 rg 470 750 Td (RISK LEVEL) Tj ET`);
  p1.push(`BT /F2 13 Tf 1 1 1 rg 475 732 Td (${risk.label}) Tj ET`);

  // Score
  p1.push(`BT /F2 12 Tf 0.15 0.15 0.2 rg 30 700 Td (Exposure Score) Tj ET`);
  p1.push(`0.95 0.96 0.97 rg`, `30 640 120 50 re f`);
  const scoreColor = score >= 75 ? "0.2 0.7 0.3" : score >= 50 ? "0.9 0.7 0.1" : "0.8 0.15 0.15";
  p1.push(`BT /F2 28 Tf ${scoreColor} rg 50 655 Td (${score}) Tj ET`);
  p1.push(`BT /F1 10 Tf 0.4 0.4 0.45 rg 95 655 Td (/100) Tj ET`);

  // Severity breakdown
  p1.push(`BT /F2 12 Tf 0.15 0.15 0.2 rg 30 625 Td (Finding Summary) Tj ET`);
  const sevBoxes = [
    { label: "TOTAL", count: total, color: "0.2 0.25 0.4", bg: "0.93 0.94 0.96" },
    { label: "CRITICAL", count: crit, color: "0.8 0.15 0.15", bg: "0.95 0.9 0.9" },
    { label: "HIGH", count: high, color: "0.9 0.45 0.1", bg: "0.97 0.93 0.88" },
    { label: "MEDIUM", count: med, color: "0.85 0.7 0.1", bg: "0.97 0.96 0.88" },
  ];
  let bx = 30;
  for (const sev of sevBoxes) {
    p1.push(`${sev.color} rg`, `${bx} 510 4 30 re f`);
    p1.push(`${sev.bg} rg`, `${bx + 4} 510 126 30 re f`);
    p1.push(`BT /F2 16 Tf ${sev.color} rg ${bx + 50} 522 Td (${sev.count}) Tj ET`);
    p1.push(`BT /F1 7 Tf 0.4 0.4 0.5 rg ${bx + 15} 514 Td (${sev.label}) Tj ET`);
    bx += 135;
  }

  // Source summary table
  p1.push(`BT /F2 11 Tf 0.15 0.15 0.2 rg 30 490 Td (Source Summary) Tj ET`);
  p1.push(`0.08 0.12 0.2 rg`, `30 468 535 18 re f`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 35 472 Td (SOURCE) Tj ET`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 280 472 Td (FINDINGS) Tj ET`);
  p1.push(`BT /F2 8 Tf 1 1 1 rg 400 472 Td (STATUS) Tj ET`);

  let y = 454;
  for (let i = 0; i < sourceConfigs.length; i++) {
    if (y < 80) break;
    const src = sourceConfigs[i];
    const srcData = results?.[src.key];
    const count = srcData?.findings?.length || 0;
    const hasError = !!srcData?.error;
    const statusText = hasError ? "ERROR" : count > 0 ? "FOUND" : "CLEAR";
    const stColor = statusText === "CLEAR" ? "0.2 0.7 0.3" : statusText === "FOUND" ? "0.8 0.15 0.15" : "0.85 0.7 0.1";

    if (i % 2 === 0) {
      p1.push(`0.96 0.97 0.98 rg`, `30 ${y - 4} 535 16 re f`);
    }
    p1.push(`BT /F1 8 Tf 0.15 0.15 0.2 rg 35 ${y} Td (${s(src.label, 40)}) Tj ET`);
    p1.push(`BT /F1 8 Tf 0.3 0.3 0.4 rg 290 ${y} Td (${count}) Tj ET`);
    p1.push(`BT /F2 8 Tf ${stColor} rg 405 ${y} Td (${statusText}) Tj ET`);
    y -= 16;
  }

  // Footer
  p1.push(`0.08 0.12 0.2 rg`, `0 0 595 40 re f`);
  p1.push(`0.8 0.15 0.15 rg`, `0 40 595 2 re f`);
  p1.push(`BT /F1 7 Tf 0.7 0.75 0.8 rg 30 18 Td (Somalia Cyber Defence Dark Web Report | ${now} | CONFIDENTIAL | Page 1) Tj ET`);
  pages.push(p1);

  // ── Page 2+: Detailed findings ──
  const allFindings: { source: string; finding: any }[] = [];
  for (const src of sourceConfigs) {
    const srcData = results?.[src.key];
    if (!srcData?.findings) continue;
    for (const f of srcData.findings) {
      allFindings.push({ source: src.label, finding: f });
    }
  }

  if (allFindings.length > 0) {
    const perPage = 20;
    for (let pageIdx = 0; pageIdx < Math.ceil(allFindings.length / perPage); pageIdx++) {
      const p: string[] = [];
      p.push(`1 1 1 rg`, `0 0 595 842 re f`);
      p.push(`0.08 0.12 0.2 rg`, `0 790 595 52 re f`);
      p.push(`0.8 0.15 0.15 rg`, `0 788 595 3 re f`);
      if (hasLogo) p.push(`q 36 0 0 36 30 798 cm /Logo Do Q`);
      p.push(`BT /F2 14 Tf 1 1 1 rg ${tx} 810 Td (SOMALIA CYBER DEFENCE) Tj ET`);
      p.push(`BT /F1 9 Tf 0.8 0.85 0.9 rg ${tx} 798 Td (Detailed Findings) Tj ET`);
      p.push(`BT /F1 8 Tf 0.8 0.85 0.9 rg 400 810 Td (${s(domain, 30)}) Tj ET`);

      p.push(`0.08 0.12 0.2 rg`, `30 760 535 18 re f`);
      p.push(`BT /F2 7 Tf 1 1 1 rg 35 764 Td (SOURCE) Tj ET`);
      p.push(`BT /F2 7 Tf 1 1 1 rg 140 764 Td (DETAIL) Tj ET`);
      p.push(`BT /F2 7 Tf 1 1 1 rg 420 764 Td (ADDITIONAL) Tj ET`);

      let fy = 744;
      const chunk = allFindings.slice(pageIdx * perPage, (pageIdx + 1) * perPage);

      for (let i = 0; i < chunk.length; i++) {
        if (fy < 60) break;
        const { source, finding: f } = chunk[i];

        if (i % 2 === 0) {
          p.push(`0.96 0.97 0.98 rg`, `30 ${fy - 8} 535 30 re f`);
        }

        p.push(`BT /F2 7 Tf 0.15 0.15 0.2 rg 35 ${fy} Td (${s(source, 18)}) Tj ET`);
        const detail = buildFindingDetail(f);
        p.push(`BT /F1 6 Tf 0.25 0.25 0.3 rg 140 ${fy} Td (${s(detail, 45)}) Tj ET`);
        const extra = buildFindingExtra(f);
        p.push(`BT /F1 6 Tf 0.4 0.4 0.5 rg 420 ${fy} Td (${s(extra, 28)}) Tj ET`);

        fy -= 12;
        const detail2 = s(detail.length > 45 ? detail.substring(45) : "", 70);
        if (detail2) {
          p.push(`BT /F1 6 Tf 0.4 0.4 0.5 rg 140 ${fy} Td (${detail2}) Tj ET`);
        }
        fy -= 20;
      }

      p.push(`0.08 0.12 0.2 rg`, `0 0 595 40 re f`);
      p.push(`0.8 0.15 0.15 rg`, `0 40 595 2 re f`);
      p.push(`BT /F1 7 Tf 0.7 0.75 0.8 rg 30 18 Td (Somalia Cyber Defence Dark Web Report | ${now} | CONFIDENTIAL | Page ${pageIdx + 2}) Tj ET`);
      pages.push(p);
    }
  }

  // ── LeakCheck detail pages ──
  if (leakcheckFindings.length > 0) {
    const lcPages = buildLeakCheckPages(leakcheckFindings, domain, hasLogo, pages.length + 1);
    for (const lcp of lcPages) {
      pages.push(lcp);
    }
  }

  // Build PDF
  const pageCount = pages.length;
  const streams = pages.map((p) => new TextEncoder().encode(p.join("\n")));
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
  addObj(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  addObj(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);

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

function buildFindingDetail(f: any): string {
  const parts: string[] = [];
  if (f.email) parts.push(`Email: ${f.email}`);
  if (f.username) parts.push(`User: ${f.username}`);
  if (f.breach_name) parts.push(`Breach: ${f.breach_name}`);
  if (f.message) parts.push(f.message);
  if (f.title) parts.push(f.title);
  if (f.url) parts.push(f.url);
  if (f.breach_count !== undefined) parts.push(`Breaches: ${f.breach_count}`);
  if (parts.length === 0) {
    const keys = Object.keys(f).slice(0, 3);
    for (const k of keys) {
      if (k === "password" || k === "hash") continue;
      parts.push(`${k}: ${String(f[k]).substring(0, 30)}`);
    }
  }
  return parts.join(" | ");
}

function buildFindingExtra(f: any): string {
  const parts: string[] = [];
  if (f.database) parts.push(f.database);
  if (f.breach_date) parts.push(f.breach_date);
  if (f.leak_type) parts.push(f.leak_type);
  if (f.sources && Array.isArray(f.sources)) parts.push(f.sources.slice(0, 2).join(", "));
  if (f.severity) parts.push(f.severity);
  return parts.join(" | ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scan } = await req.json();
    if (!scan) {
      return new Response(JSON.stringify({ success: false, error: "Missing scan data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const domain = scan.domain || scan.target || "unknown";
    const scanId = scan.scan_id || "unknown";
    const summary = scan.darkweb_summary;
    const results = scan.darkweb_results;

    // ── Augment counts ──
    const baseCrit = summary?.critical || 0;
    const baseHigh = summary?.high || 0;
    const baseMed = summary?.medium || 0;
    const baseTotal = summary?.total_findings || 0;

    const leakcheckFindings: any[] = results?.leakcheck?.findings || [];
    const cavalierFindings: any[] = results?.cavalier?.findings || [];

    let lcCrit = 0, lcHigh = 0, lcMed = 0;
    for (const f of leakcheckFindings) {
      if (f.severity === "CRITICAL") lcCrit++;
      else if (f.severity === "HIGH") lcHigh++;
      else lcMed++;
    }
    let cavCrit = 0, cavHigh = 0;
    for (const f of cavalierFindings) {
      if (f.severity === "CRITICAL") cavCrit++;
      else if (f.severity === "HIGH") cavHigh++;
    }

    const crit = baseCrit + lcCrit + cavCrit;
    const high = baseHigh + lcHigh + cavHigh;
    const med = baseMed + lcMed;
    const total = baseTotal + leakcheckFindings.length + cavalierFindings.length;

    const score = Math.max(0, 100 - (crit * 25 + high * 10 + med * 3));
    const grade = getGrade(score);
    const scanDate = new Date().toISOString().split("T")[0];

    const logoData = await fetchLogoPngData();
    const pdfBytes = generateDarkWebPDF({ domain, scanId, summary, results, logoData });
    let binary = "";
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i]);
    }
    const pdfBase64 = btoa(binary);

    const scoreColor = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#dc2626";
    const logoUrl = "https://awdysfgjmhnqwsoyhbah.supabase.co/storage/v1/object/public/media/logo.png";

    // LeakCheck breakdown for email
    const lcDomain = leakcheckFindings.filter((f: any) => f.type === "domain_breach").length;
    const lcEmail = leakcheckFindings.filter((f: any) => f.type === "email_breach").length;
    const lcKeyword = leakcheckFindings.filter((f: any) => f.type === "keyword_mention").length;
    const lcTotal = leakcheckFindings.length;

    const leakcheckEmailHtml = lcTotal > 0 ? `
    <div style="margin-top:20px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px">
      <div style="font-size:13px;font-weight:bold;color:#991b1b;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">LeakCheck Pro Intelligence — ${lcTotal} Findings</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 10px;font-size:12px;color:#0f172a;border-bottom:1px solid #fecaca"><strong>Domain Breaches</strong></td>
          <td style="padding:6px 10px;font-size:14px;font-weight:bold;color:#dc2626;text-align:right;border-bottom:1px solid #fecaca">${lcDomain}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;font-size:12px;color:#0f172a;border-bottom:1px solid #fecaca"><strong>Email Breaches</strong></td>
          <td style="padding:6px 10px;font-size:14px;font-weight:bold;color:#f97316;text-align:right;border-bottom:1px solid #fecaca">${lcEmail}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;font-size:12px;color:#0f172a"><strong>Keyword Mentions</strong></td>
          <td style="padding:6px 10px;font-size:14px;font-weight:bold;color:#eab308;text-align:right">${lcKeyword}</td>
        </tr>
      </table>
      <div style="font-size:11px;color:#64748b;margin-top:8px">Critical: ${lcCrit} | High: ${lcHigh} | Medium: ${lcMed}</div>
    </div>` : "";

    const html = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#ffffff;color:#1e293b;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#0d1520;padding:20px 30px;border-bottom:3px solid #cc2626">
    <table style="width:100%"><tr>
      <td style="vertical-align:middle"><img src="${logoUrl}" alt="Logo" width="40" height="40" style="display:block;border-radius:4px" /></td>
      <td style="vertical-align:middle;padding-left:12px">
        <div style="color:#ffffff;font-size:18px;font-weight:bold;margin:0">SOMALIA CYBER DEFENCE</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:2px">Dark Web Exposure Report</div>
      </td>
      <td style="vertical-align:middle;text-align:right">
        <div style="color:#94a3b8;font-size:11px">${scanDate}</div>
      </td>
    </tr></table>
  </div>
  <div style="padding:24px 30px">
    <table style="width:100%;margin-bottom:20px;border-collapse:collapse">
      <tr>
        <td style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 0 0 8px;width:40%">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Domain</div>
          <div style="font-size:16px;font-weight:bold;color:#0f172a;margin-top:4px">${domain}</div>
          <div style="font-size:12px;color:#475569;margin-top:2px">Scan: ${scanId.substring(0, 8)}...</div>
        </td>
        <td style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;width:30%">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Exposure Score</div>
          <div style="font-size:36px;font-weight:bold;color:${scoreColor};margin-top:4px">${score}</div>
          <div style="font-size:12px;color:#475569">/100</div>
        </td>
        <td style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;border-radius:0 8px 8px 0;width:30%">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Grade</div>
          <div style="font-size:36px;font-weight:bold;color:${scoreColor};margin-top:4px">${grade.grade}</div>
          <div style="font-size:12px;color:#475569">${grade.label}</div>
        </td>
      </tr>
    </table>

    <div style="font-size:13px;font-weight:bold;color:#0f172a;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">Findings Summary</div>
    <table style="width:100%;margin-bottom:24px;text-align:center;border-collapse:collapse">
      <tr>
        <td style="padding:12px 8px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px 0 0 8px">
          <div style="font-size:10px;color:#991b1b;text-transform:uppercase;font-weight:bold">Critical</div>
          <div style="font-size:24px;font-weight:bold;color:#dc2626">${crit}</div>
        </td>
        <td style="padding:12px 8px;background:#fff7ed;border:1px solid #fed7aa">
          <div style="font-size:10px;color:#9a3412;text-transform:uppercase;font-weight:bold">High</div>
          <div style="font-size:24px;font-weight:bold;color:#f97316">${high}</div>
        </td>
        <td style="padding:12px 8px;background:#fefce8;border:1px solid #fef08a;border-radius:0 8px 8px 0">
          <div style="font-size:10px;color:#854d0e;text-transform:uppercase;font-weight:bold">Medium</div>
          <div style="font-size:24px;font-weight:bold;color:#eab308">${med}</div>
        </td>
      </tr>
    </table>

    ${leakcheckEmailHtml}

    <p style="color:#475569;font-size:13px;line-height:1.6;margin:16px 0 0">The full dark web exposure report with detailed findings is attached as a PDF document.</p>
  </div>
  <div style="padding:20px 30px;border-top:1px solid #e2e8f0;background:#ffffff;">
    <p style="color:#0f172a;font-size:14px;font-weight:bold;margin:0;">Cyber Defense Inc</p>
    <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Cyber Intelligence • Threat Monitoring • Digital Resilience</p>
    <p style="color:#64748b;font-size:12px;margin:12px 0 4px;">📧 <a href="mailto:info@cyberdefense.so" style="color:#2563eb;text-decoration:none;">info@cyberdefense.so</a></p>
    <p style="color:#64748b;font-size:12px;margin:0 0 4px;">🌐 <a href="https://www.cyberdefense.so" style="color:#2563eb;text-decoration:none;">www.cyberdefense.so</a></p>
    <p style="color:#64748b;font-size:12px;margin:0;">🛡️ Protecting Digital Infrastructure Across Nations</p>
  </div>
  <div style="padding:16px 30px;border-top:1px solid #e2e8f0;background:#f8fafc">
    <p style="color:#94a3b8;font-size:11px;margin:0">Somalia Cyber Defence &bull; Dark Web Monitor &bull; ${scanDate} &bull; CONFIDENTIAL</p>
  </div>
</div>`;

    const safeDomain = domain.replace(/[^a-zA-Z0-9-_.]/g, "-");
    const recipients = ["osmando@gmail.com", "info@cyberdefense.so"];

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "noreply@cyberdefense.so",
        to: recipients,
        subject: `Dark Web Report: ${domain} - Score ${score}/100 (Grade ${grade.grade})`,
        html,
        attachments: [
          {
            filename: `DarkWeb-Report-${safeDomain}-${scanDate}.pdf`,
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
    console.error("send-darkweb-report error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
