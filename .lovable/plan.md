
# Two-Part Upgrade: Somalia Click Popup + Public Threat Map

## Overview

**Part 1 — Somalia Click Popup on `/cyber-map`:**
When a user clicks anywhere within Somalia on the map, a styled panel appears (exactly like the Check Point reference) showing:
- 🇸🇴 Somalia flag emoji + "Somalia" heading + close button
- **ATTACK TREND** — area chart (last 30 days, pink fill, recharts AreaChart)
- **MALWARE TYPE TRENDS** — each attack type listed with a mini sparkline + percentage

**Part 2 — Make `/threat-map` publicly accessible:**
- Move the `/threat-map` route outside `ProtectedRoutes` in `App.tsx`
- Switch its map token source from `get-map-token` (requires auth) → `public-stats` (no auth needed)
- Replace `useAlerts()` (requires auth/RLS) with data from `public-stats` extended to include `map_points`
- Keep all visuals identical — dots, clusters, popups — just powered by public data

---

## Part 1: Somalia Click Popup — `/cyber-map`

### How the Click Is Detected
Mapbox has a `map.on('click', callback)` that fires for any map click. We check if the clicked coordinate is within Somalia's rough bounding box:
- Lat: 0° – 12°N
- Lng: 41° – 51°E

If the click falls in this zone, show the Somalia panel. Clicking a source country dot outside Somalia does not trigger it.

### Panel Design (matching reference image exactly)
```
┌────────────────────────────────────┐
│ 🇸🇴  Somalia                      ×│  ← dark glass panel, left border = pink
│  ─────────────────────────────────  │
│         ATTACK TREND               │
│         Last 30 days               │
│  [pink area chart - recharts]      │
│  ─────────────────────────────────  │
│      MALWARE TYPE TRENDS           │
│      % of affected systems         │
│                                    │
│  Malware    [~sparkline~]   31.2%  │
│  Phishing   [~sparkline~]   18.7%  │
│  Exploit    [~sparkline~]   14.3%  │
│  DDoS       [~sparkline~]    9.8%  │
│  Intrusion  [~sparkline~]    5.1%  │
└────────────────────────────────────┘
```

**Panel positioning:** Absolute overlay at right side of map (like a side drawer), not a Mapbox popup — this avoids z-index and Mapbox popup styling issues.

### Data for Charts
All chart data is **deterministically seeded** (no real API call needed):
- **30-day attack trend:** Generate 30 numbers using a seeded pseudo-random pattern that creates realistic-looking peaks and valleys (sine wave + noise). Pink fill, matching the reference.
- **Malware type percentages:** Fixed realistic percentages derived from the live attack stream counts (ratio of each attack type in `useLiveAttacks` history). Sparklines are tiny 60×30px recharts LineCharts with no axes.

### Implementation in `CyberMap.tsx`
Add state:
```typescript
const [somaliaPanel, setSomaliaPanel] = useState(false);
```

Add map click handler inside the `map.on('load', ...)` block:
```typescript
map.on('click', (e: any) => {
  const { lat, lng } = e.lngLat;
  // Somalia bounding box check
  if (lat >= 0 && lat <= 12 && lng >= 41 && lng <= 51) {
    setSomaliaPanel(true);
  }
});
```

The panel renders as a React component absolutely positioned over the map — no Mapbox popup DOM manipulation needed.

### Somalia Panel Component
A new small component `SomaliaPanel` defined in the same file or a separate file:
```tsx
interface SomaliaPanelProps {
  threats: LiveThreat[];
  onClose: () => void;
}
```

Uses `recharts` (already installed) for:
- `AreaChart` (30 data points, pink gradient fill `#f472b6`)
- `LineChart` per attack type (sparkline, no axes, tiny 60×30px)

---

## Part 2: Public `/threat-map`

