

## Compliance Scanner PDF Report Generation

### Problem
The "Download Report" button on the Compliance Scanner page currently exports raw JSON data instead of a professionally formatted PDF report.

### Solution
Create a new backend function (`generate-compliance-report`) that produces a multi-page PDF with charts, tables, and branding -- matching the visual style of the existing security scan PDF reports. Then update the frontend download button to call this function.

---

### New Backend Function: `generate-compliance-report`

**File:** `supabase/functions/generate-compliance-report/index.ts`

A PDF generator that accepts compliance results and produces a branded, multi-page report with:

**Page 1 -- Executive Summary**
- Branded header with eagle logo (reusing `_shared/logoUtils.ts`)
- Organization name, target URL, scan date
- Overall compliance score with large grade badge (A-F)
- Pass/fail summary bar (X of Y controls passed)
- Framework averages overview: NIST CSF, ISO 27001, GDPR, ITU NCI -- each with score and color-coded bar

**Page 2 -- Framework Breakdown**
- Four framework sections, each showing category scores as horizontal bars
- Color coding: Green (80+), Yellow (60-79), Orange (40-59), Red (below 40)
- Category names with numeric scores

**Page 3 -- Compliance Findings Table**
- Sorted by severity (CRITICAL > HIGH > MEDIUM > LOW)
- Columns: Severity, Control Key, Issue Detail, NIST mapping, ISO mapping, GDPR mapping
- Color-coded severity labels
- Remediation text for each finding

**Page 4 -- Technical Evidence Summary**
- SSL status, uptime checks, security headers grade, DDoS protection, DNS security
- Pass/fail indicators for each check area

**Every page** includes:
- Navy header with logo and "SOMALIA CYBER DEFENCE" branding
- Footer with confidentiality notice, date, page number
- Consistent color scheme matching existing reports

---

### Frontend Changes

**File:** `src/pages/ComplianceScan.tsx`

Update the `downloadReport` function to:
1. Call the new `generate-compliance-report` edge function with the compliance results, org name, and target URL
2. Receive base64 PDF data in the response
3. Decode and trigger a browser download as `compliance-report-{orgName}.pdf`
4. Show a loading spinner on the download button while generating
5. Fall back to JSON download if PDF generation fails

---

### Configuration

**File:** `supabase/config.toml`

Add the new function entry with `verify_jwt = false` (matching other report functions).

---

### Technical Details

- The PDF is built using raw PDF operators (same technique as `generate-scan-report` and `generate-report`) -- no external libraries needed
- Logo embedding reuses the shared `fetchLogoPngData()` utility
- Framework bar charts are rendered as colored rectangles with proportional widths
- The function returns `{ pdf_base64: string }` for the frontend to decode
- Severity color mapping: CRITICAL = red, HIGH = orange, MEDIUM = yellow, LOW = blue
- Score gauge rendered as a colored box with grade letter

