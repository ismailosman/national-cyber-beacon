
# Animation Upgrade: Speed + Impact Flash + Persistent Solid Line

## What's Changing (3 features)

### 1. Travel Speed: 2.0 → 1.2 seconds

One-line change at the top of the file:
```typescript
// Before
const TRAVEL_DURATION = 2.0;
// After
const TRAVEL_DURATION = 1.2;
```

This makes every projectile travel 40% faster — much more urgent and dramatic.

---

### 2. Impact Flash/Explosion at Somalia

**The problem:** When a projectile arrives at Somalia (`progress` hits `1`), there's no "hit" visual — it just stops. The user wants an expanding ring burst, color-matched to the attack type.

**The solution:** A dedicated impact flash system, separate from the existing static bullseye rings.

#### New state structure: `FlashState`

When a projectile's `progress` transitions from `< 1` to `>= 1`, we record a new flash event:

```typescript
interface FlashState {
  id: string;                     // same as threat id
  color: string;                  // attack type color
  coords: [number, number];       // target location
  startTime: number;              // when impact occurred (ms)
}
```

This is stored in a new `flashStatesRef: Map<string, FlashState>` ref.

#### Detection in the RAF tick

In the RAF loop, when we detect `state.progress` newly hitting `1`, we push a new FlashState. Flash events expire after **1.5 seconds**.

#### `buildFlashGeoJSON` — two animated rings

```typescript
const FLASH_DURATION = 1.2; // seconds

function buildFlashGeoJSON(flashes: Map<string, FlashState>, now: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const [id, flash] of flashes) {
    const t = (now - flash.startTime) / (FLASH_DURATION * 1000); // 0 → 1
    if (t > 1) { flashes.delete(id); continue; }
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic for expansion
    // Inner ring: expands 0→30px, fades 1→0
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: flash.coords },
      properties: { color: flash.color, radius: eased * 30, opacity: (1 - t) * 0.9, strokeW: 2.5 } });
    // Outer ring: expands 0→55px with delay, fades faster
    const t2 = Math.max(0, t - 0.15);
    const eased2 = 1 - Math.pow(1 - t2, 3);
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: flash.coords },
      properties: { color: flash.color, radius: eased2 * 55, opacity: Math.max(0, 1 - t2) * 0.5, strokeW: 1.5 } });
  }
  return { type: 'FeatureCollection', features };
}
```

#### New Mapbox layer

```typescript
map.addSource('attack-flash-source', { type: 'geojson', data: emptyFC });
map.addLayer({
  id: 'attack-flash',
  type: 'circle',
  source: 'attack-flash-source',
  paint: {
    'circle-radius': ['get', 'radius'],
    'circle-color': 'transparent',
    'circle-stroke-width': ['get', 'strokeW'],
    'circle-stroke-color': ['get', 'color'],
    'circle-stroke-opacity': ['get', 'opacity'],
  },
});
```

---

### 3. Solid Persistent Arc Line (Reference Image Effect)

Looking at the reference image: it shows solid, colored lines from source countries (USA, Netherlands) converging at a target point — these lines persist and remain visible (not just a short traveling tail). This is the **full arc as a solid line** that persists after the projectile hits and while it's in flight.

**What currently exists:**
- `attack-full-arcs-source` renders dashed/dim lines for the full path (the "rail"). However it renders for ALL arcs including ones still traveling.
- The traveling beam only shows a `TAIL_FRACTION` short segment while in motion.

**What the user wants:** A solid, clearly visible line from source → Somalia **at all times** (during travel AND after hit), styled like the reference (solid colored lines, not dashed).

**Solution:** Change the `attack-full-arcs` layer paint to be a **solid colored line** with opacity driven by the arc's progress level:

- During travel (`progress < 1`): show at reduced opacity (0.3) — a dim guide rail
- After arrival (`progress >= 1`): show at full opacity (0.7) — the full solid hit trace fades over `FADE_DURATION`

**In `buildFullArcsGeoJSON`:** Add a `phase` property:

```typescript
properties: {
  color:   ATTACK_COLORS[state.threat.attack_type],
  opacity: state.progress >= 1 ? state.opacity * 0.7 : state.opacity * 0.3,
}
```

**Layer paint change** — replace the current dashed style with solid:

```typescript
map.addLayer({
  id: 'attack-full-arcs',
  type: 'line',
  source: 'attack-full-arcs-source',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 1.2,
    'line-opacity': ['get', 'opacity'],
    // No line-dasharray → solid line
  },
});
```

Currently the `attack-full-arcs` layer doesn't appear to be explicitly added in the code — only the source is added. The full arc rendering uses `buildFullArcsGeoJSON` which is called in `updateMapSources`, but the Mapbox layer definition for it is either missing or defined elsewhere. Let me check...

Looking at lines 608-760, the sources added are: `attack-arcs-source`, `attack-full-arcs-source`, `attack-sources-source`, `attack-impact-source`, `attack-projectiles-source`. But the **layer** for `attack-full-arcs-source` is never added with `map.addLayer()`! Only `attack-arcs` is layered. This means the full arc lines are never actually visible — they're computed but never rendered. This is likely why the lines look invisible currently.

**Fix:** Add a proper `attack-full-arcs` layer after the source is registered:

```typescript
map.addLayer({
  id: 'attack-full-arcs',
  type: 'line',
  source: 'attack-full-arcs-source',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 1.2,
    'line-opacity': ['get', 'opacity'],
  },
});
```

This must be inserted **before** the glow and arc layers so it renders underneath the traveling beam.

---

## File Changes

| File | What |
|---|---|
| `src/pages/CyberMap.tsx` | 5 targeted changes |

### Specific changes in `CyberMap.tsx`:

1. **Line 55**: `TRAVEL_DURATION = 1.2` (was 2.0)

2. **Lines 55–59** (constants block): Add `FLASH_DURATION = 1.2`

3. **After `buildRingsGeoJSON` (~line 537)**: Add new `FlashState` interface + `buildFlashGeoJSON` function

4. **In the `ArcState` interface (~line 387)**: Add `impacted?: boolean` flag so we can detect the moment of first arrival for flash triggering

5. **In `map.on('load')` (~line 603)**: 
   - Add `attack-flash-source` + `attack-flash` layer
   - Add the **missing `attack-full-arcs` layer** (solid line, before `attack-arcs-glow`)

6. **In `updateMapSources` (~line 801)**: Add flash source update

7. **In the RAF tick (~line 864)**: Detect new impacts and push to `flashStatesRef`; update flash source every frame

8. **In the layer visibility toggle (~line 823)**: Add `attack-full-arcs` and `attack-flash` to the list

---

## Visual Result

- Projectiles fly from source → Somalia in **1.2 seconds** (was 2.0) — snappy, urgent
- A **solid colored line** from source country to Somalia is visible the whole time (dim while traveling, brighter after hit)
- When projectile hits Somalia → **2 concentric rings burst outward** in the attack's color, fading and expanding over 1.2 seconds
- Multiple simultaneous impacts create overlapping flash rings at different timestamps
