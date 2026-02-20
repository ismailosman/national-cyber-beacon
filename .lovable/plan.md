

## Redesign DAST PDF Report and Add Configurable Email Recipient

### Overview
Three changes: (1) add a configurable email recipient input field in the UI instead of hardcoding osmando@gmail.com, (2) redesign the PDF report to match the reference image style (Invicti-like layout with white background, dark text, colored severity badges, vulnerability summary with donut-style counts), and (3) add the Cyber Defence logo to the PDF header.

---

### Changes

#### 1. `src/pages/DastScanner.tsx` -- Configurable Email Recipient

- Add `recipientEmail` state initialized to `"osmando@gmail.com"` (editable, not hardcoded)
- Add an email input field next to the "Email PDF" button in the header toolbar area
- Pass `recipientEmail` to `handleEmailPdf` and `send-dast-report` edge function as a new `to` parameter
- Update the auto-email after scan completion to also use the configurable recipient
- Update toast messages to show the actual recipient email

#### 2. `supabase/functions/send-dast-report/index.ts` -- Full PDF Redesign

Accept new `to` parameter (falls back to `"osmando@gmail.com"` if not provided).

Completely redesign `generateDastPDF()` to match the reference image style:

**Page 1 -- Executive Summary (white/light background, dark text)**
- Header bar: dark navy/red accent bar with "Somalia Cyber Defence" branding and "Detailed Scan Report" title, date/time
- Target URL, scan time, scan duration info row
- Risk Level box (color-coded: red for Critical, orange for High, yellow for Medium, green for Low/Excellent)
- Large vulnerability count boxes: IDENTIFIED (total), CONFIRMED (failed), CRITICAL, HIGH, with smaller MEDIUM, LOW, BEST PRACTICE, INFORMATION counts
- Vulnerability breakdown section with severity counts in a clean table format

**Page 2+ -- Detailed Findings**
- White background with dark text
- Table with columns: Severity, Module, Finding, Detail, Recommendation
- Color-coded severity badges (red/orange/yellow/blue)
- Clean alternating row backgrounds (light gray / white)

**Footer on all pages**: "Somalia Cyber Defence DAST Report | Date | CONFIDENTIAL | Page N"

**Logo**: The PDF uses raw operators and cannot embed raster images easily. The logo will be represented as text "SOMALIA CYBER DEFENCE" with a shield unicode symbol in the header, matching branding. The header will use a dark navy + red accent color scheme similar to the reference.

#### 3. Edge Function Email Update

- Use the `to` field from the request body (with fallback)
- Update the email `from` field and subject line to match branding

---

### Technical Details

| File | Action |
|---|---|
| `src/pages/DastScanner.tsx` | Add `recipientEmail` state, email input field, pass `to` param to edge function |
| `supabase/functions/send-dast-report/index.ts` | Accept `to` param; redesign PDF with white background, dark text, Invicti-like layout, branding header |

The PDF uses raw PDF operators (no library). Limitations:
- Cannot embed raster images (PNG logo) -- will use text-based branding with shield symbol and colored header bar
- Colors will use RGB operators matching the reference (white bg: `1 1 1`, dark text: `0.1 0.1 0.1`, red accent: `0.8 0.15 0.15`)

No database changes needed.

