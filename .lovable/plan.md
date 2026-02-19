
# Production-Ready Threat Map — Complete Rebuild

## What's Wrong Today

The current `/threat-map` page reads from `organizations` and `threat_events`. The user wants it to **visualize `alerts`** — the same data the `/alerts` page shows — as geo-located dots on the map.

### Key Schema Facts (critical for implementation)

- The `alerts` table has **no `lat`/`lng` columns** — location comes from joining to `organizations` (which has `lat`, `lng`, and `region`)
- There is **no `/alerts/:id` detail route** in the app — clicking a dot will navigate to `/alerts` with the alert pre-selected/highlighted instead (the safest approach that works with the existing router)
- `mapbox-gl` is **already installed** — no new dependencies needed
- The `get-map-token` edge function is **already deployed and working**
- Alert severity enum: `critical | high | medium | low`
- Alert status: `open | ack | closed`

---

## Architecture

### 1. Shared Hook — `src/hooks/useAlerts.ts` (NEW)

Extract the alert-fetching logic from `Alerts.tsx` into a reusable hook so both the Alerts page and the Threat Map consume identical data with zero duplication:

```ts
// Fetches alerts joined with organizations (for name, lat, lng, region, sector)
export function useAlerts(filters: AlertFilters) {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: async () => {
      let q = supabase
        .from('alerts')
        .select('*, organizations(id, name, lat, lng, region, sector)')
        .order('created_at', { ascending: false });
      if (filters.severity !== 'all') q = q.eq('severity', filters.severity);
      if (filters.status !== 'all') q = q.eq('status', filters.status);
      const { data } = await q;
      return data || [];
    },
  });
}
```

The hook returns alerts with an embedded `organizations` object containing `lat`, `lng`, `region`, and `sector`.

### 2. Update `Alerts.tsx`

Replace the inline query in `Alerts.tsx` with `useAlerts(filters)` — no other changes to the alerts page UI. This ensures both pages stay in sync automatically via React Query's shared cache key.

### 3. Region-to-Coordinate Fallback Utility — `src/lib/regionCoords.ts` (NEW)

```ts
export const REGION_COORDS: Record<string, [number, number]> = {
  Banaadir:     [45.34, 2.05],   // [lng, lat]
  Puntland:     [49.0,  8.4],
  Somaliland:   [44.06, 9.56],
  Jubaland:     [42.55, 0.35],
  'South West': [43.4,  2.6],
  Hirshabelle:  [45.9,  3.1],
  Galmudug:     [47.2,  5.5],
};

export function getAlertCoords(alert: AlertWithOrg): [number, number] | null {
  const org = alert.organizations;
  if (!org) return null;
  // Prefer precise org coordinates
  if (org.lat != null && org.lng != null) return [org.lng, org.lat];
  // Fall back to region centroid
  const regional = REGION_COORDS[org.region];
  if (regional) return regional;
  return null; // Skip — no location available
}
```

Alerts with no org or no resolvable coordinates are excluded from the map (not rendered).

### 4. GeoJSON Memoization Utility

```ts
// Converts filtered alerts into a Mapbox GeoJSON FeatureCollection
// Memoized with useMemo to prevent re-computation on unrelated renders
export function alertsToGeoJSON(alerts: AlertWithOrg[]): GeoJSON.FeatureCollection {
  const features = alerts
    .map(alert => {
      const coords = getAlertCoords(alert);
      if (!coords) return null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          id: alert.id,
          title: alert.title,
          severity: alert.severity,
          status: alert.status,
          orgName: alert.organizations?.name ?? 'Unknown',
          region: alert.organizations?.region ?? '',
          createdAt: alert.created_at,
        }
      };
    })
    .filter(Boolean);
  return { type: 'FeatureCollection', features };
}
```

---

## Full `ThreatMap.tsx` Implementation Plan

### State Management

```ts
// Filters — mirrors Alerts.tsx
const [sevFilter, setSevFilter] = useState<'all'|'critical'|'high'|'medium'|'low'>('all');
const [statusFilter, setStatusFilter] = useState<'all'|'open'|'ack'|'closed'>('all');

// Map lifecycle
const [mapToken, setMapToken] = useState<string | null>(null);
const [mapError, setMapError] = useState<string | null>(null);
const [mapLoaded, setMapLoaded] = useState(false);
const [retryKey, setRetryKey] = useState(0); // for retry UI

// Refs
const mapContainer = useRef<HTMLDivElement>(null);
const mapRef = useRef<any>(null);
const popupRef = useRef<any>(null);
```

