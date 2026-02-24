

## Add "Send Report" Button to Scan Results

Add a button in the ScanResults header that allows sending the scan report via email to a client, using the existing `sendReportDeliveryEmail` service.

### Changes

**1. `src/components/scanner/SecurityDashboard.tsx`**
- Store `clientEmail` and `clientName` in component state so they persist after scan completes
- Pass `clientEmail` and `clientName` as props to `ScanResults`

**2. `src/components/scanner/ScanResults.tsx`**
- Accept optional `clientEmail` and `clientName` props
- Add a "Send Report" button next to the existing "Export PDF" button (only visible when scan status is "done")
- If no `clientEmail` was provided during scan setup, show a small popover/dialog with an email input field when the button is clicked
- On click, call `sendReportDeliveryEmail` from the email service with the scan data and dashboard URL
- Show loading state while sending, success/error toast on completion
- Import `Send` icon from lucide-react for the button

### UI Behavior

- When `clientEmail` exists from the scan form: clicking "Send Report" sends immediately to that email
- When no `clientEmail`: a small popover appears with an email input and "Send" confirmation button
- Toast notifications: "Report sent successfully" or error message

### Technical Details

- The report URL will be constructed as `https://cyberdefense.so/scan/{scan_id}` (matching the edge function pattern)
- Uses the existing `sendReportDeliveryEmail` function which invokes the `send-pentest-email` edge function with type `report_delivery`
- The Popover component from the UI library will be used for the inline email input fallback

