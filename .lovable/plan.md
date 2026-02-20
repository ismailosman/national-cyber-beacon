

## Plan: Enhanced DAST Scanner with Email Reports and 8 New Security Tests

### Overview
Two major enhancements: (1) Send an email with a text report attached after every manual DAST scan, and (2) add 8 new advanced passive security tests to the scanner.

---

### Part 1: Email Report on Manual DAST Scan

After a manual scan completes in the frontend (`DastScanner.tsx`), send the scan results to a new edge function that builds an HTML email report and sends it via Resend.

**New Edge Function: `send-dast-report`**
- Accepts: organization name, URL, DAST score, summary, and full test results
- Builds a styled HTML email report with:
  - Organization name, URL, scan date, DAST score/grade
  - Summary counts (critical, high, medium, low, passed)
  - Detailed findings table grouped by test, showing only failed findings with severity, title, detail, and recommendation
- Sends via Resend API from `noreply@cyberdefense.so` to `osmando@gmail.com`
- Uses the existing `RESEND_API_KEY` secret

**Frontend Update: `src/pages/DastScanner.tsx`**
- After the scan loop completes and results are upserted, call `supabase.functions.invoke('send-dast-report', { body: { ... } })` with the scan data
- Show a toast confirming email was sent
- Best-effort: email failure does not block the scan flow

---

### Part 2: 8 New Advanced DAST Tests

**New Edge Functions (8 files):**

| # | Function Name | Test Name | Description |
|---|---|---|---|
| 7 | `dast-tls-deep-scan` | TLS/SSL Deep Scan | HSTS config, mixed content, insecure forms, CAA records, cert transparency |
| 8 | `dast-subdomain-discovery` | Subdomain Discovery | Certificate Transparency log enumeration, live subdomain checks |
| 9 | `dast-cms-vulns` | CMS Vulnerabilities | WordPress/Joomla/Drupal-specific checks (exposed admin, config files, user enum) |
| 10 | `dast-js-libraries` | JS Library Audit | Detects outdated JavaScript libraries with known CVEs, SRI checks |
| 11 | `dast-api-discovery` | API Discovery | Exposed Swagger, GraphQL, debug endpoints, config files |
| 12 | `dast-dns-security` | DNS Security | DNSSEC, zone transfer, DNS provider analysis |
| 13 | `dast-content-security` | Content Security | CSP analysis, clickjacking, MIME sniffing, referrer policy |
| 14 | `dast-waf-detection` | WAF Detection | WAF fingerprinting, bypass indicators |

Each function follows the same pattern as existing DAST functions: accepts `{ url }`, returns `{ success, findings[], checkedAt }`.

**Frontend Update: `src/pages/DastScanner.tsx`**
- Add all 8 new tests to the `TESTS` array with icons and descriptions
- The existing scan loop, results table, and scoring logic all work automatically since they iterate over `TESTS`

**Scheduled Scan Update: `supabase/functions/scheduled-dast-scan/index.ts`**
- Add all 8 new tests to the `DAST_TESTS` array so automated weekly scans include them too

---

### Technical Details

| File | Action |
|---|---|
| `supabase/functions/send-dast-report/index.ts` | Create -- email sending edge function |
| `supabase/functions/dast-tls-deep-scan/index.ts` | Create -- TLS deep scan |
| `supabase/functions/dast-subdomain-discovery/index.ts` | Create -- subdomain discovery |
| `supabase/functions/dast-cms-vulns/index.ts` | Create -- CMS vulnerability checks |
| `supabase/functions/dast-js-libraries/index.ts` | Create -- JS library audit |
| `supabase/functions/dast-api-discovery/index.ts` | Create -- API discovery |
| `supabase/functions/dast-dns-security/index.ts` | Create -- DNS security |
| `supabase/functions/dast-content-security/index.ts` | Create -- Content security policy analysis |
| `supabase/functions/dast-waf-detection/index.ts` | Create -- WAF detection |
| `src/pages/DastScanner.tsx` | Edit -- add 8 new tests to TESTS array, add email call after scan |
| `supabase/functions/scheduled-dast-scan/index.ts` | Edit -- add 8 new tests to DAST_TESTS array |
| `supabase/config.toml` | No changes needed (verify_jwt already handled) |

No database changes required. No new secrets needed (RESEND_API_KEY already exists).

