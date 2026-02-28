

## Update Global Threat Map for Worldwide Attack Flows

### Overview
Update the threat map to visualize attacks between ANY source and target countries (not just targeting Somalia), and update sidebars to show both top attackers and top targets.

### Changes

#### 1. `src/hooks/useLiveThreatAPI.ts` -- Add `topAttackers` and `topTargets`

- Add new `TopCountry[]` state: `topAttackers` and `topTargets`
- Read from `data.top_attackers` and `data.top_targets` in the API response
- Keep `topCountries` as a fallback alias for `topAttackers` for backward compat
- Export both from the hook's return type

#### 2. `src/pages/ThreatMapStandalone.tsx` -- UI Updates

**Right sidebar changes:**
- Rename "TOP ATTACKING COUNTRIES" section to use `topAttackers` array
- Add a NEW "TOP TARGETED COUNTRIES" section below it using `topTargets` array with blue-tinted bars instead of red
- Both sections: flag + country name + count + mini bar

**Left sidebar live feed:**
- Change event text format from `"{label} · {source.country}"` to `"{label} from {source.country} -> {target.country}"`

**Right sidebar recent events:**
- Change from `"{label} from {source.country}"` to `"{label} from {source.country} -> {target.country}"`

**Mobile bottom panel:**
- Update event display similarly

#### 3. `src/components/cyber-map/ThreatMapEngine.tsx` -- Country Highlighting

Add dynamic country highlighting based on top attackers and top targets:
- Accept new optional props: `topAttackerCCs?: string[]` and `topTargetCCs?: string[]`
- After the Somalia highlight layer is added, add two more layers:
  - `top-attackers-fill`: red/orange tint (`rgba(239,68,68,0.2)`) for countries matching top 3 attacker CCs
  - `top-targets-fill`: blue tint (`rgba(59,130,246,0.2)`) for countries matching top 3 target CCs
- Update these layers' filters whenever the props change (via a `useEffect`)
- Somalia keeps its existing teal highlight (always on top)

The arc rendering already uses `threat.source` and `threat.target` coordinates from the data -- no changes needed to arc logic since `mapEvent` already maps `source.lat/lng` and `target.lat/lng` from the API correctly.

#### 4. `src/pages/ThreatMapStandalone.tsx` -- Pass new props to engine

- Derive `topAttackerCCs` = first 3 CCs from `topAttackers`
- Derive `topTargetCCs` = first 3 CCs from `topTargets`
- Pass both to `ThreatMapEngine`

### What stays the same
- All arc animation logic (canvas + Mapbox layers) -- already uses per-event source/target coords
- Somalia teal glow highlight
- Header with LIVE indicator, pause/resume, refresh
- Attack type bar chart, data sources panel
- Color coding per attack type
- All existing routes and navigation

