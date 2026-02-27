

## Add Compliance Scanning Panel

### Overview
Create a new backend proxy edge function and a dedicated Compliance Scanning page that connects to the external compliance scan API. Add a "Run Compliance" button to each org card on the dashboard, and add a navigation entry in the sidebar.

### 1. New Edge Function: `compliance-scan-proxy`

Create `supabase/functions/compliance-scan-proxy/index.ts` following the same pattern as `security-scanner-proxy`. It will:
- Accept a `path` query parameter (e.g., `/compliance/scan`, `/compliance/scan/{id}`, `/compliance/scans`)
- Forward requests to `SECURITY_API_URL` (already configured) with `SECURITY_API_KEY` header
- Handle CORS, JSON validation, and error responses

### 2. New Page: `src/pages/ComplianceScan.tsx`

A full-featured page with these sections:

**Scan Form** (top)
- Organization name + Target URL fields (pre-filled if navigated from org card via URL params)
- "Run Compliance Scan" button
- Live phase indicator showing `compliance_phase` during polling

**Overall Score Card** (large, centered)
- Big score number (0-100) color-coded: green >= 75, yellow >= 50, red < 50
- Grade letter (A/B/C/D/F)
- Passed/Failed counts with "X of Y controls passed" progress bar

**Four Framework Cards** (side by side grid)
- NIST CSF 2.0: mini bar chart per function (Govern/Identify/Protect/Detect/Respond/Recover)
- ISO 27001: average score + top failing domains
- GDPR: score per article (Art.5/25/32/33/35)
- ITU NCI: score per pillar as bars

**Findings Table**
- Columns: Severity, Control, Issue, NIST, ISO, GDPR, Remediation
- Sorted by severity (CRITICAL first)
- Each row expandable via Collapsible to show full remediation
- Color coded: red=CRITICAL, orange=HIGH, yellow=MEDIUM

**History Table** (bottom)
- Lists past scans from `/compliance/scans` endpoint
- Shows org name, URL, overall score, grade, date scanned

**Polling Logic**: After starting a scan, poll `GET /compliance/scan/{scan_id}` every 5 seconds until `compliance_status === "done"`, then display results.

### 3. Update OrgCard Component

Add a "Run Compliance" button to `src/components/dashboard/OrgCard.tsx`:
- Small button at the bottom of each card
- On click, navigates to `/compliance-scan?org={name}&url={domain}` with org details as query params
- Uses `e.stopPropagation()` to prevent the card's default navigation

### 4. Update Routing and Navigation

**`src/App.tsx`**: Add route `/compliance-scan` pointing to the new `ComplianceScan` page.

**`src/components/layout/Sidebar.tsx`**: Add "Compliance Scan" nav item with `Search` or `CheckSquare` icon, placed near the existing Compliance entry.

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/compliance-scan-proxy/index.ts` | Create -- proxy for compliance API |
| `src/pages/ComplianceScan.tsx` | Create -- full scan UI with form, results, findings, history |
| `src/components/dashboard/OrgCard.tsx` | Modify -- add "Run Compliance" button |
| `src/App.tsx` | Modify -- add `/compliance-scan` route |
| `src/components/layout/Sidebar.tsx` | Modify -- add nav item |

### Technical Notes

- The edge function reuses existing `SECURITY_API_URL` and `SECURITY_API_KEY` secrets (already configured)
- Polling uses `setInterval` with cleanup in a `useEffect`, checking `compliance_status` field
- Framework score visualizations use Recharts (BarChart for NIST/ITU/GDPR, already a dependency)
- The Collapsible component from Radix UI is already available for expandable finding rows
- URL query params (`useSearchParams`) pre-fill the form when navigating from an org card

