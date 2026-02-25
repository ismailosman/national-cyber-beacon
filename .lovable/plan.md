
## Set Default Sector Filter to "Telecom" in Organization Security Scores

### Change
In `src/components/dashboard/OrgScoresBarChart.tsx`, update the initial state of the `sectorFilter` from `'All'` to `'Telecom'` so the bar chart defaults to showing only Telecom organizations.

### Technical Detail
**File: `src/components/dashboard/OrgScoresBarChart.tsx`** (line 46)
- Change `useState('All')` to `useState('Telecom')`

One-line change. Everything else stays the same.
