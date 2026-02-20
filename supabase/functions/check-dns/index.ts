const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function resolveDNS(domain: string, type: string): Promise<string[]> {
  try {
    const resp = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`);
    const data = await resp.json();
    if (data.Answer) {
      return data.Answer.map((a: any) => a.data?.replace(/\.$/,'') || a.data);
    }
    return [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domains } = await req.json();
    if (!domains || !Array.isArray(domains)) {
      return new Response(JSON.stringify({ error: 'domains array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = await Promise.all(domains.map(async (domain: string) => {
      try {
        const [aRecords, aaaaRecords, mxRecords, nsRecords, txtRecords, cnameRecords] = await Promise.all([
          resolveDNS(domain, 'A'),
          resolveDNS(domain, 'AAAA'),
          resolveDNS(domain, 'MX'),
          resolveDNS(domain, 'NS'),
          resolveDNS(domain, 'TXT'),
          resolveDNS(domain, 'CNAME'),
        ]);

        // Email security checks
        const spfRecord = txtRecords.find(r => r.toLowerCase().includes('v=spf1')) || null;
        const dmarcRecords = await resolveDNS(`_dmarc.${domain}`, 'TXT');
        const dmarcRecord = dmarcRecords.find(r => r.toLowerCase().includes('v=dmarc1')) || null;
        let dmarcPolicy = null;
        if (dmarcRecord) {
          const pMatch = dmarcRecord.match(/p=(\w+)/i);
          dmarcPolicy = pMatch ? pMatch[1] : null;
        }

        // DKIM check on common selectors
        let dkimFound = false;
        for (const selector of ['google', 'default', 'selector1', 'selector2', 'k1']) {
          const dkimRecords = await resolveDNS(`${selector}._domainkey.${domain}`, 'TXT');
          if (dkimRecords.length > 0) {
            dkimFound = true;
            break;
          }
        }

        return {
          domain,
          records: {
            A: aRecords,
            AAAA: aaaaRecords,
            MX: mxRecords,
            NS: nsRecords,
            CNAME: cnameRecords,
            TXT: txtRecords,
          },
          emailSecurity: {
            spfExists: !!spfRecord,
            spfRecord,
            dmarcExists: !!dmarcRecord,
            dmarcRecord,
            dmarcPolicy,
            dkimFound,
          },
          error: null,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          domain,
          records: { A: [], AAAA: [], MX: [], NS: [], CNAME: [], TXT: [] },
          emailSecurity: { spfExists: false, spfRecord: null, dmarcExists: false, dmarcRecord: null, dmarcPolicy: null, dkimFound: false },
          error: err instanceof Error ? err.message : 'Check failed',
          checkedAt: new Date().toISOString(),
        };
      }
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
