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

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    const serverHeader = response.headers.get("server") || "";
    const poweredBy = response.headers.get("x-powered-by") || "";
    const xAspNet = response.headers.get("x-aspnet-version") || "";

    const versionRegex = /\d+\.\d+/;
    if (serverHeader && versionRegex.test(serverHeader)) {
      findings.push({
        id: "INFO-001", test: "Server Version Disclosure", severity: "medium", status: "fail",
        detail: `Server header reveals version: "${serverHeader}"`,
        recommendation: "Remove version numbers from the Server header. In Nginx: server_tokens off; In Apache: ServerTokens Prod",
        evidence: { header: "Server", value: serverHeader },
      });
    } else if (serverHeader) {
      findings.push({
        id: "INFO-001", test: "Server Version Disclosure", severity: "info", status: "pass",
        detail: `Server header present but no version exposed: "${serverHeader}"`,
        evidence: { header: "Server", value: serverHeader },
      });
    }

    if (poweredBy) {
      findings.push({
        id: "INFO-002", test: "Technology Disclosure (X-Powered-By)", severity: "medium", status: "fail",
        detail: `X-Powered-By header reveals technology: "${poweredBy}"`,
        recommendation: "Remove the X-Powered-By header. In PHP: expose_php = Off. In Express.js: app.disable('x-powered-by')",
        evidence: { header: "X-Powered-By", value: poweredBy },
      });
    } else {
      findings.push({
        id: "INFO-002", test: "Technology Disclosure (X-Powered-By)", severity: "info", status: "pass",
        detail: "X-Powered-By header not present (good)",
      });
    }

    if (xAspNet) {
      findings.push({
        id: "INFO-003", test: "ASP.NET Version Disclosure", severity: "medium", status: "fail",
        detail: `X-AspNet-Version header reveals: "${xAspNet}"`,
        recommendation: 'Remove X-AspNet-Version header in web.config: <httpRuntime enableVersionHeader="false" />',
        evidence: { header: "X-AspNet-Version", value: xAspNet },
      });
    }

    const disclosurePaths = [
      { path: "/robots.txt", name: "Robots.txt", risk: "Reveals hidden paths" },
      { path: "/.env", name: "Environment File", risk: "May contain credentials" },
      { path: "/wp-config.php.bak", name: "WordPress Config Backup", risk: "Database credentials" },
      { path: "/phpinfo.php", name: "PHP Info Page", risk: "Full server configuration exposed" },
      { path: "/.git/HEAD", name: "Git Repository", risk: "Source code exposure" },
      { path: "/.svn/entries", name: "SVN Repository", risk: "Source code exposure" },
      { path: "/web.config", name: "IIS Configuration", risk: "Server configuration exposed" },
      { path: "/.htaccess", name: "Apache Configuration", risk: "Server rules exposed" },
      { path: "/crossdomain.xml", name: "Flash Crossdomain", risk: "Overly permissive cross-domain policy" },
      { path: "/sitemap.xml", name: "Sitemap", risk: "Reveals site structure" },
      { path: "/server-status", name: "Apache Server Status", risk: "Live server metrics exposed" },
      { path: "/server-info", name: "Apache Server Info", risk: "Full server configuration" },
      { path: "/elmah.axd", name: "ELMAH Error Log", risk: "Application errors with stack traces" },
      { path: "/trace.axd", name: "ASP.NET Trace", risk: "Request tracing data" },
      { path: "/backup.sql", name: "SQL Backup File", risk: "Full database dump" },
      { path: "/dump.sql", name: "SQL Dump File", risk: "Full database dump" },
      { path: "/db.sql", name: "Database File", risk: "Full database dump" },
      { path: "/.DS_Store", name: "macOS Directory File", risk: "Reveals directory structure" },
      { path: "/Thumbs.db", name: "Windows Thumbnail Cache", risk: "Reveals file names" },
    ];

    for (const item of disclosurePaths) {
      try {
        const baseUrl = url.replace(/\/$/, "");
        const pathResponse = await fetch(`${baseUrl}${item.path}`, {
          method: "HEAD",
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
        });

        if (pathResponse.status === 200) {
          const criticalPaths = ["/.env", "/.git/HEAD", "/phpinfo.php", "/wp-config.php.bak", "/backup.sql", "/dump.sql", "/db.sql"];
          const severity = criticalPaths.includes(item.path) ? "critical" : "low";
          findings.push({
            id: `INFO-PATH-${item.path.replace(/[^a-z0-9]/gi, "")}`,
            test: `Exposed Path: ${item.name}`, severity, status: "fail",
            detail: `${item.name} is accessible at ${baseUrl}${item.path} — ${item.risk}`,
            recommendation: `Block access to ${item.path} in your web server configuration or remove the file`,
            evidence: { path: item.path, status: pathResponse.status, risk: item.risk },
          });
        }
      } catch { /* path not accessible */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return new Response(JSON.stringify({
      success: true, test: "information_disclosure", findingsCount: findings.length, findings,
      checkedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false, test: "information_disclosure", error: error.message,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
