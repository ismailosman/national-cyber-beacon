

## Fix: Incomplete PDF Report + Attach PDF to Email

### Issues Found

**Issue 1 -- PDF missing findings for "ERROR" and "WARNING" severities:**
The PDF's `computeStats()` counts findings by standard severities (critical, high, medium, low, info) but Semgrep uses `error` and `warning` as severity values. These findings are counted in `total` via `normalizeFindings()` but NOT in the vulnerability summary boxes, causing a mismatch (e.g., Total=3 but all severity boxes show 0). The `normalizeFindings()` function uppercases severity directly, so "ERROR" and "WARNING" are valid severities but have no color mapping and fall through as grey "info" entries.

**Issue 2 -- Email sends a link, not a PDF attachment:**
The `send-pentest-email` edge function's `report_delivery` handler generates an HTML email with a "Download Report (PDF)" button linking to a dashboard URL. It does not generate the actual PDF or attach it. The Resend API supports `attachments` with base64-encoded content, which we can use.

### Changes

**1. `supabase/functions/generate-scan-report/index.ts` -- Fix severity mapping**

In `computeStats()`, map Semgrep's non-standard severities to standard ones:
- `error` maps to `high`
- `warning` maps to `medium`

Update the `countSev` function to include these aliases:
```text
countSev('high')   -> also count semgrep findings with severity 'error'
countSev('medium') -> also count semgrep findings with severity 'warning'
```

In `normalizeFindings()`, normalize the severity before assigning:
- Map `ERROR` to `HIGH`, `WARNING` to `MEDIUM` so they get proper color coding and remediation priority in the PDF.

**2. `supabase/functions/send-pentest-email/index.ts` -- Attach PDF to emails**

Modify the edge function to:
- For `scan_completed` and `report_delivery` email types, call the `generate-scan-report` function internally to produce the PDF binary
- Convert the PDF bytes to base64
- Include it as an attachment in the Resend API call using:
  ```json
  {
    "attachments": [{
      "content": "<base64-encoded-pdf>",
      "filename": "security-report-<target>.pdf"
    }]
  }
  ```
- The function will call `generate-scan-report` via `fetch()` using the Supabase URL and service role key (already available as secrets)
- If PDF generation fails, the email still sends without the attachment (graceful fallback)

**3. `src/services/emailService.ts` -- Pass full scan data for PDF generation**

The `sendReportDeliveryEmail` function already passes the full `scanData` object. No changes needed here -- the edge function will use `scanData` to generate the PDF server-side.

### Technical Details

- The internal PDF generation call uses the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets (both already configured)
- PDF attachment is base64-encoded per Resend's API spec (max 40MB, our reports are typically under 100KB)
- Severity normalization ensures the PDF's Vulnerability Summary boxes accurately reflect all findings
- The `scan_completed` auto-email will also include the PDF attachment, so the pentester gets the report without clicking any links
- The `critical_alert` email type will NOT include a PDF (it's a quick alert, not a report)

