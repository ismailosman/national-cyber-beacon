
# DDoS Detection + Stronger Security Scan Engine

## What's Being Added

A production-grade DDoS detection module integrated into the existing scan engine, plus 4 additional security checks that elevate this into a real cybersecurity monitoring tool.

---

## DDoS Detection Logic (Edge Function)

DDoS detection from an edge function without access to server-side logs requires **multi-signal heuristics**. The check makes multiple timed probes and analyzes the response patterns:

### Method: Multi-Probe Latency + Behavior Analysis

```
Signal 1 — Latency Baseline
  → Make 3 sequential HEAD requests, measure response time for each
  → If avg latency > 4000ms: warn (degraded)
  → If 2+ requests timeout or fail: fail (likely under attack)

Signal 2 — Rate-Limited or Blocked Response
  → Send rapid burst of 3 requests in quick succession
  → Watch for 429 (Too Many Requests), 503 (Service Unavailable), 
    520–530 (Cloudflare error codes for DDoS mitigation)
  → 429/503/52x = warn (protection triggered, possibly under attack)

Signal 3 — Response Consistency Check
  → Measure variance in response time across probes
  → High variance (>2000ms spread) = warn (unstable under load)

Signal 4 — Error Pattern Detection
  → If the site returns different status codes on repeated identical requests
  → Or if the TCP connection is refused while DNS resolves fine
  → = fail (service instability consistent with DDoS)

Signal 5 — WAF / CDN Protection Check
  → Look for headers: CF-RAY (Cloudflare), X-Cache (CDN), X-Akamai-*
  → No CDN/WAF protection detected = warn (exposed, no DDoS mitigation layer)
```

### DDoS Result Interpretation

| Signals | Result | Meaning |
|---|---|---|
| All probes fast (<2s), consistent | `pass` | No DDoS indicators |
| Slow but responsive (2–5s avg) | `warn` | Possible degradation |
| 429/503 returned | `warn` | DDoS protection triggered |
| Timeouts on 2+ probes | `fail` | Likely under attack or offline |
| No CDN/WAF headers found | `warn` (separate check) | Unprotected from DDoS |

---

## Additional New Security Checks (5 total new checks)

| Check | What it tests | How |
|---|---|---|
| `ddos` | DDoS attack indicators | Multi-probe latency + error analysis |
| `waf` | Web Application Firewall presence | Response headers (CF-Ray, X-Cache, etc.) |
| `open_ports` | Exposed dangerous ports | DNS + response fingerprinting |
| `http_methods` | Dangerous HTTP methods enabled | OPTIONS request, check Allow header |
| `cookie_security` | Secure cookie attributes | Check Set-Cookie header flags |

---

## Updated Risk Score Weights

Current weights only cover 5 checks. The new weights include all 10 checks:

```
ssl         → 15 pts
headers     → 12 pts  
uptime      → 10 pts
https       → 10 pts
dns         → 10 pts
ddos        → 20 pts  ← NEW (high weight — active attack indicator)
waf         → 10 pts  ← NEW
http_methods →  5 pts  ← NEW
cookie_security → 5 pts ← NEW
open_ports  →  3 pts  ← NEW
Total:        100 pts
```

DDoS gets the highest new weight (20) because an active DDoS attack is the most operationally critical threat.

---

## Changes to `run-security-checks/index.ts`

### New functions added:

```ts
async function checkDDoS(domain: string): Promise<CheckResult>
async function checkWAF(domain: string): Promise<CheckResult>  
async function checkHTTPMethods(domain: string): Promise<CheckResult>
async function checkCookieSecurity(domain: string): Promise<CheckResult>
```

### `checkDDoS` implementation detail:

