

## Fix Security Scanner: Score, PDF Link, and Security Headers

### Problem Analysis

**Issue 1: Score shows 0/100 in email**
The email template uses `scanData.risk_score` which is never computed before sending. It defaults to `{ score: 0, rating: "LOW" }`. The scoring logic exists in `computeStats` (in both `generate-scan-report` and `ScanReportCharts`) but is never applied to the scan data before the email is sent.

**Fix:** Compute the risk score in `send-pentest-email` before building the email, using the same deduction formula: `100 - (critical * 25 + high * 10 + medium * 3 + low * 1 + niktoVulns * 2)`.

**Issue 2: PDF report link returns 404**
The email's "View Full Report" button links to `https://cyberdefense.so/scan/{id}`, but no `/scan/:id` route exists in the app router. Two fixes needed:
- Add a `/scan/:id` route that loads the scan result and displays it
- Ensure the "Download PDF" storage link works (the PDF is uploaded to storage but the public URL may not resolve if the bucket config is wrong)

**Fix:** Add a public `/scan/:id` page that fetches the scan result from the API and displays it, plus redirects to the stored PDF if available.

**Issue 3: Security header failures on cyberdefense.so**
The scan report shows 6 FAIL findings from Nikto and 3 medium ZAP findings. These are real security header gaps:

| Finding | Fix |
|---------|-----|
| IP address in `set-cookie` / `__cf_bm` cookie | Cloudflare infrastructure cookie -- cannot fix directly, reclassify as informational |
| Missing X-Frame-Options | Already intentionally removed for iframe preview; add for production via Cloudflare headers |
| Missing X-Content-Type-Options | Add `X-Content-Type-Options: nosniff` meta tag in `index.html` |
| BREACH (Content-Encoding: deflate) | Cloudflare compression -- reclassify as informational for Cloudflare-hosted sites |
| robots.txt entries | Informational, not a vulnerability -- reclassify |
| Missing CSP header | Add a Content-Security-Policy meta tag in `index.html` |
| Missing Anti-clickjacking | Same as X-Frame-Options above |
| SRI attribute missing | Already filtered for same-origin scripts; reclassify external CDN scripts |

Many of these are Cloudflare infrastructure artifacts. The fix is two-fold:
1. Add security meta tags where possible (`X-Content-Type-Options`, basic CSP)
2. Update the scan report's Nikto classifier to reclassify Cloudflare-specific findings (IP in `__cf_bm`, BREACH via Cloudflare compression) as informational rather than FAIL

---

### Changes

**1. `supabase/functions/send-pentest-email/index.ts`**
- Add a `computeRiskScore(scanData)` function that calculates the score from `vuln_results`/`dast_results` (nuclei, ZAP, nikto, semgrep)
- Use the computed score instead of the default `{ score: 0, rating: "LOW" }` in `scan_completed` and `report_delivery` handlers

**2. `src/App.tsx`**
- Add a new route `/scan/:id` pointing to a new `ScanReport` page

**3. `src/pages/ScanReport.tsx` (new file)**
- Public page that fetches scan result by ID via the security scanner proxy
- Displays the scan results using the existing `ScanResults` component
- Includes a direct download link to the stored PDF

**4. `index.html`**
- Add `<meta http-equiv="X-Content-Type-Options" content="nosniff">` (if not already present)

**5. `supabase/functions/generate-scan-report/index.ts`**
- Update `classifyNiktoFindings` to reclassify Cloudflare-specific findings (`__cf_bm` cookie IP, BREACH via deflate on Cloudflare) as informational/pass instead of fail
- Reclassify `robots.txt` entries finding as informational

