

## Show Grades in Scan History and Sort by Latest First

### Problem
1. The scan history sidebar shows scan type and status but not the report grade (A/B/C/D/F), so users can't quickly see how each scan performed.
2. History items are not sorted by date -- the latest scan should appear at the top.

### Changes

**1. `src/components/scanner/ScanHistory.tsx`**
- Sort the `scans` array by `created_at` descending (newest first) before rendering.
- Accept a new `grades` prop: `Record<string, { grade: string; score: number }>` mapping scan IDs to their computed grades.
- For completed scans with a grade available, display a small colored grade badge (e.g., "A" in green, "F" in red) next to the status badge.

**2. `src/components/scanner/SecurityDashboard.tsx`**
- Add a `grades` state: `Record<string, { grade: string; score: number }>`.
- Whenever a scan result is loaded (via polling completion or `handleViewScan`), compute the grade using the same `computeStats` logic from `ScanReportCharts` and cache it in the `grades` map.
- Pass `grades` to `ScanHistory`.

**3. `src/components/scanner/ScanReportCharts.tsx`**
- Export the `computeStats` and `getGrade` functions so they can be reused by `SecurityDashboard` for grade caching.

### Sorting Logic
```text
scans sorted by created_at descending
  -> newest scan appears at top of history list
```

### Grade Display in History
Each history item will show:
```text
[VULN] [Done badge] [Grade A badge]
2025-02-25 4:39:41 PM
```

The grade badge will use the same color scheme as the report: green for A, emerald for B, yellow for C, orange for D, red for F. Only shown for completed ("done") scans that have been viewed/computed.

