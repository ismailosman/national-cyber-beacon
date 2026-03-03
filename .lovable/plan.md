

## Add Ransomware Feed Tab and Arc Integration

This is a large feature spanning 4 files. Here is the plan:

### 1. API Proxy -- Allow ransomware path prefix
**File: `supabase/functions/api-proxy/index.ts`** (line 10-16)
- Add `"/ransomware/"` to `ALLOWED_PREFIXES` array

### 2. Data Hook -- Add ransomware polling and types
**File: `src/hooks/useLiveThreatAPI.ts`**
- Add `ransomware` to `TYPE_MAP` so `mapType('ransomware')` returns a new value (we'll map it to `'malware'` as the closest AttackType since we can't extend the union easily, but preserve the color override `#9900ff` from the API event)
- Add new exported interfaces: `RansomwareVictim`, `RansomwareGroup`, `RansomwareStats`
- Add new state: `ransomware` (holds `{ recent_victims, groups, stats }`)
- Add `SourcesActive.ransomware_live?: boolean`
- Add a separate `fetchRansomware` callback that polls `/ransomware/live` every 30 minutes (1,800,000ms)
- Merge ransomware events into the main `events` array (they have source/target coords so they become arcs automatically)
- Expose `ransomware` data and state from the hook's return

### 3. Arc Map Integration
**File: `src/components/cyber-map/ThreatMapEngine.tsx`** (lines 83-98, spawn canvas arcs)
- When a threat's `source_api === 'Ransomware.live'`, use `baseAlpha: 0.85` (like Kaspersky) for visual emphasis
- The color `#9900ff` is already passed through from the API event via `(threat as any).color`, so purple arcs work automatically
- No `lineWidth` changes needed -- the existing glow effect at lineWidth 14 + core at 3.5 already creates a thick visual. The color alone distinguishes ransomware arcs.

### 4. Feed Prefix
**File: `src/pages/ThreatMapStandalone.tsx`** (feedPrefix function, line 29-33)
- Add: if `source_api === 'Ransomware.live'` return `[RMW]` in purple (`#9900ff`)

### 5. New "Ransomware Feed" Tab
**File: `src/pages/ThreatMapStandalone.tsx`**
- Extend `activeTab` type from `'map' | 'ksn'` to `'map' | 'ksn' | 'ransomware'`
- Add tab button `💀 Ransomware` in the header tab bar (lines 198-204)
- Add new tab content panel (after the KSN tab block, before the map block):

**Tab layout (4-panel grid):**

```text
┌──────────────────────────────────────────────────────┐
│  HEADER: 4 stat cards (grid-cols-2 md:grid-cols-4)   │
│  💀 Victims  🏴‍☠️ Groups  🏥 Top Sector  🌍 Top Country│
├──────────────┬──────────────┬────────────────────────┤
│ LEFT:        │ CENTER:      │ RIGHT:                 │
│ Recent       │ Top Groups   │ Victims by Sector      │
│ Victims      │ bar chart    │ bar chart              │
│ (scrollable) │ (CSS bars)   │ (CSS bars)             │
├──────────────┴──────────────┴────────────────────────┤
│ BOTTOM: Victims by Country (ranked list with flags)  │
└──────────────────────────────────────────────────────┘
```

- **Stat cards**: Pull from `ransomware.stats` -- `total_victims`, `total_groups`, top sector (first entry of `by_sector`), top country (first entry of `by_country`)
- **Recent Victims**: Scrollable list of `ransomware.recent_victims` (max 20), sorted by `attackdate` desc. Each row shows group name (red/orange), victim name, sector, date, country flag
- **Top Groups**: Horizontal CSS bars from `ransomware.stats.by_group` (array of `[name, count]`), sorted desc
- **Victims by Sector**: Horizontal CSS bars from `ransomware.stats.by_sector`
- **Victims by Country**: Ranked list with country flags from `ransomware.stats.by_country`

### 6. Data Sources Panel Update
**File: `src/pages/ThreatMapStandalone.tsx`**
- Add `SourceDot` for `Ransomware.live` in both the desktop left panel data sources section and the mobile drawer's Sources tab
- Show victim count next to it

### 7. Mobile Drawer
- Add `'ransomware'` to the mobile drawer tab options
- Render a simplified version of the ransomware tab content (stat cards + recent victims list + top groups) in the drawer

### Technical Details

**New types in `useLiveThreatAPI.ts`:**
```typescript
export interface RansomwareVictim {
  victim: string; group: string; country: string;
  activity: string; attackdate: string;
  website?: string; description?: string;
}
export interface RansomwareData {
  recent_victims: RansomwareVictim[];
  groups: any[];
  stats: {
    total_victims: number; total_groups: number;
    by_group: [string, number][];
    by_country: [string, number][];
    by_sector: [string, number][];
  };
}
```

**Polling architecture:** The ransomware endpoint is polled independently from the main threat feed, on a 30-minute interval. Ransomware arc events from the response are merged into the main events array. The stats/victims/groups data is stored separately for the tab UI.

