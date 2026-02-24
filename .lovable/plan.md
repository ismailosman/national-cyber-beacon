

## Pentest Email Notification System

Add automated email notifications for scan completions, critical vulnerability alerts, and report delivery using the existing Resend integration.

### Changes

**1. Create Edge Function: `supabase/functions/send-pentest-email/index.ts`**
- Three email template types: `scan_completed`, `critical_alert`, `report_delivery`
- Uses existing `RESEND_API_KEY` secret (already configured)
- Sends from `security@cybersomalia.com` to pentester (`ismail@cybersomalia.com`) and optionally to a client email
- Professional HTML email templates with risk scores, finding counts, and dashboard links
- CORS headers for browser invocation
- JWT verification disabled in `supabase/config.toml`

**2. Create Email Service: `src/services/emailService.ts`**
- `sendScanCompletedEmail(scanData, clientEmail?, clientName?)` -- sends summary with risk score, finding counts
- `sendCriticalAlertEmail(scanData, clientEmail?, clientName?)` -- sends urgent alert for critical/high findings
- `sendReportDeliveryEmail(scanData, reportUrl, clientEmail?, clientName?)` -- sends report download link
- `hasCriticalFindings(scanData)` -- helper to check if nuclei findings contain critical/high severity items
- All functions invoke the edge function via `supabase.functions.invoke()`

**3. Update `src/components/scanner/ScanForm.tsx`**
- Add optional `clientName` and `clientEmail` input fields in a "Client Notifications" section below the target URL
- Update the `onScan` callback signature to pass `clientEmail` and `clientName`
- Update the Props interface accordingly

**4. Update `src/components/scanner/SecurityDashboard.tsx`**
- Import email service functions
- Modify `handleStartScan` to accept `clientEmail` and `clientName` parameters
- When scan completes (`status === "done"`): automatically send `scan_completed` email
- When scan completes with critical/high findings: additionally send `critical_alert` email
- Update `ScanForm` usage to pass the extended callback

### Email Flow

```text
Scan completes (status = "done")
    |
    +-- Always --> sendScanCompletedEmail()
    |                 To: ismail@cybersomalia.com + client (if provided)
    |
    +-- If critical/high findings --> sendCriticalAlertEmail()
                      To: ismail@cybersomalia.com + client (if provided)

Manual "Send Report" (future):
    +-- sendReportDeliveryEmail()
              To: client + ismail@cybersomalia.com
```

### Technical Details

- The `RESEND_API_KEY` secret is already configured -- no new secrets needed
- `FROM_EMAIL` and `PENTESTER_EMAIL` are hardcoded defaults in the edge function (`security@cybersomalia.com` and `ismail@cybersomalia.com`)
- The edge function config entry will be added to `supabase/config.toml` with `verify_jwt = false`
- Email sending is fire-and-forget from the UI perspective -- errors are logged but don't block the scan flow
- The `ScanType` callback signature change flows through: `ScanForm` -> `SecurityDashboard.handleStartScan`

