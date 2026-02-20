const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SslResult {
  url: string;
  ssl: {
    isValid: boolean;
    isExpired: boolean;
    isExpiringSoon: boolean;
    issuer: string | null;
    protocol: string | null;
    validFrom: string | null;
    validTo: string | null;
    daysUntilExpiry: number | null;
  };
}

async function checkSsl(url: string): Promise<SslResult> {
  const defaultResult: SslResult = {
    url,
    ssl: {
      isValid: false,
      isExpired: false,
      isExpiringSoon: false,
      issuer: null,
      protocol: null,
      validFrom: null,
      validTo: null,
      daysUntilExpiry: null,
    },
  };

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return defaultResult;
  }

  // Step 1: Basic HTTPS fetch to check if SSL is valid
  let isValid = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    isValid = true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Certificate errors indicate invalid SSL
    if (
      errorMsg.includes("certificate") ||
      errorMsg.includes("SSL") ||
      errorMsg.includes("TLS")
    ) {
      isValid = false;
    }
    // Network errors (timeout, DNS) - we'll still try the API
  }

  // Step 2: Try public SSL API for certificate details
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const apiRes = await fetch(
      `https://api.certspotter.com/v1/issuances?domain=${hostname}&include_subdomains=true&expand=dns_names&expand=cert`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }
    );
    clearTimeout(timeout);

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data) && data.length > 0) {
        // Get the most recent certificate
        const latest = data[0];
        const notBefore = latest.cert?.not_before || latest.not_before;
        const notAfter = latest.cert?.not_after || latest.not_after;
        const issuerName = latest.cert?.issuer?.O || latest.issuer || null;

        if (notAfter) {
          const expiryDate = new Date(notAfter);
          const now = new Date();
          const diffMs = expiryDate.getTime() - now.getTime();
          const daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const isExpired = daysUntilExpiry < 0;
          const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;

          return {
            url,
            ssl: {
              isValid: isValid && !isExpired,
              isExpired,
              isExpiringSoon,
              issuer: issuerName,
              protocol: "TLS",
              validFrom: notBefore || null,
              validTo: notAfter,
              daysUntilExpiry,
            },
          };
        }
      }
      // If API returned empty array, consume is done
    } else {
      await apiRes.text(); // consume body
    }
  } catch {
    // API unavailable, fall back to basic check
  }

  // Step 3: Try alternative - ssl-checker.io
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const apiRes = await fetch(
      `https://ssl-checker.io/api/v1/check/${hostname}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }
    );
    clearTimeout(timeout);

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.result) {
        const r = data.result;
        const validTo = r.valid_till || r.valid_to || null;
        const validFrom = r.valid_from || null;
        const issuer = r.issuer || r.issuer_o || null;

        let daysUntilExpiry: number | null = null;
        let isExpired = false;
        let isExpiringSoon = false;

        if (validTo) {
          const expiryDate = new Date(validTo);
          const now = new Date();
          const diffMs = expiryDate.getTime() - now.getTime();
          daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          isExpired = daysUntilExpiry < 0;
          isExpiringSoon = !isExpired && daysUntilExpiry <= 30;
        }

        return {
          url,
          ssl: {
            isValid: isValid && !isExpired,
            isExpired,
            isExpiringSoon,
            issuer,
            protocol: r.protocol || "TLS",
            validFrom,
            validTo,
            daysUntilExpiry,
          },
        };
      }
    } else {
      await apiRes.text();
    }
  } catch {
    // Also failed, use basic check only
  }

  // Fallback: only basic fetch result
  return {
    url,
    ssl: {
      ...defaultResult.ssl,
      isValid,
    },
  };
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

    // Process in batches of 5 to avoid rate limiting
    const results: SslResult[] = [];
    for (let i = 0; i < urls.length; i += 5) {
      const batch = urls.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(checkSsl));
      results.push(...batchResults);
    }

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
