import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: orgs, error } = await supabase.from('organizations').select('id, name, domain')
    if (error) throw error

    console.log(`Scheduled scan: processing ${orgs?.length || 0} organizations`)

    const results: Array<{ org: string; success: boolean; error?: string }> = []

    for (const org of (orgs || [])) {
      try {
        const resp = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/run-security-checks`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ org_id: org.id }),
          }
        )
        if (resp.ok) results.push({ org: org.name, success: true })
        else {
          const err = await resp.text()
          results.push({ org: org.name, success: false, error: err })
        }
      } catch (err: any) {
        results.push({ org: org.name, success: false, error: err.message })
      }
    }

    console.log('Scheduled scan complete:', results)

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('scheduled-scan error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
