

## Plan: Email Notifications for Critical DAST Findings via Resend

### Overview
After each scheduled DAST scan, when new critical or high findings are detected, send an email summary to osmando@gmail.com using the Resend API.

### Changes

#### 1. Add Resend API Key Secret
Store the user's Resend API key as a backend secret (`RESEND_API_KEY`).

#### 2. Update `supabase/functions/scheduled-dast-scan/index.ts`
After the scan loop completes and new critical/high findings have been identified and inserted as alerts, add email notification logic:

- Collect all new critical/high findings across all scanned organizations
- If any exist, build an HTML email with:
  - Subject: "DAST Alert: X new critical/high findings detected"
  - Body: A styled table listing each finding with organization name, severity badge, finding title, detail, and recommendation
  - Overall scan summary (orgs scanned, scores)
- Send via Resend API (`POST https://api.resend.com/emails`) using the `RESEND_API_KEY` secret
- Recipient: `osmando@gmail.com`
- From: `onboarding@resend.dev` (Resend's default sender -- works without domain verification)
- Email sending is best-effort; failures are logged but don't fail the scan

### Technical Details

| File | Action |
|---|---|
| Secret: `RESEND_API_KEY` | Add via secret tool |
| `supabase/functions/scheduled-dast-scan/index.ts` | Add Resend email sending after scan loop, before returning response |

The email will only be sent when there are new critical or high findings (not on every scan). The email includes a summary table of all new findings grouped by organization, with severity, title, detail, and remediation steps.