### Routing Change — `src/App.tsx`
Move `/threat-map` from inside `ProtectedRoutes` to the public routes section:
```tsx
<Route path="/login" element={<Login />} />
<Route path="/public" element={<Landing />} />
<Route path="/cyber-map" element={<CyberMap />} />
<Route path="/threat-map" element={<ThreatMap />} />   // ← MOVED HERE (public)
<Route path="/*" element={<ProtectedRoutes />} />
```
Inside `ProtectedRoutes`, remove the `/threat-map` route entry.

### Token Fix — `src/pages/ThreatMap.tsx`
Replace the `get-map-token` call with `public-stats`:
```typescript
// BEFORE (requires auth, causes 401):
const { data } = await supabase.functions.invoke('get-map-token', {
  headers: { Authorization: `Bearer ${accessToken}` },
});
setMapToken(data.token);

// AFTER (no auth required):
const { data } = await supabase.functions.invoke('public-stats');
setMapToken(data.mapbox_token);
```

### Data Fix — `src/pages/ThreatMap.tsx`
The `useAlerts()` hook queries the `alerts` table which has RLS blocking anonymous users. For the public map we use `public-stats` which returns `map_points` (to be added to the edge function).

**Extend `public-stats/index.ts`** to also return `map_points`:
```typescript
// Join alerts with organizations to get coordinates
const { data: mapData } = await supabase
  .from('alerts')
  .select('severity, organizations(lat, lng, region, sector)')
  .eq('status', 'open');

// Group by coordinate bucket, return counts + dominant severity only
const pointBuckets = new Map();
for (const row of mapData ?? []) {
  const org = row.organizations;
  if (!org?.lat || !org?.lng) continue;
  const key = `${org.lat.toFixed(2)},${org.lng.toFixed(2)}`;
  // ... aggregate
}
// Response includes: map_points: [{ lat, lng, severity, count, region, sector }]
```

**In `ThreatMap.tsx`:** Replace `useAlerts()` and `alertsToGeoJSON()` with data from `public-stats.map_points` converted to GeoJSON locally. Clusters, dots, and severity colors all remain the same — only the data source changes.

**Popups in public mode:** Since we don't have alert titles (no PII), the click popup shows:
- Severity badge
- Region name
- Sector
- Count ("3 active alerts in this area")
- No "View Details →" button (no auth to navigate to alert detail)

### Remove `useNavigate` + `useQueryClient` from ThreatMap
Those are only needed for navigation to alert detail pages and realtime invalidation — both require auth context. In public mode, we simply remove those dependencies and the realtime subscription (public users shouldn't trigger realtime connections).

---

## Files to Change

| File | Change |
|---|---|
| `src/pages/CyberMap.tsx` | Add Somalia bounding box click detection + `SomaliaPanel` overlay component |
| `src/hooks/useLiveAttacks.ts` | Export `recentAttacks` (last 20) for the panel's type trend percentages |
| `src/App.tsx` | Move `/threat-map` route to public section |
| `src/pages/ThreatMap.tsx` | Switch token + data source to `public-stats`; remove auth deps; update popup content |
| `supabase/functions/public-stats/index.ts` | Add `map_points` array to response |

---

## Visual Details of Somalia Panel

**Panel CSS:**
- Background: `rgba(10, 10, 20, 0.95)` with `backdrop-filter: blur(12px)`
- Left border: 3px solid `#f472b6` (pink)
- Width: 320px
- Position: absolute, right 16px, top ~80px (below the header)
- Max-height: 80vh, overflow-y auto
- Border-radius: 8px

**30-day area chart (large):**
- Height: 120px, width: 100%
- Pink gradient fill: from `#f472b6` at top to transparent at bottom
- Pink stroke line
- No axes labels
- Tooltip disabled
- Data: 30 seeded pseudo-random values (450–2800 range)

**Sparklines per attack type:**
- 60×30px LineChart per row
- Color matches attack type color (red, purple, orange, yellow, cyan)
- No axes, no grid, no tooltip
- Data: 15 seeded points

**Percentage values:**
- Calculated from the proportion of each attack type in the live `threats` state
- Falls back to fixed realistic defaults if not enough data yet
