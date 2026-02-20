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
    const scanDate = new Date().toLocaleString("en-US", { timeZone: "UTC" });

    // Build findings rows (only failed)
    let findingRows = "";
    for (const test of (results || [])) {
      const fails = (test.findings || []).filter((f: any) => f.status === "fail");
      for (const f of fails) {
        const sevColor: Record<string, string> = { critical: "#dc2626", high: "#f97316", medium: "#eab308", low: "#3b82f6" };
        const color = sevColor[f.severity] || "#64748b";
        findingRows += `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #333"><span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;text-transform:uppercase">${f.severity}</span></td>
          <td style="padding:8px 12px;border-bottom:1px solid #333;font-size:13px">${test.testName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #333;font-size:13px">${f.test || ""}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #333;font-size:12px;color:#94a3b8">${f.detail || ""}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #333;font-size:12px;color:#22d3ee">${f.recommendation || "—"}</td>
        </tr>`;
      }
    }

    const scoreColor = dastScore >= 75 ? "#22c55e" : dastScore >= 50 ? "#eab308" : "#dc2626";

    const html = `
<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;background:#0f1729;color:#e2e8f0;padding:32px;border-radius:8px">
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
    <h1 style="color:#22d3ee;margin:0">🛡️ DAST Scan Report</h1>
  </div>
  
  <table style="width:100%;margin-bottom:24px">
    <tr>
      <td style="padding:12px;background:#1e293b;border-radius:8px 0 0 8px;width:25%">
        <div style="font-size:12px;color:#94a3b8;text-transform:uppercase">Organization</div>
        <div style="font-size:16px;font-weight:bold;margin-top:4px">${organizationName}</div>
      </td>
      <td style="padding:12px;background:#1e293b;width:25%">
        <div style="font-size:12px;color:#94a3b8;text-transform:uppercase">URL</div>
        <div style="font-size:14px;margin-top:4px">${url}</div>
      </td>
      <td style="padding:12px;background:#1e293b;width:25%;text-align:center">
        <div style="font-size:12px;color:#94a3b8;text-transform:uppercase">DAST Score</div>
        <div style="font-size:28px;font-weight:bold;color:${scoreColor};margin-top:4px">${dastScore}/100</div>
        <div style="font-size:12px;color:${scoreColor}">Grade ${grade.grade} — ${grade.label}</div>
      </td>
      <td style="padding:12px;background:#1e293b;border-radius:0 8px 8px 0;width:25%">
        <div style="font-size:12px;color:#94a3b8;text-transform:uppercase">Scan Date</div>
        <div style="font-size:14px;margin-top:4px">${scanDate} UTC</div>
      </td>
    </tr>
  </table>

  <h2 style="color:#94a3b8;font-size:13px;text-transform:uppercase;margin:0 0 8px">Summary</h2>
  <table style="width:100%;margin-bottom:24px;text-align:center">
    <tr>
      <td style="padding:12px;background:#1e293b;border-radius:8px 0 0 8px"><div style="font-size:11px;color:#94a3b8">CRITICAL</div><div style="font-size:24px;font-weight:bold;color:#dc2626">${summary?.critical || 0}</div></td>
      <td style="padding:12px;background:#1e293b"><div style="font-size:11px;color:#94a3b8">HIGH</div><div style="font-size:24px;font-weight:bold;color:#f97316">${summary?.high || 0}</div></td>
      <td style="padding:12px;background:#1e293b"><div style="font-size:11px;color:#94a3b8">MEDIUM</div><div style="font-size:24px;font-weight:bold;color:#eab308">${summary?.medium || 0}</div></td>
      <td style="padding:12px;background:#1e293b"><div style="font-size:11px;color:#94a3b8">LOW</div><div style="font-size:24px;font-weight:bold;color:#3b82f6">${summary?.low || 0}</div></td>
      <td style="padding:12px;background:#1e293b;border-radius:0 8px 8px 0"><div style="font-size:11px;color:#94a3b8">PASSED</div><div style="font-size:24px;font-weight:bold;color:#22c55e">${summary?.passed || 0}</div></td>
    </tr>
  </table>

  ${findingRows ? `
  <h2 style="color:#94a3b8;font-size:13px;text-transform:uppercase;margin:0 0 8px">Failed Findings</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#1e293b"><th style="padding:8px 12px;text-align:left;font-size:12px">Severity</th><th style="padding:8px 12px;text-align:left;font-size:12px">Category</th><th style="padding:8px 12px;text-align:left;font-size:12px">Test</th><th style="padding:8px 12px;text-align:left;font-size:12px">Detail</th><th style="padding:8px 12px;text-align:left;font-size:12px">Recommendation</th></tr></thead>
    <tbody>${findingRows}</tbody>
  </table>` : '<p style="color:#22c55e">✅ No failed findings — all tests passed!</p>'}

  <p style="color:#64748b;font-size:11px;margin:24px 0 0;border-top:1px solid #333;padding-top:12px">Generated by CyberDefense DAST Scanner · ${scanDate} UTC</p>
</div>`;

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
      }),
    });

    const emailResult = await emailRes.json();
    console.log("Resend result:", JSON.stringify(emailResult));

    return new Response(JSON.stringify({ success: emailRes.ok, emailResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
