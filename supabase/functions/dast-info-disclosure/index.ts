import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim().toLowerCase() : "";
}

function isSoft404(body: string, baselineBody: string, baselineLen: number): boolean {
  if (baselineLen === 0) return false;
  const lenRatio = body.length / baselineLen;
  if (lenRatio > 0.8 && lenRatio < 1.2) return true;
  const baseTitle = extractTitle(baselineBody);
  const curTitle = extractTitle(body);
  if (baseTitle && curTitle && baseTitle === curTitle) return true;
  return false;
}

// Content validators for sensitive paths
const sensitiveValidators: Record<string, (body: string, ct: string) => boolean> = {
  "/.env": (b) => /^[A-Z_]+=.+/m.test(b) && !/<html/i.test(b),
  "/.git/HEAD": (b) => /^ref:\s*refs\//m.test(b),
  "/phpinfo.php": (b) => /phpinfo|PHP Version|Configuration/i.test(b) && /module_/i.test(b),
  "/wp-config.php.bak": (b) => /DB_NAME|DB_USER|DB_PASSWORD|table_prefix/i.test(b),
  "/web.config": (b) => /<configuration/i.test(b) && /<system/i.test(b),
  "/.htaccess": (b) => /RewriteEngine|RewriteRule|deny from/i.test(b) && !/<html/i.test(b),
  "/backup.sql": (b, ct) => !ct.includes("text/html") && /CREATE TABLE|INSERT INTO|DROP TABLE/i.test(b),
  "/dump.sql": (b, ct) => !ct.includes("text/html") && /CREATE TABLE|INSERT INTO|DROP TABLE/i.test(b),
  "/db.sql": (b, ct) => !ct.includes("text/html") && /CREATE TABLE|INSERT INTO|DROP TABLE/i.test(b),
  "/.svn/entries": (b) => /^(\d+|dir|file)\s*$/m.test(b) && !/<html/i.test(b),
  "/server-status": (b) => /Apache Server Status|Total accesses|Scoreboard/i.test(b),
  "/server-info": (b) => /Apache Server Information|Module Name/i.test(b),
  "/elmah.axd": (b) => /ELMAH|Error Log|error-log/i.test(b),
  "/trace.axd": (b) => /Application Trace|Request Details/i.test(b),
  "/.DS_Store": (b) => !/<html/i.test(b) && b.length < 50000,
  "/Thumbs.db": (b) => !/<html/i.test(b) && b.length < 50000,
  "/crossdomain.xml": (b) => /cross-domain-policy/i.test(b) && /allow-access-from/i.test(b) && /domain="\*"/i.test(b),
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const findings: any[] = [];
    const baseUrl = url.replace(/\/$/, "");

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

    // Fetch baseline for soft-404 detection
    let baselineBody = "";
    let baselineLen = 0;
    try {
      const baselineResp = await fetch(`${baseUrl}/this-path-does-not-exist-${Date.now()}-fp-check`, {
        method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000),
      });
      if (baselineResp.status === 200) {
        baselineBody = await baselineResp.text();
        baselineLen = baselineBody.length;
      }
    } catch {}

    const disclosurePaths = [
      { path: "/robots.txt", name: "Robots.txt", risk: "Reveals hidden paths" },
      { path: "/sitemap.xml", name: "Sitemap", risk: "Reveals site structure" },
      { path: "/.env", name: "Environment File", risk: "May contain credentials" },
      { path: "/wp-config.php.bak", name: "WordPress Config Backup", risk: "Database credentials" },
      { path: "/phpinfo.php", name: "PHP Info Page", risk: "Full server configuration exposed" },
      { path: "/.git/HEAD", name: "Git Repository", risk: "Source code exposure" },
      { path: "/.svn/entries", name: "SVN Repository", risk: "Source code exposure" },
      { path: "/web.config", name: "IIS Configuration", risk: "Server configuration exposed" },
      { path: "/.htaccess", name: "Apache Configuration", risk: "Server rules exposed" },
      { path: "/crossdomain.xml", name: "Flash Crossdomain", risk: "Overly permissive cross-domain policy" },
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
        const pathResponse = await fetch(`${baseUrl}${item.path}`, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(5000),
        });

        if (pathResponse.status === 200) {
          const contentType = pathResponse.headers.get("content-type") || "";
          const body = await pathResponse.text();

          // robots.txt and sitemap.xml are standard files, not vulnerabilities
          if (item.path === "/robots.txt" || item.path === "/sitemap.xml") {
            findings.push({
              id: `INFO-PATH-${item.path.replace(/[^a-z0-9]/gi, "")}`,
              test: `${item.name} Present`, severity: "info", status: "pass",
              detail: `${item.name} found at ${baseUrl}${item.path} — this is standard and expected`,
            });
            continue;
          }

          // Soft 404 check
          if (baselineLen > 0 && isSoft404(body, baselineBody, baselineLen)) continue;

          // Content validation for sensitive paths
          const validator = sensitiveValidators[item.path];
          if (validator && !validator(body, contentType)) continue;

          // If HTML content for non-HTML paths, likely a soft 404
          const nonHtmlPaths = ["/.env", "/.git/HEAD", "/backup.sql", "/dump.sql", "/db.sql", "/.DS_Store", "/Thumbs.db", "/.svn/entries"];
          if (nonHtmlPaths.includes(item.path) && contentType.includes("text/html")) continue;

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
