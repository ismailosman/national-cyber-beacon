

## Migrate Early Warning and Threat Intelligence to Main Organizations Table

### Problem
Both the Early Warning (`/early-warning`) and Threat Intelligence (`/threat-intelligence`) pages query the legacy `organizations_monitored` table which has only 17 entries, while the main `organizations` table has 37. The `scheduled-ti-scan` edge function also uses the old table.

### Changes

**File: `src/pages/EarlyWarning.tsx`**

1. Update the `loadOrgs` function (line 166-167) to query `organizations` instead of `organizations_monitored`
2. Map `domain` to `url` with `https://` prefix: `url: d.domain.startsWith('http') ? d.domain : 'https://' + d.domain`
3. Set `is_active: true` for all records (the main table doesn't have this field but the `MonitoredOrg` interface expects it)

**File: `src/pages/ThreatIntelligence.tsx`**

1. Update the `loadOrgs` function (line 230-231) to query `organizations` instead of `organizations_monitored`
2. Same domain-to-url mapping with `https://` prefix
3. Set `is_active: true` for all records

**File: `supabase/functions/scheduled-ti-scan/index.ts`**

1. Update the query (line 18-21) from `organizations_monitored` to `organizations`
2. Select `id, name, domain, sector` instead of `id, name, url, sector`
3. Map `domain` to `url` with `https://` prefix in the org loop
4. Remove the `.eq('is_active', true)` filter

### Technical Details

The key query change in both frontend files:
```typescript
// Before:
supabase.from('organizations_monitored').select('*').eq('is_active', true)

// After:
supabase.from('organizations').select('id, name, domain, sector').order('name')
// Then map each record: { id, name, url: domain.startsWith('http') ? domain : `https://${domain}`, sector, is_active: true }
```

The edge function change:
```typescript
// Before:
supabase.from('organizations_monitored').select('id, name, url, sector').eq('is_active', true)

// After:
supabase.from('organizations').select('id, name, domain, sector')
// Then map: { ...org, url: org.domain.startsWith('http') ? org.domain : `https://${org.domain}` }
```

### Files Changed

| File | Action |
|---|---|
| `src/pages/EarlyWarning.tsx` | Switch from `organizations_monitored` to `organizations`, map domain to url |
| `src/pages/ThreatIntelligence.tsx` | Switch from `organizations_monitored` to `organizations`, map domain to url |
| `supabase/functions/scheduled-ti-scan/index.ts` | Switch from `organizations_monitored` to `organizations`, map domain to url |

