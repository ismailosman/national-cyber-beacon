import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract <title> from HTML
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim().toLowerCase() : "";
}

// Check if response body is similar to baseline (soft 404)
function isSoft404(body: string, baselineBody: string, baselineLen: number): boolean {
  if (baselineLen === 0) return false;
  const lenRatio = body.length / baselineLen;
  if (lenRatio > 0.8 && lenRatio < 1.2) return true;
  const baseTitle = extractTitle(baselineBody);
  const curTitle = extractTitle(body);
  if (baseTitle && curTitle && baseTitle === curTitle) return true;
  return false;
}

// Content validators per path pattern
const contentValidators: Record<string, (body: string) => boolean> = {
  "/graphiql": (b) => /graphiql|graphql\s*ide|graphql playground/i.test(b),
  "/graphql": (b) => /graphql|__schema|query\s*\{/i.test(b) && !/<html/i.test(b),
  "/debug/": (b) => /traceback|stack\s*trace|debugger|debug\s*mode/i.test(b),
  "/actuator": (b) => { try { const j = JSON.parse(b); return !!(j.status || j._links || j.beans); } catch { return false; } },
  "/actuator/env": (b) => { try { const j = JSON.parse(b); return !!(j.activeProfiles || j.propertySources || j.property); } catch { return false; } },
  "/_profiler/": (b) => /sf-toolbar|symfony\s*profiler|_profiler/i.test(b),
  "/metrics": (b) => /^#\s*(HELP|TYPE)\s/m.test(b) || /process_cpu|jvm_memory|http_requests/i.test(b),
  "/Dockerfile": (b) => /^FROM\s+/m.test(b),
  "/docker-compose.yml": (b) => /^(version|services):/m.test(b),
  "/config.json": (b) => { try { JSON.parse(b); return true; } catch { return false; } },
  "/package.json": (b) => { try { const j = JSON.parse(b); return !!(j.dependencies || j.devDependencies || j.name); } catch { return false; } },
  "/composer.json": (b) => { try { const j = JSON.parse(b); return !!(j.require || j.name); } catch { return false; } },
  "/requirements.txt": (b) => /^[a-zA-Z0-9_-]+==/m.test(b) && !/<html/i.test(b),
  "/swagger-ui.html": (b) => /swagger/i.test(b) && (/swagger-ui/i.test(b) || /api-docs/i.test(b)),
  "/swagger-ui/": (b) => /swagger/i.test(b) && (/swagger-ui/i.test(b) || /api-docs/i.test(b)),
  "/api-docs": (b) => /swagger|openapi|paths|components/i.test(b),
  "/swagger.json": (b) => { try { const j = JSON.parse(b); return !!(j.swagger || j.openapi || j.paths); } catch { return false; } },
  "/openapi.json": (b) => { try { const j = JSON.parse(b); return !!(j.openapi || j.paths); } catch { return false; } },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    const findings: any[] = [];
    const baseUrl = url.replace(/\/$/, "");

    // Fetch baseline (soft 404) response
    let baselineBody = "";
    let baselineLen = 0;
    try {
      const baselineResp = await fetch(`${baseUrl}/this-page-does-not-exist-${Date.now()}-baseline-check`, {
        method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000),
      });
      if (baselineResp.status === 200) {
        baselineBody = await baselineResp.text();
        baselineLen = baselineBody.length;
      }
    } catch {}

    const apiPaths = [
      { path: "/swagger-ui.html", name: "Swagger UI", severity: "high", risk: "Full API documentation exposed" },
      { path: "/swagger-ui/", name: "Swagger UI", severity: "high", risk: "Full API documentation exposed" },
      { path: "/api-docs", name: "API Documentation", severity: "high", risk: "API docs publicly accessible" },
      { path: "/swagger.json", name: "Swagger JSON", severity: "high", risk: "Machine-readable API spec exposed" },
      { path: "/openapi.json", name: "OpenAPI Spec", severity: "high", risk: "Machine-readable API spec exposed" },
      { path: "/graphql", name: "GraphQL Endpoint", severity: "medium", risk: "GraphQL endpoint exposed" },
      { path: "/graphiql", name: "GraphiQL IDE", severity: "high", risk: "GraphQL dev IDE publicly accessible" },
      { path: "/debug/", name: "Debug Endpoint", severity: "critical", risk: "Debug interface exposed in production" },
      { path: "/actuator", name: "Spring Actuator", severity: "critical", risk: "App config and env exposed" },
      { path: "/actuator/env", name: "Spring Environment", severity: "critical", risk: "Environment variables with secrets" },
      { path: "/_profiler/", name: "Symfony Profiler", severity: "critical", risk: "Full request profiling data" },
      { path: "/metrics", name: "Metrics Endpoint", severity: "medium", risk: "Application metrics exposed" },
      { path: "/health", name: "Health Check", severity: "low", risk: "Health check exposed" },
      { path: "/.well-known/security.txt", name: "Security.txt", severity: "info", risk: "Good practice (positive)" },
      { path: "/Dockerfile", name: "Dockerfile Exposed", severity: "critical", risk: "Container build instructions may reveal secrets" },
      { path: "/docker-compose.yml", name: "Docker Compose Exposed", severity: "critical", risk: "Infrastructure config with credentials" },
      { path: "/config.json", name: "Config JSON", severity: "high", risk: "App config potentially with credentials" },
      { path: "/package.json", name: "Node.js Package JSON", severity: "medium", risk: "Reveals all dependencies and versions" },
      { path: "/composer.json", name: "PHP Composer JSON", severity: "medium", risk: "Reveals PHP dependencies" },
      { path: "/requirements.txt", name: "Python Requirements", severity: "medium", risk: "Reveals Python dependencies" },
    ];

    for (const check of apiPaths) {
      try {
        const r = await fetch(`${baseUrl}${check.path}`, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(5000) });
        if (r.status === 200) {
          const contentType = r.headers.get("content-type") || "";
          const body = await r.text();

          if (check.path === "/.well-known/security.txt") {
            findings.push({ id: `API-${check.path.replace(/[^a-z0-9]/gi, "")}`, test: "Security.txt Found", severity: "info", status: "pass", detail: "security.txt is present — good practice for responsible disclosure" });
            continue;
          }

          // Skip if body looks like soft 404
          if (baselineLen > 0 && isSoft404(body, baselineBody, baselineLen)) continue;

          // Skip data files served as HTML (except swagger which can be HTML)
          const expectsData = [".json", ".yml", ".xml", ".txt"].some(ext => check.path.endsWith(ext));
          if (expectsData && contentType.includes("text/html") && !check.path.includes("swagger")) continue;

          // Content validation: check if body actually contains expected content
          const validator = contentValidators[check.path];
          if (validator && !validator(body)) continue;

          // /health is fine to have, just note it
          if (check.path === "/health") {
            findings.push({ id: `API-${check.path.replace(/[^a-z0-9]/gi, "")}`, test: `Health Check Found`, severity: "info", status: "pass", detail: `Health endpoint is accessible (common and expected).` });
            continue;
          }

          findings.push({ id: `API-${check.path.replace(/[^a-z0-9]/gi, "")}`, test: `Exposed: ${check.name}`, severity: check.severity, status: "fail", detail: `${check.path} is accessible. ${check.risk}`, recommendation: `Block access to ${check.path} in production.`, evidence: { path: check.path, contentType } });
        }
      } catch {}
      await new Promise(r => setTimeout(r, 150));
    }

    // GraphQL introspection
    try {
      const gqlResponse = await fetch(`${baseUrl}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ __schema { types { name } } }" }),
        signal: AbortSignal.timeout(5000),
      });
      if (gqlResponse.status === 200) {
        const gqlData = await gqlResponse.json();
        if (gqlData?.data?.__schema) {
          const typeCount = gqlData.data.__schema.types?.length || 0;
          findings.push({ id: "API-GQL-INTRO", test: "GraphQL Introspection Enabled", severity: "high", status: "fail", detail: `GraphQL introspection is enabled. Found ${typeCount} types. Attackers can map the entire API schema.`, recommendation: "Disable introspection in production: { introspection: false }" });
        }
      }
    } catch {}

    return new Response(JSON.stringify({ success: true, test: "api_discovery", findingsCount: findings.length, findings, checkedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, test: "api_discovery", error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
