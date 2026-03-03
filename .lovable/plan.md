

## Fix Ransomware Feed Tab

The ransomware tab UI code is mostly correct for the API structure, but needs these targeted fixes:

### 1. Update `RansomwareVictim` type (`src/hooks/useLiveThreatAPI.ts`, ~line 78-86)
- Add `domain` field (API sends `domain` not `website`)
- Add `discovered` field

### 2. Sort victims by `attackdate` descending (`src/pages/ThreatMapStandalone.tsx`)
- Desktop tab (line 368): Sort `recent_victims` by `attackdate` descending before `.slice(0, 20)`
- Mobile tab (line 981): Same sort before `.slice(0, 15)`

### 3. Fix loading vs empty state
- Desktop (line 383): Show "Loading..." when `ransomware === null`, show "No victims reported" when `ransomware.recent_victims` is empty
- Mobile (line 994): Same logic
- Desktop groups (line 400) and sectors (line 418): Same pattern — null = loading, empty = no data

### 4. Stat cards are already correct
The stat cards on lines 350-354 already read from the right paths (`stats.total_victims`, `stats.total_groups`, `stats.by_sector[0][0]`, `stats.by_country[0][0]`). No changes needed.

### 5. Charts are already correct
The groups chart (line 390) and sectors chart (line 408) already destructure `[name, count]` from `by_group`/`by_sector`. No changes needed.

### Summary of file changes
- **`src/hooks/useLiveThreatAPI.ts`**: Add `domain` and `discovered` to `RansomwareVictim` interface
- **`src/pages/ThreatMapStandalone.tsx`**: Add descending sort on `attackdate` for victims lists; fix loading/empty state messages in both desktop and mobile views

