

## Update Organization Scan System to Use Verified Backend Data

### Overview
Restructure the scan pipeline so the backend returns structured `verified_findings` and `verified_checks` objects, and the frontend uses ONLY these verified results for alerts, radar chart scores, and status display.

### 1. Update Backend Edge Function (`supabase/functions/run-security-checks/index.ts`)

**Build `verified_findings` array** from each check result (lines 436-522 area). Instead of generating alerts inline, collect structured findings:

```text
verified_findings = [
  {
    category: "Uptime" | "DDoS Protection" | "SSL" | "Security Headers" | "DNS Security",
    title: string,
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    message: string,
    evidence: string[],
    verified_by: string (e.g. "HEAD probe", "DNS-over-HTTPS", "TLS handshake"),
    verified: true
  }
]
```

**Build `verified_checks` object** from each check's raw details:

- `uptime`: `{ verdict, checks: [{method, online, detail, status_code}] }`
- `ddos_protection`: `{ verdict, providers, evidence }`
- `ssl`: `{ valid, days_until_expiry, issuer, common_name }` (enhance `checkSSL` to extract cert metadata via TLS connection details)
- `headers`: `{ score, grade, missing }` (compute score as % of required headers present)
- `dns_security`: `{ results: { spf: {present}, dmarc: {present}, zone_transfer: {allowed} } }` (add SPF/DMARC lookups to `checkDNS`)

**Return both** in the response JSON alongside existing fields. Also store `verified_findings` as the source for alert generation (replace current hardcoded alert logic).

### 2. Enhance DNS Check for SPF/DMARC

Add two additional DNS lookups in `checkDNS`:
- Query `_spf.{domain}` or parse TXT records for SPF
- Query `_dmarc.{domain}` for DMARC record
- Return these in `details.spf_present`, `details.dmarc_present`

### 3. Update Frontend OrgDetail Page (`src/pages/OrgDetail.tsx`)

**New state**: After `handleRunScan`, store the scan response (which now includes `verified_findings` and `verified_checks`).

**Replace alert display (lines 643-673)**:
- If `verified_findings` is empty: show green banner with checkmark icon and "All security checks passed"
- If findings exist: render each as a card with:
  - Green "Verified" badge (checkmark icon + text)
  - Severity badge (existing styling)
  - Title and message
  - "Source: {verified_by}" in small grey text
  - Collapsible "Evidence" section using the Collapsible component, showing each evidence string

**Update Radar Chart (lines 243-250)**:
Replace `latestCheck()` calls with scores derived from `verified_checks`:
- SSL: `ssl.valid ? Math.max(0, 100 - Math.max(0, 30 - ssl.days_until_expiry) * 3) : 0`
- Headers: `headers.score`
- DDoS: `ddos_protection.verdict === "PROTECTED" ? 100 : 0`
- DNS: Score based on SPF + DMARC presence and zone transfer status
- Uptime: `uptime.verdict === "ONLINE" ? 100 : 0`
- WAF: keep existing `latestCheck('waf')` as fallback

**Remove auto-generated frontend alert logic**: The backend is now the single source of truth for findings.

### 4. Files Modified

| File | Change |
|------|--------|
| `supabase/functions/run-security-checks/index.ts` | Add verified_findings + verified_checks to response; enhance DNS for SPF/DMARC; enhance SSL for cert metadata; compute header score/grade |
| `src/pages/OrgDetail.tsx` | Store scan response; replace alert section with verified findings cards (with badges, evidence collapsible, source line); update radar chart to use verified_checks scores; add green banner for zero findings |

### 5. Technical Details

- The `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` components from `@radix-ui/react-collapsible` are already available
- Edge function DNS enhancement uses Cloudflare DNS-over-HTTPS (`type=TXT`) for SPF/DMARC lookups
- SSL cert metadata extraction is limited in Deno's `fetch` -- will use available response data and mark fields as best-effort
- Header score: `(found.length / total_required.length) * 100`, grade mapped A/B/C/F from score ranges
- All existing styling, layout, and card structure preserved

