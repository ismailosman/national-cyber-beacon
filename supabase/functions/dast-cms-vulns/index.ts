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

    let detectedCMS: string | null = null;
    let cmsVersion: string | null = null;

    try {
      const pageResponse = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const html = await pageResponse.text();

      if (html.includes("wp-content") || html.includes("wp-includes")) detectedCMS = "wordpress";
      else if (html.includes("/media/jui/") || html.includes("Joomla!")) detectedCMS = "joomla";
      else if (html.includes("Drupal") || html.includes("drupal.js")) detectedCMS = "drupal";

      const generatorMatch = html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']*)["']/i);
      if (generatorMatch) {
        const generator = generatorMatch[1];
        if (generator.toLowerCase().includes("wordpress")) {
          detectedCMS = "wordpress";
          const vMatch = generator.match(/WordPress\s+([\d.]+)/i);
          if (vMatch) cmsVersion = vMatch[1];
        } else if (generator.toLowerCase().includes("joomla")) {
          detectedCMS = "joomla";
          const vMatch = generator.match(/Joomla!\s+([\d.]+)/i);
          if (vMatch) cmsVersion = vMatch[1];
        } else if (generator.toLowerCase().includes("drupal")) {
          detectedCMS = "drupal";
          const vMatch = generator.match(/Drupal\s+([\d.]+)/i);
          if (vMatch) cmsVersion = vMatch[1];
        }
      }
    } catch {}

    if (!detectedCMS) {
      findings.push({ id: "CMS-NONE", test: "CMS Detection", severity: "info", status: "info", detail: "No common CMS detected." });
    } else {
      findings.push({ id: "CMS-DETECT", test: "CMS Detected", severity: "info", status: "info", detail: `Detected: ${detectedCMS}${cmsVersion ? ` v${cmsVersion}` : ""}`, evidence: { cms: detectedCMS, version: cmsVersion } });
    }

    if (cmsVersion) {
      findings.push({ id: "CMS-VERSION", test: "CMS Version Disclosed", severity: "medium", status: "fail", detail: `${detectedCMS} version ${cmsVersion} is publicly visible.`, recommendation: "Remove the generator meta tag.", evidence: { cms: detectedCMS, version: cmsVersion } });
    }

    // WordPress checks
    if (detectedCMS === "wordpress") {
      const wpChecks = [
        { path: "/wp-json/wp/v2/users", name: "User Enumeration via REST API", severity: "high", risk: "Lists all WordPress usernames" },
        { path: "/xmlrpc.php", name: "XML-RPC Enabled", severity: "high", risk: "Allows brute force attacks and DDoS amplification" },
        { path: "/wp-content/debug.log", name: "Debug Log Exposed", severity: "critical", risk: "Contains PHP errors, file paths, credentials" },
        { path: "/wp-config.php.bak", name: "Config Backup File", severity: "critical", risk: "Contains database credentials" },
        { path: "/wp-content/uploads/", name: "Uploads Directory Listing", severity: "medium", risk: "Directory listing enabled" },
        { path: "/readme.html", name: "WordPress Readme", severity: "low", risk: "Reveals WordPress version" },
        { path: "/wp-content/plugins/", name: "Plugin Directory Listing", severity: "medium", risk: "Lists installed plugins" },
        { path: "/wp-admin/install.php", name: "Installation Script Accessible", severity: "high", risk: "May allow unauthorized setup" },
      ];

      for (const check of wpChecks) {
        try {
          const r = await fetch(`${baseUrl}${check.path}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
          if (r.status === 200) {
            findings.push({ id: `CMS-WP-${check.path.replace(/[^a-z0-9]/gi, "")}`, test: check.name, severity: check.severity, status: "fail", detail: `${check.path} accessible. ${check.risk}`, recommendation: `Block access to ${check.path}`, evidence: { path: check.path } });
          }
        } catch {}
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Joomla checks
    if (detectedCMS === "joomla") {
      const jChecks = [
        { path: "/administrator/", name: "Joomla Admin Panel Exposed", severity: "medium", risk: "Default admin path publicly accessible" },
        { path: "/configuration.php-dist", name: "Joomla Config Template", severity: "high", risk: "May reveal database config" },
      ];
      for (const check of jChecks) {
        try {
          const r = await fetch(`${baseUrl}${check.path}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
          if (r.status === 200) {
            findings.push({ id: `CMS-JM-${check.path.replace(/[^a-z0-9]/gi, "")}`, test: check.name, severity: check.severity, status: "fail", detail: `${check.path} accessible. ${check.risk}`, recommendation: `Restrict access to ${check.path}` });
          }
        } catch {}
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Drupal checks
    if (detectedCMS === "drupal") {
      const dChecks = [
        { path: "/CHANGELOG.txt", name: "Drupal Changelog Exposed", severity: "medium", risk: "Reveals exact Drupal version" },
        { path: "/user/register", name: "Open User Registration", severity: "high", risk: "Anyone can create an account" },
      ];
      for (const check of dChecks) {
        try {
          const r = await fetch(`${baseUrl}${check.path}`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
          if (r.status === 200) {
            findings.push({ id: `CMS-DR-${check.path.replace(/[^a-z0-9]/gi, "")}`, test: check.name, severity: check.severity, status: "fail", detail: `${check.path} accessible. ${check.risk}`, recommendation: `Restrict access to ${check.path}` });
          }
        } catch {}
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // General directory listing
    const dirPaths = ["/images/", "/uploads/", "/files/", "/media/", "/assets/"];
    for (const dirPath of dirPaths) {
      try {
        const r = await fetch(`${baseUrl}${dirPath}`, { signal: AbortSignal.timeout(5000) });
        if (r.status === 200) {
          const body = await r.text();
          if (body.toLowerCase().includes("index of") || body.toLowerCase().includes("directory listing")) {
            findings.push({ id: `CMS-DIRLIST-${dirPath.replace(/[^a-z0-9]/gi, "")}`, test: `Directory Listing: ${dirPath}`, severity: "medium", status: "fail", detail: `Directory listing enabled at ${dirPath}`, recommendation: "Disable directory listing. Nginx: autoindex off; Apache: Options -Indexes" });
          }
        }
      } catch {}
      await new Promise(r => setTimeout(r, 150));
    }

    return new Response(JSON.stringify({ success: true, test: "cms_vulnerabilities", detectedCMS, cmsVersion, findingsCount: findings.length, findings, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, test: "cms_vulnerabilities", error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
