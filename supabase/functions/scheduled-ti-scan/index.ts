import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: rawOrgs, error } = await supabase
      .from('organizations')
      .select('id, name, domain, sector')

    const orgs = (rawOrgs || []).map((o: any) => ({ ...o, url: o.domain.startsWith('http') ? o.domain : `https://${o.domain}` }))

    if (error) throw error

    console.log(`scheduled-ti-scan: processing ${orgs?.length || 0} organizations`)

    const results: Array<{ org: string; checks: Record<string, boolean> }> = []
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    }

    for (const org of (orgs || [])) {
      const checkResults: Record<string, boolean> = {}
      const domain = new URL(org.url).hostname

      // Fingerprint tech
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/fingerprint-tech`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ urls: [org.url] }),
        })
        checkResults.fingerprint = resp.ok
      } catch { checkResults.fingerprint = false }

      // Check phishing domains
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/check-phishing-domains`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ organizations: [{ id: org.id, name: org.name, domain }] }),
        })
        checkResults.phishing = resp.ok
      } catch { checkResults.phishing = false }

      // Check breaches
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/check-breaches`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ domains: [domain] }),
        })
        checkResults.breaches = resp.ok
      } catch { checkResults.breaches = false }

      // Check defacement
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/check-defacement`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ urls: [org.url] }),
        })
        checkResults.defacement = resp.ok
      } catch { checkResults.defacement = false }

      // Check DNS
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/check-dns`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ urls: [org.url] }),
        })
        checkResults.dns = resp.ok
      } catch { checkResults.dns = false }

      // Check blacklist
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/check-blacklist`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ urls: [org.url] }),
        })
        checkResults.blacklist = resp.ok
      } catch { checkResults.blacklist = false }

      // Check security headers
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/check-security-headers`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ urls: [org.url] }),
        })
        checkResults.headers = resp.ok
      } catch { checkResults.headers = false }

      results.push({ org: org.name, checks: checkResults })

      // 3-second delay between orgs to avoid rate limiting
      await delay(3000)
    }

    console.log('scheduled-ti-scan complete:', JSON.stringify(results))

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('scheduled-ti-scan error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
