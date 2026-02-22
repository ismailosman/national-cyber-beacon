import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    let countryCode = 'unknown';
    let country = 'Unknown';
    let allowed = false;

    if (ip !== 'unknown') {
      try {
        const geo = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,country`);
        const data = await geo.json();
        if (data.status === 'success') {
          countryCode = data.countryCode;
          country = data.country;
          allowed = ['US', 'SO'].includes(countryCode);
        }
      } catch {
        // Geo lookup failed — allow by default to avoid locking out users
        allowed = true;
        country = 'Lookup failed';
      }
    } else {
      // Can't determine IP — allow to avoid locking out
      allowed = true;
    }

    return new Response(
      JSON.stringify({ ip, country_code: countryCode, country_name: country, allowed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
