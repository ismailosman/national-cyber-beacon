
# Apply Enhanced Arc Animations to `/threat-map`

## What's Missing in ThreatMap vs CyberMap

Comparing the two files, `ThreatMap.tsx` is behind on several animation features that `CyberMap.tsx` already has:

| Feature | CyberMap | ThreatMap |
|---|---|---|
| Arc opacity (stacking) | `0.65` semi-transparent | `1.0` (no stacking) |
| Arc persistence | 15s VISIBLE_DURATION | 8s (arcs disappear quickly) |
| Travel speed | 2.0s | 2.5s |
| Pulsing source rings | `attack-ring-source` + `buildRingsGeoJSON` + RAF update | Missing entirely |
| Somalia bullseye center dot | `attack-impact-solid` | Missing |
| Somalia outer ring | `attack-impact-outer` | Missing |
| Inner ring | Uses `attack-impact` with stroke | Has basic `attack-impact` but no glow |
| RAF ring update | Updated every frame even when no arc changes | Not updated between arc changes |

## Changes to `src/pages/ThreatMap.tsx`

### 1. Match animation constants to CyberMap
```typescript
// Change from:
const TRAVEL_DURATION = 2.5;
const VISIBLE_DURATION = 8;
const FADE_DURATION    = 2;
// To:
const TRAVEL_DURATION  = 2.0;
const VISIBLE_DURATION = 15;
const FADE_DURATION    = 3;
const RING_PERIOD      = 2000;
```

### 2. Add `buildRingsGeoJSON` function (copy from CyberMap)
This function collects all currently active source countries from `arcStatesRef`, then emits two staggered ring features per country with radius expanding 4→26px and opacity fading 0.85→0, driven by `performance.now()`.

### 3. In `map.on('load')` — add pulsing ring source + layer
After the existing sources:
```typescript
map.addSource('attack-ring-source', { type: 'geojson', data: emptyFC });
map.addLayer({
  id: 'attack-ring',
  type: 'circle',
  source: 'attack-ring-source',
  paint: {
    'circle-radius': ['get', 'radius'],
    'circle-color': 'transparent',
    'circle-stroke-width': 1.5,
    'circle-stroke-color': ['get', 'color'],
    'circle-stroke-opacity': ['get', 'ringOpacity'],
  },
});
```

### 4. Replace single impact layer with three-layer bullseye
Remove the existing basic `attack-impact` layer and replace with the full CyberMap bullseye stack:

**Layer 1 — `attack-impact-solid`:** Solid bright pink 5px dot at Somalia target coordinates. No stroke — filled circle, opacity 0.9.

**Layer 2 — `attack-impact`:** Inner ring, transparent fill, 2px pink stroke, radius scales with incoming hit count (`10 + count/2`).

**Layer 3 — `attack-impact-outer`:** Large faint outer ring, transparent fill, 1px pink stroke at 35% opacity, radius `20 + count/1` — gives the "bullseye" layered look.

### 5. Update `updateMapSources` to include ring data
```typescript
const updateMapSources = useCallback((nowMs?: number) => {
  // ... existing arc/source/impact updates ...
  const rings = map.getSource('attack-ring-source');
  if (rings) (rings as any).setData(buildRingsGeoJSON(arcStatesRef.current, nowMs ?? performance.now()));
}, []);
```

### 6. Fix arc opacity for stacking effect
In `buildArcsGeoJSON` (ThreatMap version), the line-opacity is currently set to `['get', 'opacity']` at full value. Change the arc layer paint to match CyberMap's stacking:
```typescript
'line-opacity': ['*', ['get', 'opacity'], 0.65],
```

### 7. Update RAF loop to always refresh rings
Currently the ThreatMap RAF loop only calls `updateMapSources()` when arcs change. Rings need updating every frame for smooth pulsing. Add the same "always update rings" branch as CyberMap:
```typescript
} else {
  // Still update rings every frame for smooth pulsing
  const map = mapRef.current;
  if (map) {
    const rings = map.getSource('attack-ring-source');
    if (rings && arcStatesRef.current.size > 0) {
      (rings as any).setData(buildRingsGeoJSON(arcStatesRef.current, now));
    }
  }
}
```

## Technical Execution

All changes are confined to `src/pages/ThreatMap.tsx`. The functions `buildRingsGeoJSON` and the updated constants are copied from `CyberMap.tsx` which already has the proven working implementation. No new dependencies are needed — `recharts`, `mapbox-gl`, and `useLiveAttacks` are already imported.

The existing alert dot layers (`alerts-source`, `alerts-clusters`, `alerts-unclustered`) remain completely untouched — the new ring and bullseye layers sit on top of them.

## Files to Change

| File | Change |
|---|---|
| `src/pages/ThreatMap.tsx` | Update animation constants; add `buildRingsGeoJSON`; add `attack-ring-source` + `attack-ring` layer; replace single impact layer with three-layer bullseye; update `updateMapSources` to include rings; fix arc opacity to 0.65 for stacking; fix RAF loop to always refresh rings |
