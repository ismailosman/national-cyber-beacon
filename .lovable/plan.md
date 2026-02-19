
# Three Focused Changes

## 1. Persistent Full Arc Lines — "Lines That End in Somalia"

### What the User Wants
Looking at the reference image (Brazil → target), the user wants: **the full arc line drawn completely from source to Somalia**, with the glowing dot sitting at the target end. Currently, arcs are progressively drawn during travel, then fade. The user wants a **persistent backbone line** that is always visible — once an arc is established, the full line from that source to Somalia is shown, with the animated projectile running over the top of it.

### Implementation
Add a new GeoJSON source `attack-full-arcs-source` that renders **complete arcs** (all 50 coords, no slicing) for every active threat. This creates the "full line from source to Somalia" backbone. Reduce this layer's opacity significantly (e.g., 0.25) so it appears as a dim "track" behind the bright progressive arc. Apply this to **both** `CyberMap.tsx` and `ThreatMap.tsx`.

```
Layer order (bottom to top):
1. attack-full-arcs    (full line, dim, 0.25 opacity) ← NEW
2. attack-arcs-glow    (fat blur glow, progressive)
3. attack-arcs         (bright progressive line)
4. attack-projectile-glow (glow ring at tip)
5. attack-projectile   (bright dot at tip)
6. attack-ring         (pulsing rings at source)
7. attack-impact-*     (Somalia bullseye)
```

The `buildFullArcsGeoJSON` function:
```typescript
function buildFullArcsGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const seen = new Set<string>(); // deduplicate per source country for cleaner look
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.opacity <= 0) continue;
    // Draw full arc for each unique source country (most recent one)
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: state.arcCoords }, // ALL coords
      properties: {
        color: ATTACK_COLORS[state.threat.attack_type],
        opacity: state.opacity,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
```

Mapbox layer:
```typescript
map.addLayer({
  id: 'attack-full-arcs',
  type: 'line',
  source: 'attack-full-arcs-source',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 1,
    'line-opacity': ['*', ['get', 'opacity'], 0.3],
    'line-dasharray': [3, 2],   // subtle dashed ghost trail
  },
});
```

### Files Changed
- `src/pages/CyberMap.tsx` — Add `attack-full-arcs-source` + `attack-full-arcs` layer; add `buildFullArcsGeoJSON`; call it in `updateMapSources`
- `src/pages/ThreatMap.tsx` — Same additions

---

## 2. Replace Landing Page Map Section with /cyber-map

### What the User Wants
Replace the current static Mapbox map section in the landing page (which shows region markers on a static Somalia-centered map) with the full live `/cyber-map` experience — animated arcs, projectiles, pulsing rings, Somalia bullseye, and the attack counter.

### Implementation: Iframe Embed

The cleanest approach is to embed `/cyber-map` as an `<iframe>` in the landing page. The CyberMap is a fully self-contained page that handles its own token fetching, Mapbox init, and RAF animation loop.

Replace the entire "Map Section" in `Landing.tsx` (the `<section>` containing the Mapbox map container, severity cards, and markers) with:

```tsx
{/* ── Live Attack Map Section ───────────────────────────────── */}
<section className="px-6 pb-12 max-w-7xl mx-auto w-full">
  <div className="mb-4 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        Live Cyber Attack Map · Somalia National CERT
      </span>
    </div>
    <Link to="/cyber-map" className="text-xs text-primary hover:underline flex items-center gap-1">
      <Zap className="w-3 h-3" /> Open Full Screen
    </Link>
  </div>

  <div
    className="glass-card rounded-2xl border border-border overflow-hidden relative"
    style={{ height: '560px' }}
  >
    <iframe
      src="/cyber-map"
      title="Live Cyber Attack Map"
      className="w-full h-full border-0"
      loading="lazy"
    />
  </div>
</section>
```

**Benefits:**
- The full animated CyberMap experience (arcs, projectiles, pulsing rings, Somalia bullseye, attack counter, dark background) is embedded directly
- No duplicate code — the CyberMap component handles all its own logic
- Interactive elements in CyberMap still work within the iframe (the Somalia panel click, the Live toggle)
- The iframe is sandboxed by the browser and avoids React state conflicts

**Remove from Landing.tsx:**
- The `mapToken`, `mapError`, `mapLoaded` state variables related to the static map
- The `mapContainer` ref, `mapRef`, `markersRef`, `mapboxglRef` refs
- The `useEffect` for fetching map token (keep `get-map-token` removal, keep only `public-stats` for stats)
- The `useEffect` for Mapbox init
- The `useEffect` for placing region markers
- The `REGION_COORDS` constant
- The severity stat cards above the map (the iframe already has the attack counter built in)

**Keep in Landing.tsx:**
- The `public-stats` fetch for the hero stat counters (orgs, alerts, regions)
- The `useCountUp` hook
- The `SEVERITY_COLORS` constant (used by `SEVERITY_ORDER` cards? — remove if no longer needed)
- All nav, hero, CTA, footer sections

### Clean Up Imports
Remove `Loader2` if no longer used for the map spinner. Keep `Zap`, `Shield`, `Globe`, `Lock`, `ChevronRight`, `AlertTriangle`, `RefreshCw`.

---

## 3. Severity Stat Cards Redesign (Optional Enhancement)
Since the severity breakdown above the map is removed (it was tied to the static map section), replace it with a simpler 2-row stat bar above the iframe showing `totalAlerts`, `totalOrgs`, and `regionsCount` — which are already computed from `public-stats`.

---

## Files Changed

| File | Changes |
|---|---|
| `src/pages/CyberMap.tsx` | Add `attack-full-arcs-source` + `attack-full-arcs` layer; `buildFullArcsGeoJSON`; update `updateMapSources`; update layer visibility toggle |
| `src/pages/ThreatMap.tsx` | Same: `attack-full-arcs-source` + layer + `buildFullArcsGeoJSON`; update `updateMapSources` |
| `src/pages/Landing.tsx` | Replace static Mapbox map section with `<iframe src="/cyber-map">` at 560px height; remove unused map state/refs/effects; remove severity stat cards; clean up imports |

## Visual Result After Changes

**On `/cyber-map` and `/threat-map`:**
- Every active attack shows a **dim dashed full-length arc** (the "rail") from source country to Somalia as soon as it starts
- The bright progressive arc draws over the top of the rail
- The glowing projectile dot travels along the full route
- Result: visually matches the reference image where a complete line is visible with a glowing dot at the end

**On Landing Page (`/`):**
- The map section now shows the full `/cyber-map` page in an iframe
- Users see the live animated attack arcs, pulsing rings, projectile dots, Somalia bullseye, and the "ATTACKS ON THIS DAY" counter
- A "Open Full Screen" link routes to `/cyber-map` for immersive view
- The hero section stat counters (orgs, alerts, regions) remain from `public-stats`
