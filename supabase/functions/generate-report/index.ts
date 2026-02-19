import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Simple PDF generation using raw PDF syntax
function generatePDF(data: {
  org: any,
  checks: any[],
  alerts: any[],
  history: any[],
  dateFrom: string,
  dateTo: string
}): Uint8Array {
  const { org, checks, alerts, history, dateFrom, dateTo } = data
  const now = new Date().toISOString().split('T')[0]

  const passCount = checks.filter(c => c.result === 'pass').length
  const failCount = checks.filter(c => c.result === 'fail').length
  const warnCount = checks.filter(c => c.result === 'warn').length

  const scoreColor = org.risk_score >= 75 ? '0.2 0.8 0.4' : org.risk_score >= 50 ? '1 0.7 0' : '0.9 0.2 0.2'

  const checkTypeLabels: Record<string, string> = {
    ssl: 'SSL Certificate', https: 'HTTPS Enforcement',
    headers: 'Security Headers', dns: 'DNS Resolution', uptime: 'Uptime Check'
  }

  // Build check rows
  const checkRows = checks.slice(0, 10).map(c =>
    `BT /F1 9 Tf 50 ${0} Td (${checkTypeLabels[c.check_type] || c.check_type}) Tj ET`
  )

  // Build recommendations
  const failedChecks = checks.filter(c => c.result !== 'pass')
  const recMap: Record<string, string> = {
    ssl: 'Renew/fix SSL certificate immediately.',
    https: 'Enable HTTPS redirect on your web server.',
    headers: 'Implement HSTS, CSP, X-Frame-Options headers.',
    dns: 'Review DNS configuration for the domain.',
    uptime: 'Investigate downtime. Add redundant servers.'
  }

  // Create a simple but complete PDF
  const pdfLines: string[] = []

  pdfLines.push(`%PDF-1.4`)
  pdfLines.push(`1 0 obj`)
  pdfLines.push(`<< /Type /Catalog /Pages 2 0 R >>`)
  pdfLines.push(`endobj`)
  pdfLines.push(`2 0 obj`)
  pdfLines.push(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`)
  pdfLines.push(`endobj`)
  pdfLines.push(`3 0 obj`)
  pdfLines.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]`)
  pdfLines.push(`   /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`)
  pdfLines.push(`endobj`)
  pdfLines.push(`4 0 obj`)
  pdfLines.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`)
  pdfLines.push(`endobj`)
  pdfLines.push(`5 0 obj`)
  pdfLines.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`)
  pdfLines.push(`endobj`)

  // Build page content stream
  const contentLines: string[] = []
  contentLines.push(`% Header bar`)
  contentLines.push(`0.05 0.07 0.1 rg`)
  contentLines.push(`0 790 595 52 re f`)
  contentLines.push(`${scoreColor} rg`)
  contentLines.push(`0 0.4 0.6 rg`)
  contentLines.push(`BT`)
  contentLines.push(`/F2 20 Tf`)
  contentLines.push(`1 1 1 rg`)
  contentLines.push(`40 810 Td`)
  contentLines.push(`(SOMALIA CYBER DEFENSE OBSERVATORY) Tj`)
  contentLines.push(`ET`)

  contentLines.push(`BT /F2 11 Tf 1 1 1 rg 40 797 Td (Security Risk Assessment Report) Tj ET`)

  contentLines.push(`% Body`)
  contentLines.push(`0.08 0.1 0.14 rg`)
  contentLines.push(`30 120 535 660 re f`)

  contentLines.push(`0.12 0.15 0.2 rg`)
  contentLines.push(`30 680 535 90 re f`)

  // Organization info
  const orgName = (org.name || '').replace(/[()\\]/g, ' ')
  const domain = (org.domain || '').replace(/[()\\]/g, ' ')
  contentLines.push(`BT /F2 16 Tf 0.9 0.95 1 rg 50 748 Td (${orgName}) Tj ET`)
  contentLines.push(`BT /F1 10 Tf 0.6 0.7 0.8 rg 50 732 Td (${domain} | ${org.sector} | Report: ${dateFrom} to ${dateTo}) Tj ET`)

  // Score box
  contentLines.push(`${scoreColor} rg`)
  contentLines.push(`460 700 105 70 re f`)
  contentLines.push(`BT /F2 32 Tf 0.05 0.07 0.1 rg 478 728 Td (${org.risk_score}) Tj ET`)
  contentLines.push(`BT /F1 9 Tf 0.05 0.07 0.1 rg 487 712 Td (/ 100) Tj ET`)
  contentLines.push(`BT /F2 9 Tf 0.05 0.07 0.1 rg 480 700 Td (${org.status.toUpperCase()}) Tj ET`)

  // Summary stats
  contentLines.push(`BT /F2 11 Tf ${scoreColor} rg 50 670 Td (Security Check Summary) Tj ET`)
  contentLines.push(`0.12 0.15 0.2 rg`)
  contentLines.push(`50 620 130 40 re f`)
  contentLines.push(`200 620 130 40 re f`)
  contentLines.push(`350 620 130 40 re f`)

  contentLines.push(`BT /F2 16 Tf 0.2 0.9 0.4 rg 90 638 Td (${passCount}) Tj ET`)
  contentLines.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 82 625 Td (Checks Passed) Tj ET`)

  contentLines.push(`BT /F2 16 Tf 0.9 0.4 0.2 rg 240 638 Td (${failCount}) Tj ET`)
  contentLines.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 232 625 Td (Checks Failed) Tj ET`)

  contentLines.push(`BT /F2 16 Tf 1 0.8 0 rg 390 638 Td (${warnCount}) Tj ET`)
  contentLines.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 382 625 Td (Warnings) Tj ET`)

  // Check results table
  contentLines.push(`BT /F2 11 Tf ${scoreColor} rg 50 600 Td (Security Check Results) Tj ET`)
  contentLines.push(`0.12 0.15 0.2 rg`)
  contentLines.push(`50 565 480 28 re f`)
  contentLines.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 55 577 Td (CHECK TYPE) Tj ET`)
  contentLines.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 280 577 Td (RESULT) Tj ET`)
  contentLines.push(`BT /F2 9 Tf 0.6 0.7 0.8 rg 380 577 Td (TIMESTAMP) Tj ET`)

  const uniqueChecks = checks.filter((c, i, arr) => arr.findIndex(x => x.check_type === c.check_type) === i).slice(0, 5)
  uniqueChecks.forEach((c, i) => {
    const y = 550 - i * 22
    if (i % 2 === 0) {
      contentLines.push(`0.1 0.13 0.17 rg`)
      contentLines.push(`50 ${y - 6} 480 22 re f`)
    }
    const label = checkTypeLabels[c.check_type] || c.check_type
    const rc = c.result === 'pass' ? '0.2 0.8 0.4' : c.result === 'fail' ? '0.9 0.2 0.2' : '1 0.7 0'
    const ts = c.checked_at ? c.checked_at.substring(0, 16).replace('T', ' ') : now
    contentLines.push(`BT /F1 9 Tf 0.9 0.95 1 rg 55 ${y + 2} Td (${label}) Tj ET`)
    contentLines.push(`BT /F2 9 Tf ${rc} rg 280 ${y + 2} Td (${c.result.toUpperCase()}) Tj ET`)
    contentLines.push(`BT /F1 8 Tf 0.6 0.7 0.8 rg 380 ${y + 2} Td (${ts}) Tj ET`)
  })

  // Recommendations
  const recY = 420
  contentLines.push(`BT /F2 11 Tf ${scoreColor} rg 50 ${recY} Td (Recommendations) Tj ET`)
  
  if (failedChecks.length === 0) {
    contentLines.push(`BT /F1 10 Tf 0.2 0.8 0.4 rg 50 ${recY - 20} Td (All security checks passed. Maintain current security posture.) Tj ET`)
  } else {
    const uniqueFailed = failedChecks.filter((c, i, arr) => arr.findIndex(x => x.check_type === c.check_type) === i).slice(0, 5)
    uniqueFailed.forEach((c, i) => {
      const ry = recY - 20 - i * 25
      const rec = recMap[c.check_type] || 'Review and remediate this security check.'
      contentLines.push(`BT /F2 9 Tf 1 0.7 0 rg 50 ${ry} Td (-> ) Tj ET`)
      contentLines.push(`BT /F1 9 Tf 0.9 0.95 1 rg 62 ${ry} Td (${rec.replace(/[()\\]/g, ' ')}) Tj ET`)
    })
  }

  // Alert count
  const alertY = 200
  contentLines.push(`BT /F2 11 Tf ${scoreColor} rg 50 ${alertY} Td (Alert Summary) Tj ET`)
  contentLines.push(`BT /F1 10 Tf 0.9 0.95 1 rg 50 ${alertY - 18} Td (${alerts.length} total alerts in period. ${alerts.filter((a: any) => !a.is_read).length} unread.) Tj ET`)

  // Footer
  contentLines.push(`0.15 0.19 0.25 rg`)
  contentLines.push(`0 0 595 70 re f`)
  contentLines.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 45 Td (Generated by Somalia Cyber Defense Observatory | ${now} | CONFIDENTIAL - AUTHORIZED PERSONNEL ONLY) Tj ET`)
  contentLines.push(`BT /F1 8 Tf 0.5 0.6 0.7 rg 40 32 Td (This report contains sensitive security information. Handle with appropriate care.) Tj ET`)

  const streamContent = contentLines.join('\n')
  const streamBytes = new TextEncoder().encode(streamContent)

  pdfLines.push(`6 0 obj`)
  pdfLines.push(`<< /Length ${streamBytes.length} >>`)
  pdfLines.push(`stream`)

  const headerPart = new TextEncoder().encode(pdfLines.join('\n') + '\n')
  const midPart = streamBytes
  const endPart = new TextEncoder().encode(`\nendstream\nendobj\n`)

  // Cross-reference
  const xrefOffset = headerPart.length + midPart.length + endPart.length

  const xrefPart = new TextEncoder().encode(
    `xref\n0 7\n0000000000 65535 f \n` +
    Array.from({ length: 6 }, (_, i) => `${String(i * 100).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  )

  // Combine all parts
  const result = new Uint8Array(headerPart.length + midPart.length + endPart.length + xrefPart.length)
  result.set(headerPart, 0)
  result.set(midPart, headerPart.length)
  result.set(endPart, headerPart.length + midPart.length)
  result.set(xrefPart, headerPart.length + midPart.length + endPart.length)

  return result
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { org_id, date_from, date_to } = await req.json()
    if (!org_id) return new Response(JSON.stringify({ error: 'org_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    const [orgData, checksData, alertsData, historyData] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', org_id).single(),
      supabase.from('security_checks').select('*').eq('org_id', org_id)
        .gte('checked_at', date_from || '2020-01-01')
        .lte('checked_at', (date_to || new Date().toISOString().split('T')[0]) + 'T23:59:59')
        .order('checked_at', { ascending: false }),
      supabase.from('alerts').select('*').eq('org_id', org_id)
        .gte('created_at', date_from || '2020-01-01')
        .order('created_at', { ascending: false }),
      supabase.from('risk_score_history').select('*').eq('org_id', org_id)
        .gte('recorded_at', date_from || '2020-01-01')
        .order('recorded_at', { ascending: true }),
    ])

    const pdfBytes = generatePDF({
      org: orgData.data,
      checks: checksData.data || [],
      alerts: alertsData.data || [],
      history: historyData.data || [],
      dateFrom: date_from || 'all time',
      dateTo: date_to || new Date().toISOString().split('T')[0],
    })

    // Convert to base64
    let binary = ''
    for (let i = 0; i < pdfBytes.length; i++) {
      binary += String.fromCharCode(pdfBytes[i])
    }
    const base64 = btoa(binary)

    return new Response(JSON.stringify({ pdf: base64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('generate-report error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
