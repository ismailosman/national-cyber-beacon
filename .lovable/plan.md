## Dark Web Monitor: PDF Export and Email Delivery

### Overview

Add a "Download PDF" button and "Email Report" button to the Dark Web Monitor results panel. The PDF will follow the same professional design as the DAST scanner report (navy header, red accent, logo, severity breakdown, findings tables). The email will be sent to [info@cyberdefense.so](mailto:info@cyberdefense.so) and [osmando@gmail.com](mailto:osmando@gmail.com) with the PDF attached.

### Architecture

Create a new Edge Function `send-darkweb-report` that:

1. Generates a multi-page PDF from dark web scan data (same visual style as `send-dast-report`)
2. Sends the PDF via Resend email to the admin recipients
3. Returns the PDF base64 to the frontend for direct download

### New Edge Function: `supabase/functions/send-darkweb-report/index.ts`

**PDF Design (matching DAST report):**

- Page 1: Executive Summary
  - Navy header bar with logo + "SOMALIA CYBER DEFENCE" branding
  - Red accent line
  - Info section: Domain, scan date, scan ID
  - Risk level box (based on severity counts)
  - Score computed from findings: `100 - (critical * 25 + high * 10 + medium * 3)`
  - Severity breakdown boxes (Critical, High, Medium, Low)
  - Source summary table (6 rows: Ransomware, HIBP, Pastes, Ahmia, IntelX, GitHub) with finding counts
- Page 2+: Detailed Findings per source
  - Table with columns: Source, Severity, Detail, additional fields
  - Same alternating row styling as DAST report
- Footer: "Somalia Cyber Defence | Date | CONFIDENTIAL | Page N"

**Email Design (matching DAST report):**

- White background email with navy header
- Logo, domain, scan date
- Severity summary cards (Critical, High, Medium counts)
- PDF attached
- Cyber Defense Inc signature

**Logic:**

- Accepts: `{ scan: DarkWebScan }` (the full scan object with results/summary)
- Uses `fetchLogoPngData()` from shared utils
- Sends to `["osmando@gmail.com", "info@cyberdefense.so"]`
- Returns `{ success, pdf: base64string }`

### Frontend Changes: `src/pages/DarkWebMonitor.tsx`

Add two buttons in the results header area (visible when `currentScan?.darkweb_status === 'done'`):

- **Download PDF** button: Calls the edge function, decodes base64 PDF, triggers browser download
- **Email Report** button: Same call but shows a toast on success

Both use a single function that invokes `supabase.functions.invoke('send-darkweb-report', { body: { scan: currentScan } })`.

### Files to Create

- `supabase/functions/send-darkweb-report/index.ts` -- PDF generator + email sender

### Files to Modify

- `src/pages/DarkWebMonitor.tsx` -- Add export/email buttons and handler
- `supabase/config.toml` is auto-managed (edge function auto-deploys)

### Technical Details

- Reuses `fetchLogoPngData` from `_shared/logoUtils.ts`
- Reuses `buildLogoXObject` pattern from DAST report
- Same PDF object layout: catalog, pages, fonts, logo XObject, page+stream pairs with proper xref table
- Score formula: `max(0, 100 - (critical * 25 + high * 10 + medium * 3))`
- Grade: A (>=90), B (>=75), C (>=60), D (>=40), F (<40)
- Uses RESEND_API_KEY (already configured) and [noreply@cyberdefense.so](mailto:noreply@cyberdefense.so) sender  
  
**Update the Dark Web Monitor panel with the following changes:**
  The API `darkweb_results` object now contains 4 additional breach sources. Add these as new collapsible sections in the findings panel:
  **New sections to add:**
  - 🔐 **Pwned Passwords** — data from `darkweb_results.pwned_passwords.findings`, show `breach_count` and `message` per finding, never display actual password text
  - 💀 **Breach Directory** — data from `darkweb_results.breach_directory.findings`, show `email` and mask password as `••••••••`, show `sources` list
  - 🗄️ **Scylla Database** — data from `darkweb_results.scylla.findings`, show `email`, `username`, mask `password` as `••••••••`, show `database` name
  - 🔓 **LeakCheck** — data from `darkweb_results.leakcheck.findings`, show `email`, `breach_name`, `breach_date`, `leak_type`