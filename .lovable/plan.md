

## Add Email Delivery for Compliance Reports

### Overview
Send a branded email with the compliance PDF report attached when a scan completes or when the user downloads a report -- matching the existing security scan email pattern.

### Changes

#### 1. Update `send-pentest-email` Edge Function
Add a new email type `compliance_report` that:
- Accepts compliance results, org name, target URL, grade, and score
- Calls `generate-compliance-report` to get the PDF
- Uploads the PDF to the `scan-reports` storage bucket
- Builds a branded HTML email with:
  - Navy header with "Compliance Assessment Complete"
  - Compliance grade badge (A-F) with color coding
  - Score display (e.g., 46/100)
  - Pass/fail summary (e.g., "4 of 11 controls passed")
  - Framework averages (NIST, ISO, GDPR, ITU) with color indicators
  - "Download PDF Report" and "View Dashboard" buttons
  - Standard Cyber Defense email signature
- Sends to admin recipients (osmando@gmail.com, info@cyberdefense.so) plus optional client email
- Attaches the PDF as a base64 email attachment

#### 2. Update `src/pages/ComplianceScan.tsx`
- Add an "Email Report" button next to the "Download Report" button in the `ScanMetadata` component
- After a scan completes successfully, automatically send the compliance report email (same pattern as security scanner)
- Add `emailing` state for the email button loading indicator
- The email function call sends `{ type: "compliance_report", complianceData: { results, org_name, target_url } }` to `send-pentest-email`

### Technical Details

**Email HTML template** will follow the same structure as `scanCompletedEmail` and `reportDeliveryEmail`:
- 600px centered table layout
- Navy header (#0f172a) with compliance icon
- Grade box with color: green (A/B), yellow (C), red (D/F)
- Framework scores shown as colored text values
- PDF download button linking to storage URL
- Standard email signature

**PDF generation and upload** reuses the existing `generatePdfAndUpload` pattern but calls `generate-compliance-report` instead of `generate-scan-report`.

**Auto-send on scan completion**: When `pollScan` detects `compliance_status === 'done'`, it will trigger the email automatically (fire-and-forget, non-blocking).

