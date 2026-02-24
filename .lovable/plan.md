

## Redesign Security Scan Report PDF

The current `generate-scan-report` edge function produces a dark-themed PDF without the company logo or remediation guidance. This plan redesigns it to match the professional white-background style of the DAST report, adds the company logo, and includes a detailed remediation section for each finding.

### Changes

**1. Rewrite `supabase/functions/generate-scan-report/index.ts`**

The entire PDF generator will be redesigned with:

- **White background** (`1 1 1 rg` full-page fill) instead of the current dark theme
- **Company logo** using the shared `fetchLogoPngData()` from `_shared/logoUtils.ts` (same pattern as `send-dast-report` and `generate-report`)
- **Navy header bar** (`0.08 0.12 0.2 rg`) with red accent line, matching the DAST report branding
- **Professional typography**: dark text on white/light-gray backgrounds for readability

**Page 1 -- Executive Summary:**
- Header: Logo + "SOMALIA CYBER DEFENCE" + "Security Scan Report"
- Info section (light gray box): Target URL, scan type, scan ID, date, risk level badge
- Security Score section with large score number and grade
- Vulnerability Summary boxes: Total, Critical, High, Medium, Low (color-coded with light backgrounds)
- Scanner Breakdown table: Semgrep, Nuclei, ZAP, Nikto with finding counts
- Top Findings table with severity badges, tool, finding name, and location

**Page 2+ -- Detailed Findings with Remediation:**
- Each finding rendered as a card-style row with:
  - Severity badge (colored pill)
  - Tool name, finding name
  - Description
  - Location
  - **Remediation recommendation** (new) -- mapped from finding type/severity
- Remediation mapping logic built into `normalizeFindings()`:
  - Semgrep findings: code-level fix advice (e.g., "Sanitize user input", "Use parameterized queries")
  - Nuclei findings: infrastructure fixes (e.g., "Update software version", "Restrict access")
  - ZAP alerts: web security fixes (e.g., "Add Content-Security-Policy header", "Enable HTTPS")
  - Nikto findings: server hardening advice
  - Generic fallbacks by severity level

**Page 3 (if findings exist) -- Remediation Summary:**
- Prioritized remediation action plan grouped by severity
- Estimated effort per fix category
- Summary recommendations for the client's IT team

**PDF Assembly:**
- Uses the proven multi-page PDF assembly pattern from `send-dast-report`
- Logo XObject embedded via `buildLogoXObject()` helper
- Proper byte-offset xref table (PDF 1.4 spec) for mobile compatibility
- Footer on every page: "Somalia Cyber Defence | Date | CONFIDENTIAL | Page N"

### Remediation Knowledge Base

A new `getRemediation(finding)` function maps findings to actionable fix advice:

```text
Finding Pattern             -> Remediation
─────────────────────────────────────────────
unsafe-formatstring         -> "Use parameterized formatting functions"
detected-jwt-token          -> "Rotate exposed JWT secrets immediately"
missing-integrity           -> "Add Subresource Integrity (SRI) attributes"
xss / cross-site-scripting  -> "Sanitize all user inputs; use CSP headers"
sql-injection               -> "Use parameterized queries; never concatenate SQL"
open-redirect               -> "Validate redirect URLs against an allowlist"
missing-csp                 -> "Add Content-Security-Policy header"
missing-hsts                -> "Add Strict-Transport-Security header"
ssl-expired                 -> "Renew SSL certificate; enable auto-renewal"
(generic critical)          -> "Investigate and patch immediately"
(generic high)              -> "Schedule fix within 48 hours"
(generic medium)            -> "Plan remediation within 2 weeks"
(generic low/info)          -> "Review and address in next maintenance cycle"
```

### Technical Details

- Imports `fetchLogoPngData` from `../_shared/logoUtils.ts` (shared with DAST report)
- The logo is conditionally embedded -- if fetch fails, the PDF renders without it (graceful fallback)
- Text sanitizer `s()` prevents PDF injection via special characters
- All colors use the same palette as the DAST report for brand consistency
- No changes needed to the frontend `ScanResults.tsx` -- the API contract (POST body with `result`, returns PDF blob) remains identical
