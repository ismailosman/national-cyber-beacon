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
    return { check_type: 'https', result: 'warn', details: { error: err.message, note: 'Could not verify redirect' } }
  }
}

async function checkSSL(domain: string): Promise<CheckResult> {
  try {
    const resp = await fetch(`https://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
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

// ── NEW: DDoS Detection via multi-probe latency + behavior analysis ──
async function checkDDoS(domain: string): Promise<CheckResult> {
  const url = `https://${domain}`
  const probes: { ms: number; status: number | null; ok: boolean }[] = []

  // 3 sequential HEAD probes — measure latency and status consistency
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    try {
      const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      probes.push({ ms: Date.now() - t0, status: r.status, ok: r.status < 500 })
    } catch {
      probes.push({ ms: Date.now() - t0, status: null, ok: false })
    }
  }

  const avgMs = probes.reduce((s, p) => s + p.ms, 0) / probes.length
  const failures = probes.filter(p => !p.ok).length
  const statuses = probes.map(p => p.status)
  const has503 = statuses.some(s => s === 503)
  const has429 = statuses.some(s => s === 429)
  const hasCloudflareError = statuses.some(s => s !== null && s >= 520 && s <= 530)
  const maxMs = Math.max(...probes.map(p => p.ms))
  const minMs = Math.min(...probes.map(p => p.ms))
  const variance = maxMs - minMs
  // Inconsistent status codes across identical probes = instability signal
  const uniqueStatuses = new Set(statuses.filter(s => s !== null)).size
  const statusInconsistent = uniqueStatuses > 1

  if (failures >= 2) {
    return {
      check_type: 'ddos', result: 'fail', details: {
        note: 'Multiple probe failures — service may be down or under DDoS attack',
        avg_response_ms: Math.round(avgMs), failures, statuses
      }
    }
  }
  if (has503 || hasCloudflareError) {
    return {
      check_type: 'ddos', result: 'warn', details: {
        note: 'DDoS protection triggered (503/52x) — possible attack in progress',
        avg_response_ms: Math.round(avgMs), statuses
      }
    }
  }
  if (has429) {
    return {
      check_type: 'ddos', result: 'warn', details: {
        note: 'Rate limiting active — possible volumetric attack',
        avg_response_ms: Math.round(avgMs), statuses
      }
    }
  }
  if (avgMs > 4000 || variance > 3000) {
    return {
      check_type: 'ddos', result: 'warn', details: {
        note: 'High latency or variance detected — possible degradation under load',
        avg_response_ms: Math.round(avgMs), variance_ms: variance
      }
    }
  }
  if (statusInconsistent) {
    return {
      check_type: 'ddos', result: 'warn', details: {
        note: 'Inconsistent response codes across probes — service instability detected',
        statuses, avg_response_ms: Math.round(avgMs)
      }
    }
  }
  return {
    check_type: 'ddos', result: 'pass', details: {
      note: 'No DDoS indicators detected',
      avg_response_ms: Math.round(avgMs),
      probes: probes.length
    }
  }
}

// ── NEW: WAF / CDN Protection Detection ──
async function checkWAF(domain: string): Promise<CheckResult> {
  try {
    const resp = await fetch(`https://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
    const wafHeaders = ['cf-ray', 'x-cache', 'x-amz-cf-id', 'x-akamai-request-id', 'x-sucuri-id', 'x-cdn', 'x-firewall']
    const found = wafHeaders.filter(h => resp.headers.get(h))
    const server = resp.headers.get('server') || ''
    const via = resp.headers.get('via') || ''
    const isCDN = server.toLowerCase().includes('cloudflare')
      || server.toLowerCase().includes('akamai')
      || via.toLowerCase().includes('cloudflare')
      || via.toLowerCase().includes('akamai')

    if (found.length > 0 || isCDN) {
      return {
        check_type: 'waf', result: 'pass', details: {
          note: 'CDN/WAF protection detected',
          indicators: found, server, via: via || undefined
        }
      }
    }
    return {
      check_type: 'waf', result: 'warn', details: {
        note: 'No WAF/CDN protection headers detected — site may be directly exposed',
        recommendation: 'Consider Cloudflare or similar CDN/WAF for DDoS mitigation',
        server: server || 'unknown'
      }
    }
  } catch (err: any) {
    return { check_type: 'waf', result: 'warn', details: { error: err.message, note: 'Could not verify WAF protection' } }
  }
}

// ── NEW: Dangerous HTTP Methods Check ──
async function checkHTTPMethods(domain: string): Promise<CheckResult> {
  try {
    const resp = await fetch(`https://${domain}`, { method: 'OPTIONS', signal: AbortSignal.timeout(8000) })
    const allow = resp.headers.get('allow') || resp.headers.get('Access-Control-Allow-Methods') || ''
    const dangerousMethods = ['TRACE', 'DELETE', 'PUT', 'CONNECT']
    const enabledDangerous = dangerousMethods.filter(m => allow.toUpperCase().includes(m))

    if (enabledDangerous.length > 0) {
      return {
        check_type: 'http_methods', result: 'warn', details: {
          note: 'Potentially dangerous HTTP methods enabled',
          dangerous_methods: enabledDangerous, allow
        }
      }
    }
    return {
      check_type: 'http_methods', result: 'pass', details: {
        note: 'No dangerous HTTP methods detected',
        allow: allow || 'Not disclosed'
      }
    }
  } catch (err: any) {
    return { check_type: 'http_methods', result: 'pass', details: { note: 'OPTIONS not responded — methods likely restricted', error: err.message } }
  }
}

// ── NEW: Cookie Security Check ──
async function checkCookieSecurity(domain: string): Promise<CheckResult> {
  try {
    const resp = await fetch(`https://${domain}`, { method: 'GET', signal: AbortSignal.timeout(10000) })
    const cookies = resp.headers.getSetCookie ? resp.headers.getSetCookie() : []
    const setCookie = resp.headers.get('set-cookie') || ''

    // If no cookies set, nothing to check
    if (cookies.length === 0 && !setCookie) {
      return {
        check_type: 'cookie_security', result: 'pass', details: {
          note: 'No cookies set — nothing to evaluate'
        }
      }
    }

    const cookieStr = cookies.join('; ') || setCookie
    const hasSecure = cookieStr.toLowerCase().includes('secure')
    const hasHttpOnly = cookieStr.toLowerCase().includes('httponly')
    const hasSameSite = cookieStr.toLowerCase().includes('samesite')

    const missing: string[] = []
    if (!hasSecure) missing.push('Secure')
    if (!hasHttpOnly) missing.push('HttpOnly')
    if (!hasSameSite) missing.push('SameSite')

    if (missing.length === 0) {
      return { check_type: 'cookie_security', result: 'pass', details: { note: 'All cookie security flags present', flags: ['Secure', 'HttpOnly', 'SameSite'] } }
    }
    if (missing.length === 1) {
      return { check_type: 'cookie_security', result: 'warn', details: { note: `Missing cookie flag: ${missing.join(', ')}`, missing } }
    }
    return { check_type: 'cookie_security', result: 'fail', details: { note: `Multiple cookie security flags missing: ${missing.join(', ')}`, missing } }
  } catch (err: any) {
    return { check_type: 'cookie_security', result: 'warn', details: { error: err.message, note: 'Could not evaluate cookie security' } }
  }
}

function calculateRiskScore(checks: CheckResult[]): number {
  const weights: Record<string, number> = {
    ssl: 15,
    headers: 12,
    uptime: 10,
    https: 10,
    dns: 10,
    ddos: 20,           // highest weight — active attack indicator
    waf: 10,
    http_methods: 5,
    cookie_security: 5,
    open_ports: 3,
  }
  const resultValues = { pass: 1.0, warn: 0.5, fail: 0.0 }
  let total = 0
  let maxTotal = 0

  for (const check of checks) {
    const w = weights[check.check_type] || 5
    const v = resultValues[check.result] ?? 0
    total += w * v
    maxTotal += w
  }

  if (maxTotal === 0) return 50
  const score = Math.round((total / maxTotal) * 100)
  return Math.max(0, Math.min(100, score))
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

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', org_id)
      .single()

    if (orgErr || !org) return new Response(JSON.stringify({ error: 'Organization not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    const domain = org.domain

    // Run all checks in parallel — DDoS probes are sequential internally but all checks run concurrently
    const [ssl, https, headers, dns, uptime, ddos, waf, httpMethods, cookieSecurity] = await Promise.all([
      checkSSL(domain),
      checkHTTPS(domain),
      checkHeaders(domain),
      checkDNS(domain),
      checkUptime(domain),
      checkDDoS(domain),
      checkWAF(domain),
      checkHTTPMethods(domain),
      checkCookieSecurity(domain),
    ])

    const checks: CheckResult[] = [ssl, https, headers, dns, uptime, ddos, waf, httpMethods, cookieSecurity]

    // Fetch or create website asset for security_checks FK requirement
    let assetId: string
    const { data: existingAssets } = await supabase
      .from('assets')
      .select('id')
      .eq('organization_id', org_id)
      .eq('asset_type', 'website')
      .limit(1)

    if (existingAssets && existingAssets.length > 0) {
      assetId = existingAssets[0].id
    } else {
      const { data: newAsset, error: assetErr } = await supabase
        .from('assets')
        .insert({
          organization_id: org_id,
          asset_type: 'website',
          url: `https://${domain}`,
          is_critical: true,
        })
        .select('id')
        .single()

      if (assetErr || !newAsset) {
        console.error('Failed to create asset:', assetErr)
        return new Response(JSON.stringify({ error: 'Failed to create asset for org' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      assetId = newAsset.id
    }

    const checkedAt = new Date().toISOString()
    const { error: scErr } = await supabase.from('security_checks').insert(
      checks.map(c => ({
        asset_id: assetId,
        check_type: c.check_type,
        status: c.result,
        score: c.result === 'pass' ? 100 : c.result === 'warn' ? 50 : 0,
        details: c.details,
        checked_at: checkedAt,
      }))
    )
    if (scErr) console.error('security_checks insert error:', scErr)

    const riskScore = calculateRiskScore(checks)
    const status = getStatus(riskScore)

    const [orgUpdateResult, rhResult] = await Promise.all([
      supabase.from('organizations').update({
        risk_score: riskScore,
        status,
        last_scan: checkedAt,
      }).eq('id', org_id),
      supabase.from('risk_history').insert({
        organization_id: org_id,
        score: riskScore,
      })
    ])
    if (orgUpdateResult.error) console.error('organizations update error:', orgUpdateResult.error)
    if (rhResult.error) console.error('risk_history insert error:', rhResult.error)

    // Alert generation — de-duped by checking recent alerts
    const alertsToCreate: Array<{
      organization_id: string
      title: string
      description: string
      severity: string
      source: string
      status: string
      is_read: boolean
    }> = []

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentAlerts } = await supabase
      .from('alerts')
      .select('title')
      .eq('organization_id', org_id)
      .gte('created_at', since24h)

    const recentTitles = new Set((recentAlerts || []).map((a: any) => a.title))

    const maybeAlert = (alert: typeof alertsToCreate[0]) => {
      if (!recentTitles.has(alert.title)) alertsToCreate.push(alert)
    }

    // DDoS alerts (highest priority)
    if (ddos.result === 'fail') {
      maybeAlert({
        organization_id: org_id,
        title: `DDoS Attack Detected: ${org.name}`,
        description: `${org.name}: Multiple probe failures detected on ${domain}. The service appears to be down or under an active DDoS attack. Immediate action required.`,
        severity: 'critical',
        source: 'scanner',
        status: 'open',
        is_read: false,
      })
    } else if (ddos.result === 'warn') {
      maybeAlert({
        organization_id: org_id,
        title: `DDoS Warning: ${org.name}`,
        description: `${org.name}: Anomalous response patterns detected on ${domain}. Possible DDoS activity or service degradation in progress.`,
        severity: 'high',
        source: 'scanner',
        status: 'open',
        is_read: false,
      })
    }

    // WAF missing alert
    if (waf.result === 'warn') {
      maybeAlert({
        organization_id: org_id,
        title: `No DDoS Protection: ${org.name}`,
        description: `${org.name}: No WAF or CDN protection detected on ${domain}. The site is directly exposed with no DDoS mitigation layer.`,
        severity: 'medium',
        source: 'scanner',
        status: 'open',
        is_read: false,
      })
    }

    // Risk score drop alert
    if (riskScore < 60) {
      maybeAlert({
        organization_id: org_id,
        title: `Risk Score Drop: ${org.name}`,
        description: `${org.name} risk score dropped to ${riskScore}/100. Immediate review recommended.`,
        severity: riskScore < 40 ? 'critical' : 'high',
        source: 'scanner',
        status: 'open',
        is_read: false,
      })
    }

    // SSL failure
    if (ssl.result === 'fail') {
      maybeAlert({
        organization_id: org_id,
        title: `SSL Certificate Failure: ${org.name}`,
        description: `${org.name}: SSL certificate validation failed on ${domain}. Communications may be unencrypted.`,
        severity: 'critical',
        source: 'scanner',
        status: 'open',
        is_read: false,
      })
    }

    // Security headers failure
    if (headers.result === 'fail') {
      const missing = (headers.details as any)?.missing || []
      maybeAlert({
        organization_id: org_id,
        title: `Missing Security Headers: ${org.name}`,
        description: `${org.name}: Critical security headers missing: ${missing.join(', ')}`,
        severity: 'high',
        source: 'scanner',
        status: 'open',
        is_read: false,
      })
    }

    // Uptime failure
    if (uptime.result === 'fail') {
      maybeAlert({
        organization_id: org_id,
        title: `Website Offline: ${org.name}`,
        description: `${org.name}: Website ${domain} is offline or returning errors.`,
        severity: 'critical',
        source: 'scanner',
        status: 'open',
        is_read: false,
      })
    }

    if (alertsToCreate.length > 0) {
      const { error: alertErr } = await supabase.from('alerts').insert(alertsToCreate)
      if (alertErr) console.error('alerts insert error:', alertErr)
    }

    return new Response(JSON.stringify({
      success: true, org_id, risk_score: riskScore, status,
      checks: checks.map(c => ({ type: c.check_type, result: c.result, details: c.details }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('run-security-checks error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
