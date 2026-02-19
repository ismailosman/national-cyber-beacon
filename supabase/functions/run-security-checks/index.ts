import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface CheckResult {
  check_type: string
  result: 'pass' | 'fail' | 'warn'
  details: Record<string, unknown>
}

async function checkUptime(domain: string): Promise<CheckResult> {
  try {
    const url = `https://${domain}`
    const resp = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000) })
    if (resp.ok || resp.status < 400) {
      return { check_type: 'uptime', result: 'pass', details: { status: resp.status, url } }
    }
    return { check_type: 'uptime', result: 'fail', details: { status: resp.status, url } }
  } catch (err: any) {
    return { check_type: 'uptime', result: 'fail', details: { error: err.message } }
  }
}

async function checkHTTPS(domain: string): Promise<CheckResult> {
  try {
    // Check if HTTP redirects to HTTPS
    const httpUrl = `http://${domain}`
    const resp = await fetch(httpUrl, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) })
    const location = resp.headers.get('location') || ''
    if (location.startsWith('https://') || resp.status === 301 || resp.status === 308) {
      return { check_type: 'https', result: 'pass', details: { redirected: true, status: resp.status } }
    }
    if (resp.status >= 200 && resp.status < 400) {
      return { check_type: 'https', result: 'warn', details: { redirected: false, status: resp.status, note: 'HTTP served without redirect' } }
    }
    return { check_type: 'https', result: 'pass', details: { note: 'HTTPS likely enforced', status: resp.status } }
  } catch (err: any) {
    // If connection refused on HTTP, HTTPS is probably enforced
    return { check_type: 'https', result: 'warn', details: { error: err.message, note: 'Could not verify redirect' } }
  }
}

async function checkSSL(domain: string): Promise<CheckResult> {
  try {
    const resp = await fetch(`https://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
    // If we got here, SSL is valid
    return {
      check_type: 'ssl',
      result: 'pass',
      details: { valid: true, note: 'SSL handshake successful', status: resp.status }
    }
  } catch (err: any) {
    const msg = err.message || ''
    if (msg.includes('cert') || msg.includes('ssl') || msg.includes('SSL') || msg.includes('certificate')) {
      return { check_type: 'ssl', result: 'fail', details: { error: err.message, note: 'SSL certificate error' } }
    }
    // Other errors might just be network issues
    return { check_type: 'ssl', result: 'warn', details: { error: err.message, note: 'Could not verify SSL' } }
  }
}

async function checkHeaders(domain: string): Promise<CheckResult> {
  const requiredHeaders = ['strict-transport-security', 'x-frame-options', 'x-content-type-options', 'content-security-policy']
  try {
    const resp = await fetch(`https://${domain}`, { method: 'GET', signal: AbortSignal.timeout(10000) })
    const found: string[] = []
    const missing: string[] = []
    for (const h of requiredHeaders) {
      if (resp.headers.get(h)) found.push(h)
      else missing.push(h)
    }
    if (missing.length === 0) return { check_type: 'headers', result: 'pass', details: { found, missing } }
    if (missing.length <= 2) return { check_type: 'headers', result: 'warn', details: { found, missing } }
    return { check_type: 'headers', result: 'fail', details: { found, missing } }
  } catch (err: any) {
    return { check_type: 'headers', result: 'warn', details: { error: err.message } }
  }
}

async function checkDNS(domain: string): Promise<CheckResult> {
  try {
    // DNS check via Cloudflare's DNS-over-HTTPS
    const resp = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(8000)
    })
    const data = await resp.json()
    if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
      return { check_type: 'dns', result: 'pass', details: { records: data.Answer.map((a: any) => a.data) } }
    }
    return { check_type: 'dns', result: 'fail', details: { status: data.Status, note: 'Domain does not resolve' } }
  } catch (err: any) {
    return { check_type: 'dns', result: 'warn', details: { error: err.message } }
  }
}

function calculateRiskScore(checks: CheckResult[]): number {
  const weights: Record<string, number> = {
    ssl: 15,
    headers: 15,
    uptime: 10,
    https: 20,
    dns: 20,
  }
  const resultValues = { pass: 1.0, warn: 0.5, fail: 0.0 }
  let total = 0
  let maxTotal = 0

  for (const check of checks) {
    const w = weights[check.check_type] || 10
    const v = resultValues[check.result] ?? 0
    total += w * v
    maxTotal += w
  }

  const vulnerabilityBonus = 20 // We give 20% for general vulnerability posture (placeholder)
  const threatBonus = 20 // Threat activity (placeholder — calculated as avg of other checks)
  const avgChecks = maxTotal > 0 ? (total / maxTotal) : 0.5
  const finalScore = (total + vulnerabilityBonus * avgChecks + threatBonus * avgChecks) / (maxTotal + 40)
  return Math.max(0, Math.min(100, Math.round(finalScore * 100)))
}

function getStatus(score: number): string {
  if (score >= 75) return 'Secure'
  if (score >= 50) return 'Warning'
  return 'Critical'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { org_id } = body

    if (!org_id) return new Response(JSON.stringify({ error: 'org_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    // Fetch organization
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', org_id)
      .single()

    if (orgErr || !org) return new Response(JSON.stringify({ error: 'Organization not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    const domain = org.domain

    // Run all checks in parallel
    const [ssl, https, headers, dns, uptime] = await Promise.all([
      checkSSL(domain),
      checkHTTPS(domain),
      checkHeaders(domain),
      checkDNS(domain),
      checkUptime(domain),
    ])

    const checks: CheckResult[] = [ssl, https, headers, dns, uptime]

    // Store results
    const checkedAt = new Date().toISOString()
    await supabase.from('security_checks').insert(
      checks.map(c => ({ org_id, check_type: c.check_type, result: c.result, details: c.details, checked_at: checkedAt }))
    )

    // Calculate and update risk score
    const riskScore = calculateRiskScore(checks)
    const status = getStatus(riskScore)

    await supabase.from('organizations').update({
      risk_score: riskScore,
      status,
      last_scanned_at: checkedAt,
    }).eq('id', org_id)

    // Store score history
    await supabase.from('risk_score_history').insert({ org_id, score: riskScore, recorded_at: checkedAt })

    // Generate alerts
    const alertsToCreate: Array<{ org_id: string; type: string; severity: string; message: string }> = []

    if (riskScore < 60) {
      alertsToCreate.push({
        org_id, type: 'risk_score_drop', severity: riskScore < 40 ? 'critical' : 'high',
        message: `${org.name} risk score dropped to ${riskScore}/100. Immediate review required.`
      })
    }

    if (ssl.result === 'fail') {
      alertsToCreate.push({
        org_id, type: 'ssl_failure', severity: 'critical',
        message: `${org.name}: SSL certificate validation failed on ${domain}. Communications may be unencrypted.`
      })
    }

    if (headers.result === 'fail') {
      const missing = (headers.details as any)?.missing || []
      alertsToCreate.push({
        org_id, type: 'missing_headers', severity: 'high',
        message: `${org.name}: Critical security headers missing: ${missing.join(', ')}`
      })
    }

    if (uptime.result === 'fail') {
      alertsToCreate.push({
        org_id, type: 'website_offline', severity: 'critical',
        message: `${org.name}: Website ${domain} is offline or returning errors.`
      })
    }

    if (alertsToCreate.length > 0) {
      await supabase.from('alerts').insert(alertsToCreate)
    }

    return new Response(JSON.stringify({ success: true, org_id, risk_score: riskScore, status, checks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('run-security-checks error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
