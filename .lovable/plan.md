
# Enhanced Attack Arc Animations on `/cyber-map`

## What the Reference Image Shows

The reference image (Check Point style) has these distinct visual elements not yet achieved:

1. **Bundled/stacked arcs** — Multiple arcs from the same source country accumulate and stack together, forming a thick bundle of lines (e.g., 8-10 red lines all from USA to the target). This is the most striking visual effect.
2. **Animated concentric rings at source** — Each active source country shows a pulsing/expanding ring animation (like a radar ping), not just a dot.
3. **Bright bullseye at the target** — Somalia has a bright glowing dot with multiple concentric rings that pulse outward when attacked.
4. **Arcs that persist longer** — Instead of fading quickly, arcs linger so multiple from the same source overlap visually.
5. **Color-coded by type** — Red for Malware (dominant), Orange/Yellow for other types. The bundling makes the dominant attack type visually obvious.

## Current vs. Target

| Feature | Current | Target |
|---|---|---|
| Arc persistence | ~8 seconds, then fade | ~15 seconds — long enough for stacking |
| Source indicator | Single dot | Pulsing concentric ring |
| Target indicator | Single pink ring | Bright bullseye + expanding rings |
| Arc count on screen | ~5-10 spread out | ~15-20 stacking from same sources |
| Arc opacity | Single value | Semi-transparent so stacking creates density |
| Arc width | 2px sharp | 1.5px each, but many stacked = visually thick |

## Changes to `src/pages/CyberMap.tsx`

### 1. Extend `VISIBLE_DURATION` and tweak opacity

Increase arc persistence so multiple arcs from the same source accumulate:

```typescript
const TRAVEL_DURATION  = 2.0;   // was 2.5 — slightly faster travel
const VISIBLE_DURATION = 15;    // was 8 — stay on screen 3× longer → stacking effect
const FADE_DURATION    = 3;     // was 2
```

Reduce per-arc opacity so stacked arcs build up in density:

```typescript
// In buildArcsGeoJSON — multiply opacity by 0.65 so individual arcs are semi-transparent
// but 10 stacked = visually opaque and vivid
'line-opacity': ['*', ['get', 'opacity'], 0.65],   // was 1.0 for sharp arc
```

### 2. Add pulsing source rings via a CSS-animated SVG overlay canvas

Mapbox `circle` layers can't animate their radius over time (they're static per-frame unless you update GeoJSON). The solution is to render source rings using a **Mapbox `symbol` layer trick** — actually the cleanest way is to add a second ring circle layer that uses a separate `attack-sources-ring-source` GeoJSON and update the ring radius in the RAF tick:

```typescript
// Each source gets a ring that expands over ~2s and repeats
interface RingState {
  lng: number;
  lat: number;
  country: string;
  color: string;
  startTime: number;
}
const ringStatesRef = useRef<Map<string, RingState>>(new Map());
```

In the RAF tick, compute ring progress (0→1 over 2 seconds, looping) and update a dedicated GeoJSON source with `ring-radius` and `ring-opacity` properties:

```typescript
// ring-radius: 4 + progress * 20 (expands from 4px to 24px)
// ring-opacity: 1 - progress (fades as it expands)
```

Add two Mapbox layers for rings:
- `attack-source-ring` — `circle` layer, color from properties, stroke-only (fill transparent), animated radius
- `attack-source-dot` — small solid dot at the center

### 3. Enhanced target impact at Somalia

Add a second impact layer `attack-impact-outer` with a larger radius and lower opacity for a double-ring bullseye effect. Also add `attack-impact-solid` — a small solid pink dot at the center:

```typescript
// Inner dot (solid, bright)
map.addLayer({
  id: 'attack-impact-solid',
  type: 'circle',
  source: 'attack-impact-source',
  paint: {
    'circle-radius': 5,
    'circle-color': '#f472b6',
    'circle-opacity': 0.9,
  },
});

// Inner ring
map.addLayer({
  id: 'attack-impact',
  type: 'circle',
  source: 'attack-impact-source',
  paint: {
    'circle-radius': ['+', 10, ['/', ['get', 'count'], 2]],
    'circle-color': 'transparent',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#f472b6',
    'circle-opacity': 0.85,
  },
});

// Outer ring (larger, more transparent)
map.addLayer({
  id: 'attack-impact-outer',
  type: 'circle',
  source: 'attack-impact-source',
  paint: {
    'circle-radius': ['+', 20, ['/', ['get', 'count'], 1]],
    'circle-color': 'transparent',
    'circle-stroke-width': 1,
    'circle-stroke-color': '#f472b6',
    'circle-stroke-opacity': 0.35,
  },
});
```

