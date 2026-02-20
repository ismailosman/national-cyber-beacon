

## Fix: Uptime Monitor Should Use Main Organizations Table

### Problem
The Uptime Monitor page queries `organizations_monitored` (17 entries) instead of the main `organizations` table (36 entries). This is a separate, outdated table that was likely created before the main organizations registry was fully built out.

### Solution
Change `UptimeMonitor.tsx` to fetch from the `organizations` table instead of `organizations_monitored`. The field mapping is straightforward:

| `organizations_monitored` | `organizations` |
|---|---|
| `name` | `name` |
| `url` | `domain` (needs `https://` prefix) |
| `sector` | `sector` |
| `is_active` | always active (all 36 are monitored) |

### Changes

**File: `src/pages/UptimeMonitor.tsx`**

1. **`loadOrgs` function (line 93-101)**: Change query from `organizations_monitored` to `organizations`. Map `domain` to `url` (prepending `https://` if not already present). Remove the `is_active` filter since all orgs in the main table are monitored.

2. **`handleAddOrg` function (line 414-429)**: Change insert target from `organizations_monitored` to `organizations`, mapping `url` to `domain` and adding required fields (`risk_score`, `status`, `region`).

3. **`handleRemoveOrg` function (line 432-438)**: Remove this functionality or change to delete from `organizations`. Since the main org table shouldn't have entries casually removed from uptime monitoring, the delete button can be hidden or repurposed.

4. **Sector filter list (line 55)**: Update to match the sectors used in the `organizations` table: `Government`, `Bank`, `Telecom`, `Health`, `Education`, `Other` (currently has `Banking` and `Healthcare` which don't match).

5. **URL handling**: The `organizations` table stores bare domains (e.g., `hormuud.com`), while the ping function needs full URLs. The mapping will prepend `https://` to domains that don't already have a protocol prefix.

6. **Uptime history matching**: The `loadUptimeHistory` function matches by `organization_id`. Since both the org records and new pings will use the same IDs from the `organizations` table, this will work correctly. Historical logs from the old `organizations_monitored` IDs won't match, but new pings going forward will.

### Technical Details

The key query change:
```
// Before:
supabase.from('organizations_monitored').select('*').eq('is_active', true).order('name')

// After:
supabase.from('organizations').select('id, name, domain, sector').order('name')
// Then map: { id, name, url: domain.startsWith('http') ? domain : `https://${domain}`, sector }
```

### Files Changed

| File | Action |
|---|---|
| `src/pages/UptimeMonitor.tsx` | Switch data source from `organizations_monitored` to `organizations`, update sector filters, adjust add/remove handlers |
