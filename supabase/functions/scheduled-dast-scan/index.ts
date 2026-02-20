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

    return new Response(
      JSON.stringify({ success: true, scanned: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
