
# Animate Attack Lines: Traveling Beam + Projectile Dots

## What's Happening Now vs. What the User Wants

**Current behavior:**
- The "full arc backbone" (`attack-full-arcs`) renders the **entire dashed path immediately** when a threat appears. This makes every line look static — you can see the whole path from India → Somalia before any animation happens.
- The progressive arc (`attack-arcs`) draws from source → Somalia over 2 seconds, but because the full dashed rail is already visible underneath, the motion is barely perceptible.
- No projectile dot travels along the path.

**What the user wants (matching the reference screenshot):**
- Lines visibly travel **from source country DOWN TO Somalia** — like a moving beam/missile
- The animation is clear and dynamic — you can see it moving
- Multiple arcs from different countries converging on Somalia simultaneously

## Solution: Three-Part Change

### Part 1 — Change `buildArcsGeoJSON`: Traveling Head Segment

Instead of drawing the arc from the origin all the way to the current progress position (which creates a growing trail), only show a **short tail segment** (last ~15% of the traveled path) while the attack is in flight. This makes it look like a bright beam flying through space rather than a line being drawn.

After arrival (`progress = 1`), switch back to showing the full arc path so it persists and fades as a "trace" of the hit.

```typescript
// DURING travel (progress < 1): show only tail segment = moving beam
const TAIL_FRACTION = 0.15;
const tailLength = Math.max(3, Math.floor(sliceEnd * TAIL_FRACTION));
const sliceStart = Math.max(0, sliceEnd - tailLength);
coords = state.arcCoords.slice(sliceStart, sliceEnd)  // ← short moving segment

// AFTER arrival (progress = 1): show full arc, fades over FADE_DURATION
coords = state.arcCoords  // ← full path persists then fades
```

### Part 2 — Add `buildProjectilesGeoJSON`: Bright Traveling Dot

A new GeoJSON builder that places a **bright glowing dot** at the current tip of each in-flight arc. The dot only exists while `progress > 0 && progress < 1` (while traveling). It disappears upon impact.

```typescript
function buildProjectilesGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.progress <= 0 || state.progress >= 1) continue;
    const idx = Math.min(
      Math.floor(state.progress * (state.arcCoords.length - 1)),
      state.arcCoords.length - 1
    );
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: state.arcCoords[idx] },
      properties: {
        color: ATTACK_COLORS[state.threat.attack_type],
        opacity: state.opacity,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
```

### Part 3 — New Mapbox Layers for Projectile

Two new Mapbox layers added to the map after load, above the arc layers:

```typescript
// Outer glow halo
map.addSource('attack-projectiles-source', { type: 'geojson', data: emptyFC });
map.addLayer({
  id: 'attack-projectiles-glow',
  type: 'circle',
  source: 'attack-projectiles-source',
  paint: {
    'circle-radius': 12,
    'circle-color': ['get', 'color'],
    'circle-opacity': ['*', ['get', 'opacity'], 0.25],
    'circle-blur': 1,
  },
});
// Core bright dot
map.addLayer({
  id: 'attack-projectiles-core',
  type: 'circle',
  source: 'attack-projectiles-source',
  paint: {
    'circle-radius': 3.5,
    'circle-color': ['get', 'color'],
    'circle-opacity': ['get', 'opacity'],
    'circle-stroke-width': 1.5,
    'circle-stroke-color': 'rgba(255,255,255,0.95)',
    'circle-stroke-opacity': ['get', 'opacity'],
  },
});
```

### Supporting Changes

- **`updateMapSources`**: Add the projectiles source update alongside the existing sources
- **Layer visibility toggle**: Add `attack-projectiles-glow` and `attack-projectiles-core` to the `liveOn` visibility toggle list
- **RAF loop**: The projectiles update every frame since they move continuously (already covered by the existing `updateMapSources(now)` call in the RAF tick)

## Visual Result

```text
Before:
  [India] ------dashed full line------- [Somalia]
                                          ^ whole line visible immediately, looks static

After:
  [India]             •━━━             [Somalia]
              ^ dim rail        ^ bright dot + short tail traveling at speed
  
  When it hits:
  [India] ════════════════════════════ [Somalia]  (full arc appears, fades over 3s)
                                       💥 (impact rings pulse)
```

- Multiple country arcs travel simultaneously at different progress states
- Each has a color-coded traveling dot (red for Malware, purple for Phishing, etc.)
- Upon impact: full arc appears and fades, impact bullseye pulses at Somalia

## Files Changed

| File | What |
|---|---|
| `src/pages/CyberMap.tsx` | Add `buildProjectilesGeoJSON`; modify `buildArcsGeoJSON` for traveling beam; add projectile Mapbox source + 2 layers; update `updateMapSources`; add new layer IDs to visibility toggle |

Only **one file changes** — all modifications are self-contained within the animation engine in `CyberMap.tsx`.
