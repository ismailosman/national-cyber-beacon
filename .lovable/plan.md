## Fix PDF Report Layout and Add Download Button

### Problems Identified

1. **TOP FINDINGS only shows 8 entries** -- The code hardcodes `findings.slice(0, 8)` on the executive summary page. With 21 total findings, 13 are hidden. The "... and 13 more" text is shown but all findings should be accessible across pages.
2. **Scanner Breakdown status bars overlap content** -- The red severity bars start at x=420 and extend up to 120px (to x=540), potentially overlapping the page boundary and obscuring the status text. The status column needs better spacing.
3. **Content overflow on Page 1** -- When there are many findings AND server info AND scanner breakdown, the Y position runs below the footer without proper overflow handling, causing sections to overlap or be cut off.
4. **No Download PDF button** -- Need a button on the scan results UI that links to the stored PDF in cloud storage.

### Changes

**1. `supabase/functions/generate-scan-report/index.ts` -- Fix PDF layout**

- **TOP FINDINGS**: Remove the 8-finding limit on page 1. Instead, show findings until page space runs out, then continue on subsequent pages. All findings will appear in the detailed findings pages regardless.
- **Scanner Breakdown**: Cap the status bar width to prevent overflow (max 80px instead of 120px). Add proper column spacing so status text and bars don't overlap.
- **Page overflow protection**: Add Y-position checks before each section on page 1. If content would overlap the footer, push it to the next page.
- **Findings pagination**: The detailed findings pages (page 3+) already paginate at 6 per page, which is correct. The top findings preview on page 1 will show as many as fit (typically 10-12 with proper spacing).

**2. `src/components/scanner/ScanResults.tsx` -- Add Download PDF button**

- Add a "Download PDF" button that links to the stored report in cloud storage at `{SUPABASE_URL}/storage/v1/object/public/scan-reports/{scan_id}/report.pdf`
- The button will appear alongside the existing "Export PDF" and "Send Report" buttons when the scan status is "done"
- If the stored PDF doesn't exist yet (not yet generated/uploaded), clicking it will fall back to generating and downloading via the existing export flow
- The button will use the `FileDown` icon from lucide-react to visually distinguish it from "Export PDF"

### Technical Details

PDF layout fixes in `generate-scan-report/index.ts`:

```text
Scanner Breakdown:
  - Status bar: max width changed from 120px to 80px
  - Bar position shifted to x=430 (was x=420) to avoid text overlap
  - Add alternating row backgrounds consistently

Top Findings:
  - Change slice(0, 8) to slice(0, 12) to show more on page 1
  - Add overflow check: if sy < 80, stop rendering and show "continued on next page"

Page 1 sections with Y-guard:
  - Each section checks if sy > minimum_required_height before rendering
  - Prevents footer overlap
```

Download button in `ScanResults.tsx`:

```text
New button: "Download PDF"
  - Links to: {SUPABASE_URL}/storage/v1/object/public/scan-reports/{scan_id}/report.pdf
  - Opens in new tab (target="_blank")
  - Placed before "Export PDF" button
  - Uses FileDown icon
```

### Files Modified

- `supabase/functions/generate-scan-report/index.ts` -- Fix layout overflow, increase findings shown, fix bar widths
- `src/components/scanner/ScanResults.tsx` -- Add Download PDF button linking to cloud storage  
  
Please bring back the old logo in /dashboard and only use the new logo for the PDF reports and nothing else