### 4. Faster mock attack generation for denser bundling

The current mock generates 1 attack every 0.7–2s. To get the stacked bundle effect from the reference (many arcs from same source visible simultaneously), increase frequency and bias toward a smaller set of sources:

```typescript
// In useLiveAttacks.ts — speed up the generator
const delay = 300 + Math.random() * 700;  // was 700-2000ms → now 300-1000ms

// Bias: 60% of attacks come from top 6 sources (China, Russia, Iran, USA, North Korea, Ukraine)
// This ensures multiple arcs stack from the same country
const WEIGHTED_SOURCES = [
  ...Array(4).fill({ country: 'China', lat: 35.86, lng: 104.19 }),
  ...Array(4).fill({ country: 'Russia', lat: 61.52, lng: 105.31 }),
  ...Array(3).fill({ country: 'Iran', lat: 32.43, lng: 53.68 }),
  ...Array(3).fill({ country: 'USA', lat: 39.38, lng: -100.44 }),
  ...Array(2).fill({ country: 'North Korea', lat: 40.33, lng: 127.51 }),
  ...Array(2).fill({ country: 'Ukraine', lat: 48.37, lng: 31.17 }),
  ...THREAT_SOURCES,  // all others with weight 1
];
```

### 5. Pulsing ring animation using a separate GeoJSON source

The ring effect requires updating radius per-frame. Since Mapbox GL doesn't support CSS animations on map layers, we drive the radius through the RAF loop:

Add new source + layer in `map.on('load')`:
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

In the RAF tick, build `attack-ring-source` GeoJSON where each active source country emits 2 rings with staggered start times (offset by 1 second), so as one ring fades/expands, the next begins:

```typescript
function buildRingsGeoJSON(states: Map<string, ArcState>, now: number): GeoJSON.FeatureCollection {
  const seenCountries = new Map<string, { lng: number; lat: number; color: string; firstSeen: number }>();
  
  for (const state of states.values()) {
    if (state.opacity <= 0) continue;
    const c = state.threat.source.country;
    if (!seenCountries.has(c)) {
      seenCountries.set(c, {
        lng: state.threat.source.lng,
        lat: state.threat.source.lat,
        color: ATTACK_COLORS[state.threat.attack_type],
        firstSeen: state.startTime,
      });
    }
  }
  
  const features: GeoJSON.Feature[] = [];
  const RING_PERIOD = 2000; // ms per ring cycle
  
  for (const [country, info] of seenCountries) {
    // Two staggered rings
    for (const offset of [0, RING_PERIOD / 2]) {
      const t = ((now - info.firstSeen + offset) % RING_PERIOD) / RING_PERIOD;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [info.lng, info.lat] },
        properties: {
          radius: 4 + t * 22,           // expands 4→26px
          ringOpacity: (1 - t) * 0.8,   // fades 0.8→0
          color: info.color,
        },
      });
    }
  }
  
  return { type: 'FeatureCollection', features };
}
```

## Files to Change

| File | Change |
|---|---|
| `src/pages/CyberMap.tsx` | Increase `VISIBLE_DURATION` to 15s; reduce arc opacity to 0.65 for stacking; add `attack-ring-source` + `attack-ring` layer; add `attack-impact-solid` + `attack-impact-outer` layers; add `buildRingsGeoJSON()`; update RAF tick to also call ring source update; add `attack-impact-solid` and `attack-impact-outer` to layer visibility toggle |
| `src/hooks/useLiveAttacks.ts` | Speed up mock interval to 300–1000ms; add `WEIGHTED_SOURCES` array biased toward top threat actors to create the stacked bundle effect |

## Visual Result

After these changes, `/cyber-map` will show:
- **Bundles of 5-15 arcs** stacking from major sources (China, Russia, USA, etc.) into Somalia — identical to the reference image
- **Pulsing concentric rings** at each active source country that expand outward and fade (radar ping effect)
- **Bright bullseye** at Somalia with inner + outer rings
- The map remains completely static — only the animated elements move
