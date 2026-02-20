

## Plan: Email Notifications for Critical DAST Findings via Resend

### Overview
After each scheduled DAST scan, when new critical or high findings are detected, send a styled HTML email report to osmando@gmail.com using the Resend API from noreply@cyberdefense.so.

### Changes

#### 1. Add Resend API Key Secret
Store the `RESEND_API_KEY` as a backend secret so the scan function can use it.

#### 2. Update `supabase/functions/scheduled-dast-scan/index.ts`
After the scan loop completes and alerts have been inserted, add email notification logic:

- Count total new critical/high alerts across all scanned organizations
- If any exist (totalNewAlerts > 0):
  - Query recent alerts from the `alerts` table (source = "dast-scanner", last hour) for detailed finding info
  - Build a styled HTML email containing:
    - Header with alert count
    - Organization summary table (name, DAST score, new alert count)
    - Finding details table (severity badge, title, description/remediation)
    - Scan metadata (orgs scanned, date)
  - Send via Resend API (`POST https://api.resend.com/emails`)
  - From: `noreply@cyberdefense.so`
  - To: `osmando@gmail.com`
  - Subject: "DAST Alert: X new critical/high finding(s) detected"
- Email sending is best-effort -- failures are logged but do not fail the scan
- If no new critical/high findings, no email is sent

### Technical Details

| File | Action |
|---|---|
| Secret: `RESEND_API_KEY` | Add via secrets tool |
| `supabase/functions/scheduled-dast-scan/index.ts` | Add ~90 lines of email logic after the scan loop, before the final response. Reads `RESEND_API_KEY` from env, builds HTML, calls Resend API, logs result. |

No database changes needed. No UI changes needed.

