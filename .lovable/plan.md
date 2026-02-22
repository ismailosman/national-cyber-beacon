
## Switch Dashboard to Organizations Table and Show Top 6

### Problem
The dashboard queries `organizations_monitored` which has 44 entries (with duplicates like "Dahabshiil Bank" + "Dahabshiil International Bank", "Ministry of Communications" + "Ministry of Communications & Technology", etc.). The canonical `organizations` table has the correct 34 entries.

### Changes

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | Switch `monitoredOrgs` query from `organizations_monitored` to `organizations` table; map `domain` field to `url` for compatibility; limit org cards grid to top 6 by score |

### Technical Details

**1. Switch data source (line 36-43)**

Replace the `organizations_monitored` query:
```typescript
const { data } = await supabase
  .from('organizations')
  .select('*');
return (data || []).map(org => ({
  ...org,
  url: org.domain.startsWith('http') ? org.domain : `https://${org.domain}`,
  is_active: true,
}));
```

The `organizations` table uses `domain` (bare domain like `mof.gov.so`) instead of `url` (full URL like `https://mof.gov.so`), so we prepend `https://` where needed.

**2. Limit org cards to top 6 (around line 320)**

After sorting `filteredCards`, slice to show only the top 6:
```typescript
const displayCards = filteredCards.slice(0, 6);
```

This ensures only the 6 highest-scoring organizations appear in the grid (since default sort is `score-desc`).

**3. Update query key**

Change the query key from `'dashboard-monitored-orgs'` to `'dashboard-organizations'` and update the realtime subscription to listen on `organizations` instead of `organizations_monitored`.

### Result
- Dashboard will show 34 organizations (matching the Organizations page)
- No duplicates
- Org grid displays only the top 6 highest-scoring organizations
- All other dashboard sections (charts, heat map, sector comparison) continue to use the full 34-org dataset
