

## Suppress Three More DAST False Positives

### Problem

Three findings are flagged but should not penalize the score:

1. **TLS-CAA** (Missing CAA DNS Record) -- SSL is managed by Lovable's platform, so CAA records are not the site owner's responsibility
2. **JS-SRI** (Missing Subresource Integrity) -- External scripts injected by the platform/CDN should not be flagged as vulnerabilities
3. **DNS-DMARC-NONE** (DMARC policy set to none) -- "none" is a valid monitoring phase; it should be downgraded to a low/informational finding rather than a medium/fail

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/dast-tls-deep-scan/index.ts` | Reclassify TLS-CAA as info/pass when no CAA record is found, noting SSL is platform-managed |
| `supabase/functions/dast-js-libraries/index.ts` | Downgrade JS-SRI from medium/fail to low/info, as SRI is a defense-in-depth measure not a critical vulnerability |
| `supabase/functions/dast-dns-security/index.ts` | Reclassify DNS-DMARC-NONE from medium/fail to low/info, noting it is a valid monitoring phase |

### Technical Details

**1. TLS-CAA -- Platform-Managed SSL (dast-tls-deep-scan/index.ts, line 75)**

Change the "no CAA record" branch from `severity: "medium", status: "fail"` to `severity: "info", status: "pass"` with updated detail: "No CAA record found, but SSL certificates are managed by the hosting platform."

**2. JS-SRI -- Downgrade to Informational (dast-js-libraries/index.ts, line 83)**

Change from `severity: "medium", status: "fail"` to `severity: "low", status: "info"` with updated detail noting SRI is a best practice but not a direct vulnerability.

**3. DNS-DMARC-NONE -- Monitoring Phase (dast-dns-security/index.ts, line 75)**

Change from `severity: "medium", status: "fail"` to `severity: "low", status: "info"` with updated detail: "DMARC policy is 'none' (monitoring mode). This is a valid initial deployment phase."

### Expected Result

- TLS-CAA no longer penalizes the score
- JS-SRI becomes informational instead of a failing check
- DMARC "none" policy is treated as a low-priority observation
- Combined score improvement: removal of 2 medium fails and 1 medium fail = approximately +9-12 points

