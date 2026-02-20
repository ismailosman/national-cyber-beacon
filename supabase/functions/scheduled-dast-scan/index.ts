import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAST_TESTS = [
  { name: "Information Disclosure", fn: "dast-info-disclosure" },
  { name: "HTTP Methods", fn: "dast-http-methods" },
  { name: "Cookie Security", fn: "dast-cookie-security" },
  { name: "CORS Configuration", fn: "dast-cors-check" },
  { name: "Redirect Security", fn: "dast-redirect-check" },
  { name: "Error Handling", fn: "dast-error-handling" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Optional: scan a single org
    let orgId: string | null = null;
    try {
      const body = await req.json();
      orgId = body?.org_id || null;
    } catch {
      // No body = scan all
    }

    // Fetch organizations
    let query = supabase.from("organizations").select("id, name, domain");
    if (orgId) {
      query = query.eq("id", orgId);
    }
    const { data: orgs, error: orgsError } = await query;
    if (orgsError || !orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ success: false, error: orgsError?.message || "No organizations found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (let oi = 0; oi < orgs.length; oi++) {
      const org = orgs[oi];
      const url = org.domain.startsWith("http") ? org.domain : `https://${org.domain}`;

      // Load previous scan results for comparison
      const { data: prevScan } = await supabase
        .from("dast_scan_results")
        .select("results")
        .eq("organization_id", org.id)
        .maybeSingle();

      const oldFailIds = new Set<string>();
      if (prevScan?.results) {
        for (const testResult of prevScan.results as any[]) {
          for (const f of testResult.findings || []) {
            if (f.status === "fail") {
              oldFailIds.add(f.id);
            }
          }
        }
      }

      // Run all 6 DAST tests
      const allTestResults: any[] = [];
      for (let i = 0; i < DAST_TESTS.length; i++) {
        const test = DAST_TESTS[i];
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/${test.fn}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ url }),
          });
          const data = await resp.json();
          allTestResults.push({
            testName: test.name,
            functionName: test.fn,
            success: data?.success || false,
            findings: data?.findings || [],
            error: data?.error || null,
            checkedAt: data?.checkedAt || new Date().toISOString(),
          });
        } catch (err: any) {
          allTestResults.push({
            testName: test.name,
            functionName: test.fn,
            success: false,
            findings: [],
            error: err.message,
            checkedAt: new Date().toISOString(),
          });
        }

        // 2-second delay between tests
        if (i < DAST_TESTS.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // Calculate summary & score
      const allFindings = allTestResults.flatMap((r: any) => r.findings);
      const summary = {
        totalFindings: allFindings.length,
        critical: allFindings.filter((f: any) => f.severity === "critical" && f.status === "fail").length,
        high: allFindings.filter((f: any) => f.severity === "high" && f.status === "fail").length,
        medium: allFindings.filter((f: any) => f.severity === "medium" && f.status === "fail").length,
        low: allFindings.filter((f: any) => f.severity === "low" && f.status === "fail").length,
        passed: allFindings.filter((f: any) => f.status === "pass").length,
      };
      const dastScore = Math.max(0, 100 - (summary.critical * 25 + summary.high * 15 + summary.medium * 5 + summary.low * 2));

      // Identify NEW critical/high findings and create alerts
      const newCriticalFindings = allFindings.filter(
        (f: any) => f.status === "fail" && (f.severity === "critical" || f.severity === "high") && !oldFailIds.has(f.id)
      );

      for (const finding of newCriticalFindings) {
        const severity = finding.severity === "critical" ? "critical" : "high";
        await supabase.from("alerts").insert({
          title: `DAST: ${finding.test} on ${org.name}`,
          description: `${finding.detail}${finding.recommendation ? ` — Fix: ${finding.recommendation}` : ""}`,
          severity,
          source: "dast-scanner",
          organization_id: org.id,
          status: "open",
        });
      }

      // Upsert scan results
      await supabase.from("dast_scan_results").upsert(
        {
          organization_id: org.id,
          organization_name: org.name,
          url,
          results: allTestResults,
          summary,
          dast_score: dastScore,
          scanned_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" }
      );

      results.push({
        org: org.name,
        score: dastScore,
        newAlerts: newCriticalFindings.length,
      });

      // 5-second delay between orgs
      if (oi < orgs.length - 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    // --- Email notification for new critical/high findings ---
    const totalNewAlerts = results.reduce((sum, r) => sum + r.newAlerts, 0);
    let emailSent = false;

    if (totalNewAlerts > 0) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const orgRows = results
            .map(
              (r) =>
                `<tr><td style="padding:8px 12px;border-bottom:1px solid #333">${r.org}</td><td style="padding:8px 12px;border-bottom:1px solid #333;text-align:center">${r.score}</td><td style="padding:8px 12px;border-bottom:1px solid #333;text-align:center">${r.newAlerts}</td></tr>`
            )
            .join("");

          // Query recent DAST alerts for detail
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { data: recentAlerts } = await supabase
            .from("alerts")
            .select("title, description, severity, organization_id")
            .eq("source", "dast-scanner")
            .gte("created_at", oneHourAgo)
            .order("created_at", { ascending: false });

          const findingRows = (recentAlerts || [])
            .map((a) => {
              const badge =
                a.severity === "critical"
                  ? '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">CRITICAL</span>'
                  : '<span style="background:#f97316;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px">HIGH</span>';
              return `<tr><td style="padding:8px 12px;border-bottom:1px solid #333">${badge}</td><td style="padding:8px 12px;border-bottom:1px solid #333">${a.title}</td><td style="padding:8px 12px;border-bottom:1px solid #333;font-size:13px">${a.description || ""}</td></tr>`;
            })
            .join("");

          const html = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#0f1729;color:#e2e8f0;padding:32px;border-radius:8px">
  <h1 style="color:#f97316;margin:0 0 8px">⚠️ DAST Alert</h1>
  <p style="margin:0 0 24px;font-size:18px"><strong>${totalNewAlerts}</strong> new critical/high finding(s) detected</p>
  <h2 style="color:#94a3b8;font-size:14px;text-transform:uppercase;margin:0 0 8px">Organization Summary</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#1e293b"><th style="padding:8px 12px;text-align:left">Organization</th><th style="padding:8px 12px;text-align:center">DAST Score</th><th style="padding:8px 12px;text-align:center">New Alerts</th></tr></thead>
    <tbody>${orgRows}</tbody>
  </table>
  <h2 style="color:#94a3b8;font-size:14px;text-transform:uppercase;margin:0 0 8px">Finding Details</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#1e293b"><th style="padding:8px 12px;text-align:left">Severity</th><th style="padding:8px 12px;text-align:left">Title</th><th style="padding:8px 12px;text-align:left">Details</th></tr></thead>
    <tbody>${findingRows}</tbody>
  </table>
  <p style="color:#64748b;font-size:12px;margin:0">Scanned ${results.length} organization(s) on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</p>
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
              subject: `DAST Alert: ${totalNewAlerts} new critical/high finding(s) detected`,
              html,
            }),
          });
          const emailResult = await emailRes.json();
          console.log("Resend email result:", JSON.stringify(emailResult));
          emailSent = emailRes.ok;
        } else {
          console.warn("RESEND_API_KEY not set, skipping email notification");
        }
      } catch (emailErr: any) {
        console.error("Email notification failed:", emailErr.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, scanned: results.length, results, emailSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
