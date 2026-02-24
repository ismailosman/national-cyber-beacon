

## Add CyberDefense Security Scanner Dashboard

### Problem
The JSX markup in your SecurityDashboard, ScanForm, ScanResults, and ScanHistory components was stripped when pasted (HTML tags got interpreted as markup). The types file, API service, and StatusBadge came through fine.

### Plan

**Create 7 new files** and **update 2 existing files**:

#### New Files

1. **`src/types/security.ts`** -- Type definitions (ScanType, ScanStatus, SemgrepFinding, NucleiFinding, ZapAlert, etc.) -- copied as-is from your message.

2. **`src/services/securityApi.ts`** -- API client for the external scanner (checkHealth, startScan, getScan, listScans, deleteScan, pollScan) -- copied as-is.

3. **`src/components/scanner/StatusBadge.tsx`** -- Status badge component with queued/running/done/error states -- copied as-is.

4. **`src/components/scanner/ScanForm.tsx`** -- Scan launcher form with DAST/SAST/Full type selector, optional repo URL input, and submit button. **Reconstructed JSX** based on visible text/classes from your message, styled with Tailwind to match the dark SOC theme.

5. **`src/components/scanner/ScanResults.tsx`** -- Results viewer showing scan metadata, progress bars, summary cards, and findings from Nuclei/Semgrep/Nikto/ZAP. **Reconstructed JSX** matching your layout intent.

6. **`src/components/scanner/ScanHistory.tsx`** -- History list showing past scans with view/delete actions. **Reconstructed JSX**.

7. **`src/components/scanner/SecurityDashboard.tsx`** -- Main dashboard orchestrating all sub-components: API health indicator, scan form, results panel, and history. **Reconstructed JSX** with two-column layout (form+history on left, results on right).

#### Updated Files

8. **`src/pages/SecurityScanner.tsx`** -- New page wrapper that imports SecurityDashboard and renders it. Protected behind auth (accessible from sidebar).

9. **`src/App.tsx`** -- Add route `/security-scanner` pointing to the new SecurityScanner page inside the protected AppLayout.

10. **`src/components/layout/Sidebar.tsx`** -- Add a "Security Scanner" nav item with the `Scan` icon, linking to `/security-scanner`.

### Environment Variables

The API service requires two secrets:
- `VITE_SECURITY_API_URL` (e.g. `https://cybersomalia.com`)
- `VITE_SECURITY_API_KEY` (your server API key)

Since these are **client-side** variables (prefixed with `VITE_`), they will be embedded in the frontend bundle. I will add them to the codebase. You will need to provide the actual API key value.

### Technical Notes

- Components are placed in `src/components/scanner/` to keep them organized separately from existing components.
- The scanner page is a **new route** (`/security-scanner`), not replacing the existing Security Monitor page at `/admin/security-monitor`.
- All components use Tailwind classes matching the existing dark theme (gray-900 backgrounds, green/amber/red accents).
- The `pollScan` function polls every 5 seconds until the scan completes or errors.

