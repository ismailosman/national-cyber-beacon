const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PortInfo {
  port: number;
  service: string;
  risk: 'critical' | 'medium';
}

const PORTS_TO_CHECK: PortInfo[] = [
  { port: 21, service: 'FTP', risk: 'medium' },
  { port: 22, service: 'SSH', risk: 'medium' },
  { port: 3306, service: 'MySQL', risk: 'critical' },
  { port: 5432, service: 'PostgreSQL', risk: 'critical' },
  { port: 3389, service: 'RDP', risk: 'critical' },
  { port: 8080, service: 'HTTP-Alt', risk: 'medium' },
  { port: 8443, service: 'HTTPS-Alt', risk: 'medium' },
  { port: 27017, service: 'MongoDB', risk: 'critical' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hostnames } = await req.json();
    if (!hostnames || !Array.isArray(hostnames)) {
      return new Response(JSON.stringify({ error: 'hostnames array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = await Promise.all(hostnames.map(async (hostname: string) => {
      const openPorts: PortInfo[] = [];
      let portsAvailable = true;

      for (const portInfo of PORTS_TO_CHECK) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          await fetch(`http://${hostname}:${portInfo.port}/`, {
            method: 'HEAD',
            signal: controller.signal,
          });
          clearTimeout(timeout);
          openPorts.push(portInfo);
        } catch (e: any) {
          const msg = e?.message?.toLowerCase() || '';
          // If Deno blocks non-standard ports entirely, mark as unavailable
          if (msg.includes('not supported') || msg.includes('denied') || msg.includes('permission')) {
            portsAvailable = false;
            break;
          }
          // Otherwise connection refused/timeout = port closed (good)
        }
      }

      return {
        hostname,
        openPorts: portsAvailable ? openPorts : [],
        totalOpen: portsAvailable ? openPorts.length : 0,
        criticalPorts: portsAvailable ? openPorts.filter(p => p.risk === 'critical').length : 0,
        portsAvailable,
        note: portsAvailable ? null : 'Port scanning not available from Edge Functions',
        checkedAt: new Date().toISOString(),
      };
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