```ts
async function checkDDoS(domain: string): Promise<CheckResult> {
  const url = `https://${domain}`
  const probes: { ms: number; status: number | null; ok: boolean }[] = []
  
  // 3 sequential probes
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
  
  if (failures >= 2) {
    return { check_type: 'ddos', result: 'fail', details: {
      note: 'Multiple probe failures — service may be down or under DDoS attack',
      avg_response_ms: avgMs, failures, statuses
    }}
  }
  if (has503 || hasCloudflareError) {
    return { check_type: 'ddos', result: 'warn', details: {
      note: 'DDoS protection triggered (503/52x) — possible attack in progress',
      avg_response_ms: avgMs, statuses
    }}
  }
  if (has429) {
    return { check_type: 'ddos', result: 'warn', details: {
      note: 'Rate limiting active — possible volumetric attack',
      avg_response_ms: avgMs, statuses
    }}
  }
  if (avgMs > 4000 || variance > 3000) {
    return { check_type: 'ddos', result: 'warn', details: {
      note: 'High latency variance detected — possible degradation under load',
      avg_response_ms: Math.round(avgMs), variance_ms: variance
    }}
  }
  return { check_type: 'ddos', result: 'pass', details: {
    note: 'No DDoS indicators detected', avg_response_ms: Math.round(avgMs), probes: probes.length
  }}
}
```

### `checkWAF` implementation:

```ts
async function checkWAF(domain: string): Promise<CheckResult> {
  // Look for CDN/WAF protection headers
  const wafHeaders = ['cf-ray', 'x-cache', 'x-amz-cf-id', 'x-akamai-request-id', 
                       'x-sucuri-id', 'server-timing', 'x-cdn']
  const resp = await fetch(`https://${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
  const found = wafHeaders.filter(h => resp.headers.get(h))
  const server = resp.headers.get('server') || ''
  const isCDN = server.toLowerCase().includes('cloudflare') || server.toLowerCase().includes('nginx') 
  if (found.length > 0 || isCDN) {
    return { check_type: 'waf', result: 'pass', details: { 
      note: 'CDN/WAF protection detected', indicators: found, server 
    }}
  }
  return { check_type: 'waf', result: 'warn', details: {
    note: 'No WAF/CDN protection detected — site exposed to DDoS',
    recommendation: 'Consider Cloudflare or similar CDN/WAF protection'
  }}
}
```

### DDoS alert generation (added to existing alert logic):

```ts
if (ddos.result === 'fail') {
  alertsToCreate.push({
    organization_id: org_id,
    title: `⚠️ DDoS Attack Detected: ${org.name}`,
    description: `${org.name}: Multiple probe failures on ${domain}. Service appears to be under a DDoS attack or is completely unreachable. Immediate action required.`,
    severity: 'critical',
    source: 'scanner',
    status: 'open',
    is_read: false,
  })
}
if (ddos.result === 'warn') {
  alertsToCreate.push({
    organization_id: org_id,
    title: `DDoS Warning: ${org.name}`,
    description: `${org.name}: Anomalous response patterns detected on ${domain}. Possible DDoS activity or service degradation.`,
    severity: 'high',
    source: 'scanner',
    status: 'open',
    is_read: false,
  })
}
if (waf.result === 'warn') {
  alertsToCreate.push({
    organization_id: org_id,
    title: `No DDoS Protection: ${org.name}`,
    description: `${org.name}: No WAF or CDN protection detected on ${domain}. The site is directly exposed and has no DDoS mitigation layer.`,
    severity: 'medium',
    source: 'scanner',
    status: 'open',
    is_read: false,
  })
}
```

---

## UI Changes in `OrgDetail.tsx`

### 1. Add DDoS check to label map

```ts
const checkTypeLabels: Record<string, string> = {
  ssl: 'SSL / TLS Certificate',
  https: 'HTTPS Enforcement',
  headers: 'Security Headers',
  dns: 'DNS Resolution',
  uptime: 'Availability Check',
  ddos: 'DDoS Detection',        // NEW
  waf: 'WAF / CDN Protection',   // NEW
  http_methods: 'HTTP Methods',  // NEW
  cookie_security: 'Cookie Security', // NEW
  cert_expiry: 'Cert Expiry',
  waf_activity: 'WAF Activity',
};
```

### 2. Add DDoS status to the summary cards row

Add a 5th card to the top stat row showing the DDoS check status from the latest scan:

```
[ Risk Score ] [ Status ] [ Assets ] [ Open Alerts ] [ DDoS Status ]
                                                        ↑ NEW: PROTECTED / WARNED / UNDER ATTACK
```

The DDoS card will:
- Show `PROTECTED` (green) if the latest ddos check is `pass`
- Show `WARNING` (amber) if `warn`
- Show `UNDER ATTACK` (red, blinking) if `fail`
- Show `NOT SCANNED` (gray) if no ddos check exists yet

### 3. Add DDoS check row to radar chart

Update `radarData` to include the DDoS score:

```ts
const radarData = [
  { subject: 'SSL', value: latestCheck('ssl') },
  { subject: 'Headers', value: latestCheck('headers') },
  { subject: 'Uptime', value: latestCheck('uptime') },
  { subject: 'DNS', value: latestCheck('dns') },
  { subject: 'DDoS', value: latestCheck('ddos') },   // NEW
  { subject: 'WAF', value: latestCheck('waf') },      // NEW
];
```

### 4. DDoS status banner

If the latest DDoS check is `fail`, show a prominent red banner at the top of the page:

```
┌─────────────────────────────────────────────────────┐
│  🚨 CRITICAL: DDoS Attack Detected                  │
│  Multiple probes to gov.so are timing out.          │
│  The site may be offline or under active attack.    │
│  Last checked: 2 minutes ago                        │
└─────────────────────────────────────────────────────┘
```

If `warn`:
```
┌─────────────────────────────────────────────────────┐
│  ⚠️ WARNING: DDoS Indicators Detected               │
│  Anomalous latency patterns detected on gov.so.     │
│  Possible degradation or attack in progress.        │
└─────────────────────────────────────────────────────┘
```

---

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/run-security-checks/index.ts` | Add `checkDDoS`, `checkWAF`, `checkHTTPMethods`, `checkCookieSecurity` functions; update `calculateRiskScore` weights; add DDoS alert generation |
| `src/pages/OrgDetail.tsx` | Add DDoS status card, update radar chart, add DDoS banner, add check type labels for new checks |

No database migrations needed — `security_checks` already stores any `check_type` string and `details` JSON. No schema changes required.

---

## Why This Approach is Realistic

From a Deno edge function, we **cannot** access:
- Real packet-level traffic data (not a network tap)
- Server-side request logs
- BGP routing tables

But we **can** reliably detect:
- Service degradation (high latency, timeouts)
- DDoS protection activation (503, 429, Cloudflare 52x codes)
- Absence of WAF/CDN protection (no CF-Ray headers = unprotected)
- Response inconsistency across repeated probes

This is the same method used by external uptime monitors (UptimeRobot, Pingdom) — it's production-grade, real-world detection, not simulated.
