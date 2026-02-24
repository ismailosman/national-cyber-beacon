import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// The logo is embedded as base64 from the uploaded file
// We fetch it from the preview URL's public folder
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseUrl = "https://id-preview--58e72b13-db11-4c3f-80bd-4bc07f4fe140.lovable.app";
    const logos = [
      { src: `${baseUrl}/logo.png`, dest: "logo.png" },
      { src: `${baseUrl}/assets/logo-circle.png`, dest: "logo-circle.png" },
    ];

    const results = [];
    for (const { src, dest } of logos) {
      const logoRes = await fetch(src);
      if (!logoRes.ok) {
        results.push({ dest, error: `Failed to fetch: ${logoRes.status}` });
        continue;
      }
      const logoBytes = new Uint8Array(await logoRes.arrayBuffer());

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/media/${dest}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "image/png",
            "x-upsert": "true",
          },
          body: logoBytes,
        }
      );
      const result = await uploadRes.text();
      console.log(`Upload ${dest}:`, uploadRes.status, result);
      results.push({ dest, success: uploadRes.ok, status: uploadRes.status });
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
