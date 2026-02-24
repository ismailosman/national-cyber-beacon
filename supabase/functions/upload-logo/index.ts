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
    // Fetch the logo from the preview public folder
    const logoUrl = "https://id-preview--58e72b13-db11-4c3f-80bd-4bc07f4fe140.lovable.app/logo.png";
    const logoRes = await fetch(logoUrl);
    if (!logoRes.ok) {
      throw new Error(`Failed to fetch logo: ${logoRes.status}`);
    }
    const logoBytes = new Uint8Array(await logoRes.arrayBuffer());

    // Upload to media bucket as logo.png
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/media/logo.png`,
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
    console.log("Upload result:", uploadRes.status, result);

    return new Response(
      JSON.stringify({ success: uploadRes.ok, status: uploadRes.status, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
