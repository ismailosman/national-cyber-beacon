

## Enhance Compliance Scanner Page

This is a large enhancement to the Compliance Scanner page adding interactive charts, detailed breakdowns, technical evidence, scan metadata, and clickable history rows. The page will be significantly richer and more interactive.

### 1. Expand Types

Update the `ComplianceResults` interface to include additional fields the UI needs:
- `checked_at: string` (timestamp)
- `passed_controls: Array<{ control_key, name, detail }>` 
- `failed_controls: Array<{ control_key, name, detail, severity, remediation, nist_control, iso_control, gdpr_article, itu_pillar }>`
- `raw_checks: { uptime, ssl, headers, ddos, dns }` with appropriate sub-types for Technical Evidence section

### 2. Clickable Framework Graphs (Sheet Drawer)

Modify `FrameworkBarCard` to accept an `onBarClick(categoryName)` callback. Use Recharts' `onClick` on each `<Bar>` or `<Cell>`. When a bar is clicked:
- Open a `<Sheet>` (slide-out from right) showing:
  - Framework + category name as header
  - Score as large colored number
  - List of controls for that category, each with pass/fail status, detail, and remediation if failed
- The Sheet component already exists at `src/components/ui/sheet.tsx`

Create a new `FrameworkDetailSheet` component that receives framework name, category, score, and the filtered findings/controls for that category.

### 3. Overall Score Card -- Passed/Failed Breakdown

Extend `OverallScoreCard` to show two columns below the progress bar:
- Left column: Passed controls (green, with control name)
- Right column: Failed controls (red/orange by severity, with control name and brief detail)
- Each control is clickable, opening the same Sheet drawer with details

### 4. Enhanced Findings Table

Update `FindingRow` expanded view to show all additional fields:
- ITU Pillar, NIST control name, ISO control name, GDPR article name
- Full remediation text in a styled box with light background
- Cosmetic "Mark as Acknowledged" button (grey, no-op with toast feedback)

### 5. Technical Evidence Section

Add a new `TechnicalEvidence` component rendered below findings when `results.raw_checks` exists. Contains collapsible sub-sections:
- **Uptime**: Each check method with status icon and detail
- **SSL**: Valid status, common_name, issuer, expiry date, days remaining
- **Headers**: Present headers as green chips, missing as red chips, grade letter
- **DDoS**: Verdict, providers, evidence strings
- **DNS**: SPF, DMARC, zone transfer status

### 6. Scan Metadata Header

Add a `ScanMetadata` component rendered at the top of results showing:
- Target URL (clickable `<a>` opening new tab)
- Organization name
- Scan completed timestamp (from `checked_at`)
- Overall grade as large colored letter
- "Download Report" button that creates a JSON blob and triggers `URL.createObjectURL` download

### 7. Updated Bar Colors

Change the color thresholds in `FrameworkBarCard` and the `scoreColor` helper:
- Score >= 80: `#00c853` (green)
- Score 60-79: `#ffab00` (yellow)  
- Score 40-59: `#ff6d00` (orange)
- Score < 40: `#d50000` (red)

### 8. Clickable History Rows

Make each history table row clickable. On click:
- If the row has `compliance_results` inline, load those directly into `results` state
- Otherwise fetch via `GET /compliance/scan/{scan_id}/report` through the proxy
- Also set `orgName` and `targetUrl` from the history record
- Highlight the selected row

### Files to Modify

| File | Action |
|------|--------|
| `src/pages/ComplianceScan.tsx` | Major rewrite -- all 7 enhancements above |

This is a single-file change since all components are defined inline in `ComplianceScan.tsx`. The file will grow from ~424 lines to approximately ~900 lines with the new sub-components.

### Technical Notes

- Uses existing `Sheet` component from `src/components/ui/sheet.tsx` for the slide-out drawer
- Recharts `Cell` supports `onClick` for bar click handling
- JSON download uses standard `Blob` + `URL.createObjectURL` + programmatic anchor click
- All new sections gracefully handle missing data (optional chaining) since backend may not return all fields
- No new dependencies needed -- everything uses existing Recharts, Radix Sheet, and Collapsible components
