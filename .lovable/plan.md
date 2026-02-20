

## Plan: PDF Export and Email Attachment for DAST Reports

### Overview
Upgrade the `send-dast-report` edge function to generate a multi-page PDF report and attach it to the email sent to osmando@gmail.com. Also add a "Download PDF" button in the DAST Scanner UI for manual export.

---

### Changes

#### 1. Update `supabase/functions/send-dast-report/index.ts`

Rewrite this function to:
- Generate a multi-page PDF using the same raw PDF construction technique already used in `generate-report/index.ts` (no external libraries needed)
- **Page 1 - Executive Summary**: Organization name, URL, scan date, DAST score with grade, severity summary counts (critical/high/medium/low/passed)
- **Page 2+ - Failed Findings**: Table with severity badge, category, test name, detail, and recommendation for each failed finding
- Convert PDF to base64 and attach to the Resend email using the `attachments` field:
  ```json
  {
    "from": "noreply@cyberdefense.so",
    "to": ["osmando@gmail.com"],
    "subject": "DAST Report: OrgName -- Score XX/100 (Grade X)",
    "html": "<brief summary email body>",
    "attachments": [{
      "filename": "DAST-Report-OrgName-2026-02-20.pdf",
      "content": "<base64 PDF>"
    }]
  }
  ```
- Keep the HTML email body as a brief summary (score, grade, finding counts) with a note that the full report is attached as PDF
- Return the base64 PDF in the response so the frontend can also offer a download

#### 2. Update `src/pages/DastScanner.tsx`

- After calling `send-dast-report`, use the returned base64 PDF to also trigger a browser download
- Add a "Download PDF" button on cached scan results that calls `send-dast-report` (or a lighter endpoint) to regenerate/download the PDF on demand
- The email call already exists at line ~178; update it to handle the PDF response

---

### Technical Details

| File | Action |
|---|---|
| `supabase/functions/send-dast-report/index.ts` | Rewrite -- add `generateDastPDF()` function (~150 lines) using raw PDF operators, attach PDF to Resend email, return base64 in response |
| `src/pages/DastScanner.tsx` | Edit -- handle PDF response from send-dast-report, add Download PDF button for cached results |

No database changes. No new secrets needed.

