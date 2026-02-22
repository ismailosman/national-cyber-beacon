import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PingResult {
  url: string;
  status: "up" | "down";
  responseTime: number | null;
  statusCode: number | null;
  checkedAt: string;
}

async function pingUrl(url: string): Promise<PingResult> {
  const checkedAt = new Date().toISOString();
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    // If HEAD returns 403 or 405, retry with GET (many WAFs/Cloudflare block HEAD)
    if (res.status === 403 || res.status === 405) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 10000);
      res = await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        redirect: "follow",
      });
      clearTimeout(timeout2);
    } else {
      clearTimeout(timeout);
    }

    const responseTime = Date.now() - start;
    // Server is "up" if it responds with anything other than 5xx
    const isUp = res.status < 500;
    return { url, status: isUp ? "up" : "down", responseTime, statusCode: res.status, checkedAt };
  } catch {
    return { url, status: "down", responseTime: null, statusCode: null, checkedAt };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const urls: string[] = body.urls || (body.url ? [body.url] : []);

    if (urls.length === 0) {
      return new Response(JSON.stringify({ error: "No URLs provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(urls.map(pingUrl));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
