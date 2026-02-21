import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const findings: any[] = [];
    const baseUrl = url.replace(/\/$/, "");

    // Error page info leak check
    try {
      const notFoundResponse = await fetch(`${baseUrl}/thispagedoesnotexist_${Date.now()}.html`, { signal: AbortSignal.timeout(10000) });
      const notFoundBody = await notFoundResponse.text();
      const bodyLower = notFoundBody.toLowerCase();

      const infoPatterns = [
        { pattern: "stack trace", name: "Stack Trace", severity: "high" },
        { pattern: "traceback", name: "Python Traceback", severity: "high" },
        { pattern: "exception", name: "Exception Details", severity: "medium" },
        { pattern: "at line", name: "Line Numbers", severity: "medium" },
        { pattern: "fatal error", name: "Fatal Error", severity: "high" },
        { pattern: "syntax error", name: "Syntax Error", severity: "high" },
        { pattern: "mysql_", name: "MySQL Error", severity: "high" },
        { pattern: "pg_query", name: "PostgreSQL Error", severity: "high" },
        { pattern: "ora-", name: "Oracle Error", severity: "high" },
        { pattern: "sqlstate", name: "SQL Error", severity: "high" },
        { pattern: "/var/www", name: "Server Path Disclosed", severity: "medium" },
        { pattern: "c:\\inetpub", name: "IIS Path Disclosed", severity: "medium" },
        { pattern: "/home/", name: "Home Directory Disclosed", severity: "medium" },
        { pattern: "phpversion", name: "PHP Version Disclosed", severity: "low" },
        { pattern: "debug", name: "Debug Mode Active", severity: "medium" },
      ];

      const foundPatterns = infoPatterns.filter(p => bodyLower.includes(p.pattern));
      if (foundPatterns.length > 0) {
        for (const found of foundPatterns) {
          findings.push({ id: `ERR-${found.name.replace(/\s/g, "")}`, test: `Error Page: ${found.name}`,
            severity: found.severity, status: "fail",
            detail: `404 error page reveals "${found.name}". This helps attackers understand your server setup.`,
            recommendation: "Configure custom error pages that do not reveal technical details.",
            evidence: { pattern: found.pattern, httpStatus: notFoundResponse.status },
          });
        }
      } else {
        findings.push({ id: "ERR-001", test: "Custom Error Page", severity: "info", status: "pass",
          detail: `Error page does not reveal technical information (status ${notFoundResponse.status})`,
          evidence: { httpStatus: notFoundResponse.status, bodyLength: notFoundBody.length },
        });
      }
    } catch (e) {
      findings.push({ id: "ERR-CONN", test: "Error Page Check", severity: "info", status: "error", detail: `Could not test error handling: ${e.message}` });
    }

    // Malformed input check
    try {
      const malformedResponse = await fetch(`${baseUrl}/%00%0d%0a`, { method: "GET", signal: AbortSignal.timeout(5000) });
      if (malformedResponse.status === 500) {
        const body500 = await malformedResponse.text();
        if (body500.length > 500 && (body500.toLowerCase().includes("error") || body500.toLowerCase().includes("exception"))) {
          findings.push({ id: "ERR-500", test: "Verbose 500 Error on Malformed Input", severity: "medium", status: "fail",
            detail: "Server returns verbose 500 error on malformed input.",
            recommendation: "Configure generic 500 error pages for production environments",
            evidence: { httpStatus: 500, bodyLength: body500.length },
          });
        }
      }
    } catch {}

    // Admin panel detection with improved logic
    const adminPaths = ["/admin", "/administrator", "/admin/login", "/wp-admin", "/wp-login.php", "/login", "/signin",
      "/cpanel", "/phpmyadmin", "/adminer", "/panel", "/dashboard/login", "/user/login", "/management"];
    const exposedAdminPaths: string[] = [];
    for (const path of adminPaths) {
      try {
        const adminResponse = await fetch(`${baseUrl}${path}`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(5000) });
        
        // 302/301 redirects are expected (login redirect), skip them
        if (adminResponse.status === 301 || adminResponse.status === 302) continue;
        
        if (adminResponse.status === 200) {
          const body = await adminResponse.text();
          const bodyLower = body.toLowerCase();
          
          // Only flag if the page actually contains login form elements
          const hasLoginForm = (
            (bodyLower.includes("<form") && (
              bodyLower.includes('type="password"') ||
              bodyLower.includes("type='password'") ||
              bodyLower.includes("password") && bodyLower.includes("username") ||
              bodyLower.includes("password") && bodyLower.includes("login")
            )) ||
            bodyLower.includes("wp-login") ||
            bodyLower.includes("phpmyadmin") ||
            bodyLower.includes("adminer")
          );
          
          if (hasLoginForm) {
            exposedAdminPaths.push(path);
          }
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (exposedAdminPaths.length > 0) {
      findings.push({ id: "ERR-ADMIN", test: "Exposed Admin Panels", severity: "medium", status: "fail",
        detail: `Found ${exposedAdminPaths.length} accessible admin/login path(s): ${exposedAdminPaths.join(", ")}`,
        recommendation: "Restrict admin panels to specific IP addresses, add MFA, or move to non-standard paths",
        evidence: { paths: exposedAdminPaths },
      });
    } else {
      findings.push({ id: "ERR-ADMIN", test: "Admin Panel Exposure", severity: "info", status: "pass",
        detail: "No common admin panels found at standard paths",
      });
    }

    return new Response(JSON.stringify({
      success: true, test: "error_handling", findingsCount: findings.length, findings,
      checkedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false, test: "error_handling", error: error.message,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
