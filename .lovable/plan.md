

## Add DAST Scanner Results to Dashboard Organization Overview

### What Changes

The Organization Security Overview cards on the dashboard will display DAST scan data from the scanner, replacing the current "DAST: ---" placeholder with real results including the DAST grade, finding counts, and scan date.

### Changes

#### 1. Update OrgCard component (`src/components/dashboard/OrgCard.tsx`)

- Replace the simple "DAST: grade" text with a richer display showing:
  - DAST letter grade (A-F) with color coding (A/B = green, C = amber, D/F = red)
  - Finding summary counts (critical/high/medium/low) as small colored badges
  - Last scanned date
- Add new props: `dastSummary` (critical, high, medium, low, passed counts) and `dastScannedAt` (date string)

#### 2. Pass DAST data through Dashboard (`src/pages/Dashboard.tsx`)

- The dashboard already fetches `dast_scan_results` and computes `dastGrade`. Extend this to also pass:
  - `dastSummary` object from the `summary` column (critical, high, medium, low, passed counts)
  - `dastScannedAt` timestamp
- Update the `orgCardsData` memo to include these new fields from the existing `dastResults` query (which already fetches `dast_score`). Expand the query to also select `summary` and `scanned_at`.

### Technical Details

**Dashboard.tsx -- dast query expansion** (around line 106):
```typescript
// Change from:
select('organization_id, dast_score')
// To:
select('organization_id, dast_score, summary, scanned_at')
```

**Dashboard.tsx -- orgCardsData memo**: Add `dastSummary` and `dastScannedAt` from the latest DAST result per org.

**OrgCard.tsx -- enhanced DAST display**: Replace the single "DAST: ---" line with:
- Grade badge (colored A-F)
- Row of small finding count indicators: e.g., "2C 3H 5M" (critical/high/medium)
- If no DAST data, show "Not scanned" in muted text

### Visual Result

Each org card will show DAST findings inline, like:
```
DAST: A  |  0C  0H  1M  3L
Scanned: Feb 21
```

Cards with poor DAST grades (D/F) will have the grade highlighted in red, making it immediately visible which organizations need attention.
