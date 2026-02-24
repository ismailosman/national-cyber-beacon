

## Store PDF Reports in Cloud Storage and Link in Emails

### Overview
Instead of only attaching PDFs to emails (which can be large and sometimes blocked), the system will also upload the generated PDF to cloud file storage. The email will include a direct download link to the stored PDF, making reports always accessible.

### Changes

**1. Create a `scan-reports` storage bucket (database migration)**

A new public-read storage bucket called `scan-reports` will store the PDF files. The path convention will be `{scan_id}/report.pdf`, so a report is accessible at:

```
https://awdysfgjmhnqwsoyhbah.supabase.co/storage/v1/object/public/scan-reports/{scan_id}/report.pdf
```

Policies:
- Public read access (anyone with the link can download)
- Service role can upload (edge functions use the service role key)

**2. Update `supabase/functions/send-pentest-email/index.ts`**

Modify `generatePdfAttachment()` to also upload the PDF to storage before returning:

- After generating the PDF bytes from `generate-scan-report`, upload to `scan-reports/{scan_id}/report.pdf` using the Supabase Storage REST API with the service role key
- Store the public URL and pass it to the email templates
- The PDF is still attached to the email AND the link points to the stored file
- If upload fails, fall back to the dashboard URL (graceful degradation)

The `dashboardUrl` in all email templates will be updated to point to the stored PDF download link:
```
https://cyberdefense.so/scan/{scan_id}
```
This remains the same dashboard link, but the email will now also include a "Download PDF" button linking directly to the storage file.

**3. Update email templates**

- `scanCompletedEmail`: Add a second button "Download PDF Report" linking to the storage URL, keep existing "View Full Report" button
- `reportDeliveryEmail`: Change the "Download Report (PDF)" button to link to the actual storage PDF URL instead of the dashboard
- `criticalAlertEmail`: No changes (quick alert, no report)

**4. Update `src/components/scanner/ScanResults.tsx`**

Update the `reportUrl` passed to `sendReportDeliveryEmail` to use the storage-based URL pattern so the email function knows the scan ID for upload.

### Technical Details

Storage upload from the edge function:
```text
PUT /storage/v1/object/scan-reports/{scan_id}/report.pdf
Authorization: Bearer {SERVICE_ROLE_KEY}
Content-Type: application/pdf
Body: <raw PDF bytes>
```

Public download URL:
```text
{SUPABASE_URL}/storage/v1/object/public/scan-reports/{scan_id}/report.pdf
```

The email will contain both:
1. A link to `https://cyberdefense.so/scan/{scan_id}` (interactive dashboard)
2. A direct PDF download link from storage
3. The PDF as an email attachment (kept for offline access)

### Files Modified
- New database migration: Create `scan-reports` storage bucket with public read policy
- `supabase/functions/send-pentest-email/index.ts`: Upload PDF to storage, update email templates with download links
- `src/components/scanner/ScanResults.tsx`: Minor URL update (optional, existing flow already works)

