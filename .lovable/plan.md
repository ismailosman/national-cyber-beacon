
# Static Map + Attack Animations on Both Maps

## What the User Wants

Looking at the two reference images:
- **Image 1 (current /threat-map):** Shows a static dark map centered on Somalia/East Africa, with colored alert dots clustered near Somalia. The map is NOT interactive — it just shows a fixed view.
- **Image 2 (Check Point reference):** The world map is completely static — no panning or zooming. Only the animated attack arcs move. The background map never shifts.

The user wants:
1. **`/threat-map`** — Keep the alert dots AND add the attack arc animations flowing into Somalia. Lock the map so it cannot be panned/zoomed by the user.
2. **`/cyber-map`** — Lock the map completely (disable all user interaction). Only the arcs should animate. Currently `interactive: true` allows panning.

---

## Changes Required

### 1. `src/pages/CyberMap.tsx` — Disable all map interaction

Currently the map is initialized with `interactive: true`. Change to fully disable user control:

```typescript
const map = new mapboxgl.Map({
  container: mapContainer.current,
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [20, 10],
  zoom: 2,
  projection: 'mercator',
  interactive: false,          // ← disable ALL user interaction
  pitchWithRotate: false,
  dragRotate: false,
  attributionControl: false,
});
```

Setting `interactive: false` disables: drag pan, scroll zoom, double-click zoom, touch zoom, keyboard navigation — everything. The map becomes a pure canvas for the arc animations, exactly like the Check Point reference.

Also remove the `NavigationControl` (zoom buttons) since interaction is disabled — they'd serve no purpose.

### 2. `src/pages/ThreatMap.tsx` — Add attack arc animations + lock map

This is the main work. The threat map currently shows static alert dots. We need to add the full animation engine from `CyberMap.tsx` alongside the existing dots, and lock the map view.

**Two layers of data will coexist:**
- **Static layer:** Alert dots from `public-stats` map_points (colored by severity, clustered)
- **Animation layer:** Live attack arcs flying into Somalia from `useLiveAttacks` hook

**Map initialization changes:**
```typescript
const map = new mapboxgl.Map({
  container: mapContainer.current,
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [46, 5.5],   // centered on Somalia/East Africa
  zoom: 4,             // slightly wider zoom to show attack source regions
  interactive: false,  // ← lock the map completely
  pitchWithRotate: false,
  dragRotate: false,
  attributionControl: false,
});
```

**New arc sources and layers added inside `map.on('load')`** (identical to CyberMap):
- `attack-arcs-source` → GeoJSON LineString features, animated
- `attack-sources-source` → GeoJSON Point features (source country dots + labels)
- `attack-impact-source` → GeoJSON Point features (impact rings at Somalia targets)

**New layers:**
- `attack-arcs-glow` — fat translucent glow behind each arc
- `attack-arcs` — sharp 2px colored line
- `attack-sources-dot` — glowing dot at attack origin
- `attack-sources-label` — country name label
- `attack-impact` — pink ring at Somalia impact points

**Bring in from `useLiveAttacks`:**
```typescript
import { useLiveAttacks, LiveThreat, AttackType } from '@/hooks/useLiveAttacks';
const { threats, todayCount } = useLiveAttacks(true); // always on
```

**Animation engine (copied from CyberMap):**
- `arcStatesRef`, `seenIdsRef`, `isDirtyRef`, `rafRef` — same refs
- `computeBezierArc()` — same Bezier math
- `buildArcsGeoJSON()`, `buildSourcesGeoJSON()`, `buildImpactGeoJSON()` — same builders
- `requestAnimationFrame` loop — identical tick function

**Remove cluster-click zoom interaction** (since `interactive: false` means no clicks anyway — remove the `map.on('click', 'alerts-clusters', ...)` handler). The popups on dot-click are also removed since clicks are disabled.

The Somalia panel click detection in ThreatMap is also skipped since interactive is off — but we can keep the Somalia panel accessible via a dedicated button instead.

**Remove NavigationControl** — not useful with a locked map.

**Remove filter bar** — since the map is now primarily an animation display, the severity filter bar adds complexity without much value in the "static + animated" context. The legend in the corner still shows counts.

---

## Visual Result

### `/threat-map` after changes:
```
┌──────────────────────────────────────────────────────┬──────────────┐
│                                                      │ Alert        │
│   [LOCKED DARK MAP - East Africa / Somalia view]     │ Hotspots     │
│                                                      │ feed         │
│   ~~~arc from China~~~>●Somalia                      │              │
│   ~~~arc from Russia~~>●Somalia                      │ Severity     │
│   ~~~arc from USA~~~~~>●Somalia                      │ breakdown    │
│                                                      │              │
│   ● ● (alert dots, clustered by severity)            │              │
│                                                      │              │
│ [Legend: bottom-left]                                │              │
└──────────────────────────────────────────────────────┴──────────────┘
```

### `/cyber-map` after changes:
- Identical to current, but the map canvas is locked — no panning when user drags.
- Only the attack arcs animate. Exactly like Check Point's live map.

---

## Files to Change

| File | Change |
|---|---|
| `src/pages/CyberMap.tsx` | Set `interactive: false`, remove NavigationControl |
| `src/pages/ThreatMap.tsx` | Add full attack arc animation engine; lock map with `interactive: false`; remove NavigationControl and cluster-click handlers; import `useLiveAttacks` |

---

## Technical Notes

- `interactive: false` is a single Mapbox GL JS option that disables all gesture-based interaction in one setting — no need to disable individual handlers.
- The arc animation engine runs via `requestAnimationFrame` entirely in React refs — it does not depend on map interaction at all, so locking the map has zero effect on animation performance.
- The existing alert dot layers (`alerts-source`, `alerts-clusters`, `alerts-unclustered`) are kept in ThreatMap. The new arc layers sit on top of them using the standard Mapbox layer ordering (layers added later render on top).
- Memory is managed cleanly: the `requestAnimationFrame` loop is cancelled on unmount, and arc states are stored in a `Map` ref with automatic expiry (arcs fade out after `VISIBLE_DURATION` seconds and are deleted from the map).
