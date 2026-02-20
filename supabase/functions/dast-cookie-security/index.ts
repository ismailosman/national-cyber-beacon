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

    const response = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });

    const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    const setCookie = response.headers.get("set-cookie") || "";
    const cookies = setCookieHeaders.length > 0 ? setCookieHeaders : (setCookie ? [setCookie] : []);

    if (cookies.length === 0) {
      findings.push({ id: "COOKIE-000", test: "Cookie Presence", severity: "info", status: "info", detail: "No cookies set by the server" });
    }

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const cookieName = cookie.split("=")[0].trim();
      const cookieLower = cookie.toLowerCase();

      if (!cookieLower.includes("secure")) {
        findings.push({ id: `COOKIE-SEC-${i}`, test: `Cookie Missing Secure Flag: ${cookieName}`, severity: "medium", status: "fail",
          detail: `Cookie "${cookieName}" does not have the Secure flag.`,
          recommendation: "Add the Secure flag to all cookies so they are only sent over HTTPS",
          evidence: { cookie: cookieName, rawHeader: cookie.substring(0, 200) },
        });
      }
      if (!cookieLower.includes("httponly")) {
        findings.push({ id: `COOKIE-HTTP-${i}`, test: `Cookie Missing HttpOnly Flag: ${cookieName}`, severity: "medium", status: "fail",
          detail: `Cookie "${cookieName}" does not have the HttpOnly flag. JavaScript can read it.`,
          recommendation: "Add the HttpOnly flag to prevent JavaScript access to the cookie",
          evidence: { cookie: cookieName, rawHeader: cookie.substring(0, 200) },
        });
      }
      if (!cookieLower.includes("samesite")) {
        findings.push({ id: `COOKIE-SAME-${i}`, test: `Cookie Missing SameSite: ${cookieName}`, severity: "low", status: "fail",
          detail: `Cookie "${cookieName}" does not have SameSite attribute.`,
          recommendation: "Add SameSite=Lax or SameSite=Strict to prevent CSRF",
          evidence: { cookie: cookieName, rawHeader: cookie.substring(0, 200) },
        });
      }

      const sessionPatterns = ["session", "sess", "sid", "phpsessid", "jsessionid", "asp.net", "token", "auth"];
      const isSessionCookie = sessionPatterns.some(p => cookieName.toLowerCase().includes(p));
      if (isSessionCookie) {
        const hasSecure = cookieLower.includes("secure");
        const hasHttpOnly = cookieLower.includes("httponly");
        if (!hasSecure || !hasHttpOnly) {
          findings.push({ id: `COOKIE-SESS-${i}`, test: `Insecure Session Cookie: ${cookieName}`, severity: "high", status: "fail",
            detail: `Session cookie "${cookieName}" is missing ${!hasSecure ? "Secure" : ""} ${!hasHttpOnly ? "HttpOnly" : ""} flag(s).`,
            recommendation: "Session cookies MUST have both Secure and HttpOnly flags",
            evidence: { cookie: cookieName, isSession: true, secure: hasSecure, httpOnly: hasHttpOnly },
          });
        }
      }

      if (cookieLower.includes("secure") && cookieLower.includes("httponly") && cookieLower.includes("samesite")) {
        findings.push({ id: `COOKIE-OK-${i}`, test: `Cookie Properly Secured: ${cookieName}`, severity: "info", status: "pass",
          detail: `Cookie "${cookieName}" has Secure, HttpOnly, and SameSite flags set`,
          evidence: { cookie: cookieName },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true, test: "cookie_security", cookiesFound: cookies.length, findingsCount: findings.length, findings,
      checkedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false, test: "cookie_security", error: error.message,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