### Map Initialization (once, stable)

- Initialize Mapbox map **once** when token is available, using the dark style `mapbox://styles/mapbox/dark-v11`
- Disable pitch rotation: `pitchWithRotate: false`, `dragRotate: false`
- Default center: Somalia `[46, 5.5]`, zoom `5`
- On load: add the GeoJSON source + 3 layers (clusters, cluster count, unclustered dots)
- The map instance is **never re-created** — data updates use `setData()` only

### Mapbox Layers (added once on map load)

```
Source: 'alerts-source'
  type: 'geojson'
  cluster: true
  clusterRadius: 40
  clusterMaxZoom: 10

Layer 1: 'alerts-clusters' (type: circle)
  filter: ['has', 'point_count']
  circle-radius: interpolate zoom 0→16, 14→20
  circle-color: '#1e293b'  (dark navy)
  circle-stroke-color: '#00e5ff'
  circle-stroke-width: 1.5

Layer 2: 'alerts-cluster-count' (type: symbol)
  filter: ['has', 'point_count']
  text-field: '{point_count_abbreviated}'
  text-size: 11
  text-color: '#ffffff'

Layer 3: 'alerts-unclustered' (type: circle)
  filter: ['!', ['has', 'point_count']]
  circle-radius: interpolate zoom 5→6, 14→9
  circle-color: match severity:
    critical → #ef4444
    high → #f97316
    medium → #facc15
    low → #3b82f6
    fallback → #94a3b8
  circle-opacity: 0.85
  circle-stroke-width: 1
  circle-stroke-color: '#ffffff'
```

### Filter Updates (debounced, no map re-init)

When `sevFilter` or `statusFilter` changes:
1. Wait 300ms (debounce via `useEffect` with `setTimeout`)
2. Call `(map.getSource('alerts-source') as any).setData(newGeoJSON)`
3. Also re-fit bounds if alerts count changed significantly

### Cluster Click Behavior

```ts
map.on('click', 'alerts-clusters', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['alerts-clusters'] });
  const clusterId = features[0].properties.cluster_id;
  (map.getSource('alerts-source') as any).getClusterExpansionZoom(clusterId, (err, zoom) => {
    if (!err) map.easeTo({ center: features[0].geometry.coordinates, zoom });
  });
});
```

### Unclustered Dot Click — Popup or Navigation

Since there is no `/alerts/:id` route, clicking a dot shows a **Mapbox popup** styled to match the dark UI. If multiple alerts share the same coordinates, the popup lists all of them with severity badges and a "View in Alerts" button (scrolls to `/alerts` filtered by that org).

The popup HTML is injected as a string with inline styles matching the dark cybersecurity theme.

### Hover Behavior

```ts
map.on('mouseenter', 'alerts-unclustered', (e) => {
  map.getCanvas().style.cursor = 'pointer';
  // Show tooltip popup with: title, severity, org name, formatted timestamp
  const props = e.features[0].properties;
  new mapboxgl.Popup({ closeButton: false, className: 'threat-tooltip' })
    .setLngLat(e.lngLat)
    .setHTML(`...tooltip HTML...`)
    .addTo(map);
});
map.on('mouseleave', 'alerts-unclustered', () => {
  map.getCanvas().style.cursor = '';
  popupRef.current?.remove();
});
```

### Critical Alert Pulse Animation

For `severity === 'critical'` alerts, add a 4th layer `'alerts-critical-pulse'` using circle-radius with a CSS animation via a periodic `setInterval` that alternates the paint property between 8 and 14px — OR more simply, add a `@keyframes` CSS animation in `index.css` and inject a custom Mapbox HTML marker for each critical alert using `mapboxgl.Marker` with a pulsing `div` element. The GeoJSON layer handles all alerts; the pulse markers are overlaid only for critical ones (limited to 20 most recent to keep performance).

### Fit Bounds

After data loads:
```ts
if (alerts.length > 0) {
  const bounds = new mapboxgl.LngLatBounds();
  geojson.features.forEach(f => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, { padding: 60, maxZoom: 9 });
} else {
  map.flyTo({ center: [46, 5.5], zoom: 5 });
}
```

