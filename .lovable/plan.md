

## Enhance Threat Feed Tab: Data Table, Ministry Filter, Dynamic Banner

### What Changes

**1. Add Ministry Filter Dropdown**
Add a second dropdown next to the existing source filter that lists all monitored organizations (ministries). When selected, it filters threat entries to show only those affecting that organization's tech stack (cross-referencing `tech_fingerprints` data with CVE vendor/product fields).

**2. Replace Card Layout with High-Density Data Table**
Replace the current card-based threat feed display with a compact `Table` component showing columns:
- **Source** (colored badge: CISA KEV red, NVD blue, URLhaus orange, Feodo purple)
- **CVE ID / Identifier** (CVE ID, URL, or IP:port depending on source)
- **Severity** (Critical/High/Medium/Low badge)
- **Ministry Affected** (matched org name or "Global" if no specific match)
- **Published Date** (formatted date)
- **Description** (truncated, expandable on click)

All threat entries from all 4 sources are combined into one unified table, sorted by date descending.

**3. Refresh Button Loading State**
The existing "Refresh Feed" button already calls `fetchThreatFeed()`. Add:
- A local `feedLoading` state that shows a spinner on the button while fetching
- Disable the button during fetch
- Show a toast on completion with count of entries loaded

**4. Dynamic National Threat Level Banner**
Update the existing `nationalThreatLevel` calculation so that when the average score across all scorecards exceeds 75%, the banner changes to a deeper pulsing red with "CRITICAL ALERT" text. Currently, the logic is based on worst grade (F = CRITICAL). Add an additional condition: if average percentage drops below 25% (meaning very poor scores), also trigger CRITICAL ALERT mode.

**5. Cyan Styling**
The existing design already uses `neon-cyan` (which maps to `#00cfd5`) for borders and highlights. Ensure the Threat Feed tab elements (table borders, active filter highlights, source badges) use `border-neon-cyan/30` for active states and the dark charcoal background is maintained.

### Technical Details

**File: `src/pages/ThreatIntelligence.tsx`**

Changes in the Threat Feed tab section (lines ~954-1088):

- Add state: `feedLoading` (boolean), `ministryFilter` (string, default 'All')
- Add a ministry filter `Select` dropdown populated from `orgs` list
- Build a unified `allThreats` array that merges `cisaKEV`, `latestCVEs`, `maliciousUrls`, and `feodoC2` into a common shape: `{ id, source, severity, title, description, date, ministryAffected }`
- Ministry matching logic: For CISA KEV, match `vendorProject`/`product` against `tech_fingerprints` per org. For NVD, match description keywords. For URLhaus/Feodo, check if `.so` domain or Somalia country code.
- Render as a `Table` with `TableHeader`/`TableBody`/`TableRow`/`TableCell`
- Wrap `fetchThreatFeed` call with `setFeedLoading(true/false)`
- Update `nationalThreatLevel` to also check average score threshold

**No database or edge function changes needed** -- all data already flows correctly from the existing `fetch-threat-intel` edge function.

### Files Changed

| File | Action |
|---|---|
| `src/pages/ThreatIntelligence.tsx` | Edit -- restructure Threat Feed tab with table layout, ministry filter, loading state, dynamic banner logic |

