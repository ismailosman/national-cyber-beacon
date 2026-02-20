

## Add "Email PDF Report" Button to DAST Scanner

### Overview
Add a dedicated "Email PDF Report" button that sends the DAST report with PDF attachment to osmando@gmail.com. This will appear in two places:

1. **Header toolbar** -- next to the existing "Download PDF" button when viewing a single organization's results
2. **Organization cards** -- next to the existing "PDF" button on each org card in the "all organizations" view

### Changes

**File: `src/pages/DastScanner.tsx`**

- Add new state: `emailingPdf` to track which org is currently being emailed (similar to `downloadingPdf`)
- Add `Mail` icon import from lucide-react
- Add `handleEmailPdf` function that:
  - Calls `send-dast-report` edge function (same as download, which already sends the email)
  - Shows a toast confirming "Report emailed to osmando@gmail.com"
  - Does NOT trigger a browser download (unlike `handleDownloadPdf`)
- Add "Email PDF" button in the header toolbar (line ~345, next to "Download PDF") -- visible when a single org is selected
- Add "Email" button on each organization card (line ~569, next to the existing "PDF" button)

### Technical Details

The `send-dast-report` edge function already generates the PDF and sends it via email. The new button simply calls the same function but only shows the email confirmation toast without triggering a download. No edge function changes needed.

| File | Action |
|---|---|
| `src/pages/DastScanner.tsx` | Add `emailingPdf` state, `handleEmailPdf` function, and two "Email PDF" buttons |

No backend changes needed.