### Real-Time Updates

Subscribe to Supabase Realtime on the `alerts` table:
```ts
const channel = supabase.channel('alerts-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  })
  .subscribe();
```

When the query cache updates, the `useEffect` watching `alerts` will call `setData()`.

---

## Filter Bar UI

Above the map, a filter row matching the Alerts page style:

```
[ Status: All | Open | Ack | Closed ] [ Severity: All | Critical | High | Medium | Low ]
```

Implemented with the same `bg-muted` pill style as in `Alerts.tsx`.

---

## Dynamic Legend

A floating legend panel (bottom-right of map) showing:
- Severity colors with live counts from filtered alerts
- Cluster indicator explanation

```
LEGEND
● Critical  (N)
● High      (N)
● Medium    (N)
● Low       (N)
○ Cluster (tap to expand)
```

Counts update reactively as filters change.

---

## Sidebar Panel

Right side (280px on desktop, hidden on mobile):
- **Alert Feed**: top 8 filtered alerts (title, severity badge, org name, timestamp)
- **Severity Breakdown**: progress bars showing critical/high/medium/low counts
- Clicking a sidebar alert item highlights it on the map (flyTo its coordinates)

---

## Empty State

When no alerts match filters, show an overlay over the map:

```
  [Map icon, dim opacity]
  No alerts match current filters
  [Clear Filters button]
```

---

## Error State + Retry

When map token fails or Mapbox fails to load:
```
  [AlertTriangle icon]
  Failed to load map
  [Retry button → increments retryKey to restart init]
```

---

## CSS Additions to `index.css`

Add custom Mapbox popup styles and pulse keyframes:

```css
/* Mapbox popup override for dark theme */
.mapboxgl-popup-content {
  background: hsl(216 28% 12% / 0.95);
  border: 1px solid hsl(216 28% 20%);
  color: hsl(210 40% 95%);
  border-radius: 8px;
  padding: 12px;
  font-family: 'Inter', system-ui, sans-serif;
}
.mapboxgl-popup-tip {
  border-top-color: hsl(216 28% 12% / 0.95) !important;
  border-bottom-color: hsl(216 28% 12% / 0.95) !important;
}

/* Critical alert pulse ring */
@keyframes alert-pulse {
  0%   { transform: scale(1); opacity: 0.8; }
  70%  { transform: scale(2.5); opacity: 0; }
  100% { transform: scale(2.5); opacity: 0; }
}
.critical-pulse-ring {
  position: absolute;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #ef4444;
  animation: alert-pulse 2s ease-out infinite;
}
```

---

## Accessibility

- Map container: `role="application"` and `aria-label="Interactive threat map showing alert locations"`
- Cluster markers: no interactive ARIA needed (screen readers get the sidebar list)
- Sidebar alert list items: `role="listitem"`, `aria-label="Critical alert in Banaadir — SSL Certificate Expired"`
- Filter buttons: standard `<button>` with descriptive labels

---

## Files to Create / Edit

| File | Action |
|---|---|
| `src/hooks/useAlerts.ts` | CREATE — shared alert fetch hook with org join |
| `src/lib/regionCoords.ts` | CREATE — region fallback coordinates + `getAlertCoords()` |
| `src/pages/Alerts.tsx` | EDIT — swap inline query for `useAlerts()` hook |
| `src/pages/ThreatMap.tsx` | COMPLETE REWRITE — production map with all features |
| `src/index.css` | EDIT — add Mapbox popup dark theme CSS + pulse animation |

No database migrations, no new dependencies, no edge function changes needed. The `get-map-token` function is already deployed and working.

---

## Technical Clarifications / Assumptions Made

1. **No `/alerts/:id` route** — dot clicks show an inline Mapbox popup. If a detail route is added in future, this is trivially swappable.
2. **Alert location = org location** — since `alerts` has no coordinates, we join `organizations` and use its `lat/lng` or fall back to `region`. Alerts without a resolvable location are silently excluded.
3. **Realtime** — uses Supabase Realtime postgres_changes subscription on the `alerts` table. New alerts auto-appear on the map. Critical alerts added in real-time get the pulse animation.
4. **Performance** — GeoJSON is memoized (`useMemo`). Map source is updated via `setData()`, never re-initialized. Pulse markers are capped at 15 to prevent DOM bloat.
