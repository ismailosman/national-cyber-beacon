
# Three Changes: Live Attack Feed Sidebar, Traveling Projectile Dot, Landing Page Redesign + Routing

## Summary of All Changes

### 1. `/threat-map` — Live Attack Feed Sidebar
Replace the current "Alert Hotspots" sidebar with a **live scrolling attack feed** matching the Check Point reference layout. Each row shows:
- Colored circle dot (attack type color)
- Timestamp (HH:MM:SS)
- Source country → 🇸🇴 Somalia
- Attack type label + severity badge

The feed auto-scrolls as new attacks come in, keeping the most recent 40 entries, with a smooth fade-in animation on each new row.

### 2. `/threat-map` — Traveling Projectile Dot
Add a **moving dot** (small glowing circle) that travels along the arc path at the tip of each arc as it draws. When it reaches Somalia (progress ≥ 0.98), it triggers a brief flash/explosion effect at the target.

**How it works:**
- New Mapbox source: `attack-projectile-source` — GeoJSON `Point` features at the current "tip" position of each active arc
- New layer: `attack-projectile` — `circle` layer, 4px radius, colored by attack type, with a 2px bright white stroke
- New layer: `attack-projectile-glow` — larger 10px transparent stroke-only ring behind it for a glow effect
- In the RAF tick: compute the current tip coordinate from `arcCoords[sliceEnd - 1]` for arcs with `progress < 1`
- A separate flash source/layer (`attack-flash-source`, `attack-flash`) renders a bright expanding ring at Somalia targets for 0.5s after impact, driven by `impactFlashRef` tracking `{ id, startTime }` entries

### 3. Landing Page Redesign + Route to `/` (root)

**Route change in `App.tsx`:** Move the Landing page to the root `/` path (currently protected). The ProtectedRoutes wrapper currently catches `/*` — the root `/` will now resolve to `Landing` before hitting `ProtectedRoutes`. Update:

```typescript
// Current:
<Route path="/public" element={<Landing />} />

// New:
<Route path="/" element={<Landing />} />
// And ProtectedRoutes only handles /dashboard, /organizations, etc.
// or keep /* but ensure / resolves to Landing before auth check
```

The cleanest approach: add `<Route path="/" element={<Landing />} />` as a public route alongside `/login` and `/cyber-map`, and change ProtectedRoutes' internal default from `path="/"` to `path="/dashboard"`.

**Landing Page Redesign** — Transform from a plain info page into a dramatic full-screen hero landing page:

**Layout (top to bottom):**
```
┌─────────────────────────────────────────────────────┐
│  NAV: Logo | Live Attack Map btn | Sign In btn      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  HERO SECTION (full viewport height)                │
│  Dark background with subtle grid pattern           │
│                                                     │
│  ● LIVE  Somalia National Cyber Observatory         │
│  "National Cyber Defense                            │
│   Command Center"                                   │
│  Subtitle text                                      │
│                                                     │
│  [Live Attack Map ⚡]  [Sign In →]  buttons        │
│                                                     │
│  ━━━ 4 animated stat counters (border cards) ━━━   │
│  [Orgs Monitored] [Open Alerts] [Regions] [Attacks] │
│                                                     │
├─────────────────────────────────────────────────────┤
│  MAP SECTION — large, full-width dark map           │
│  Somalia highlighted in LIGHT BLUE (#38bdf8)        │
│  Region dots with severity colors                   │
│  Live severity breakdown cards below map            │
├─────────────────────────────────────────────────────┤
│  CTA SECTION — dark gradient                        │
│  "Secure access for authorized personnel"           │
│  [Sign In to Full Platform] button                  │
├─────────────────────────────────────────────────────┤
│  FOOTER                                             │
└─────────────────────────────────────────────────────┘
```

**Somalia light blue on the map:** Use Mapbox's `setPaintProperty` on the `country-fills` layer to highlight Somalia (`name_en = 'Somalia'`) in `#38bdf8` (sky blue). This requires using a `fill` layer filter on the map style:

```typescript
// After map load:
map.addLayer({
  id: 'somalia-highlight',
  type: 'fill',
  source: { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' },
  'source-layer': 'country_boundaries',
  filter: ['==', ['get', 'name_en'], 'Somalia'],
  paint: {
    'fill-color': '#38bdf8',
    'fill-opacity': 0.35,
  },
});

map.addLayer({
  id: 'somalia-outline',
  type: 'line',
  source: { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' },
  'source-layer': 'country_boundaries',
  filter: ['==', ['get', 'name_en'], 'Somalia'],
  paint: {
    'line-color': '#38bdf8',
    'line-width': 1.5,
    'line-opacity': 0.8,
  },
});
```

This same Somalia highlight is also applied to the **ThreatMap** to fulfill the "light blue" request there too.

## Technical File Changes

| File | What Changes |
|---|---|
| `src/App.tsx` | Add `<Route path="/" element={<Landing />} />` as public route; change ProtectedRoutes default from `/` to `/dashboard` |
| `src/pages/Landing.tsx` | Full redesign: hero section, animated counters, improved map with Somalia highlight, better CTA |
| `src/pages/ThreatMap.tsx` | Replace sidebar with live attack feed; add projectile dot + flash layers and logic; add Somalia blue highlight |

## Detailed: Live Attack Feed (ThreatMap Sidebar)

The current sidebar has two sections: "Alert Hotspots" and "Severity Breakdown". The new layout:

**Top section (scrolling feed):**
- Header: `⚡ Live Attack Feed` with `• LIVE` badge pulsing green
- Each row (auto-added when new threat arrives):
  ```
  ● [HH:MM:SS]  China → 🇸🇴 Somalia
    [malware]  [CRITICAL]
  ```
- Rows fade in from the top using CSS animation
- Max 40 rows kept, oldest removed automatically
- Row color-coded by attack type on the left border

**Bottom section (kept from current):**
- Severity breakdown with progress bars (unchanged)

## Detailed: Traveling Projectile Dot

**New sources and layers added in `map.on('load')` in ThreatMap:**

```typescript
// Projectile (moving dot at arc tip)
map.addSource('attack-projectile-source', { type: 'geojson', data: emptyFC });

map.addLayer({
  id: 'attack-projectile-glow',
  type: 'circle',
  source: 'attack-projectile-source',
  paint: {
    'circle-radius': 10,
    'circle-color': 'transparent',
    'circle-stroke-width': 3,
    'circle-stroke-color': ['get', 'color'],
    'circle-stroke-opacity': 0.4,
  },
});

map.addLayer({
  id: 'attack-projectile',
  type: 'circle',
  source: 'attack-projectile-source',
  paint: {
    'circle-radius': 4,
    'circle-color': ['get', 'color'],
    'circle-opacity': 1,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': 0.9,
  },
});

// Impact flash (explodes on arrival)
map.addSource('attack-flash-source', { type: 'geojson', data: emptyFC });

map.addLayer({
  id: 'attack-flash',
  type: 'circle',
  source: 'attack-flash-source',
  paint: {
    'circle-radius': ['get', 'radius'],
    'circle-color': 'transparent',
    'circle-stroke-width': 2,
    'circle-stroke-color': '#f472b6',
    'circle-stroke-opacity': ['get', 'flashOpacity'],
  },
});
```

**New `buildProjectileGeoJSON` function:**
```typescript
function buildProjectileGeoJSON(states: Map<string, ArcState>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const state of states.values()) {
    if (state.progress >= 1 || state.progress <= 0) continue; // only while traveling
    const sliceEnd = Math.max(2, Math.ceil(state.progress * state.arcCoords.length));
    const tip = state.arcCoords[sliceEnd - 1];
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: tip },
      properties: { color: ATTACK_COLORS[state.threat.attack_type] },
    });
  }
  return { type: 'FeatureCollection', features };
}
```

**Flash tracking ref:**
```typescript
const flashStatesRef = useRef<Map<string, { lng: number; lat: number; startTime: number }>>(new Map());
```

In the RAF tick: when an arc's progress transitions from `< 1` to `>= 1`, add an entry to `flashStatesRef`. In `buildFlashGeoJSON`, compute `t = (now - startTime) / 500` (500ms flash), radius `5 + t * 30`, opacity `(1 - t) * 0.9`. Remove entries where `t >= 1`.

The `updateMapSources` callback is extended to also call `buildProjectileGeoJSON` and `buildFlashGeoJSON`.

## Detailed: Landing Page

**Hero section visual design:**
- Full-screen dark background (`bg-[#030711]`) with subtle dot-grid CSS pattern
- Animated scan-line effect (moving gradient) using CSS keyframe
- Center-aligned hero text with large bold heading
- Cyan/pink accent colors matching the platform's SOC aesthetic

**CSS dot grid pattern (applied via inline style):**
```css
backgroundImage: 'radial-gradient(circle, rgba(0,229,255,0.15) 1px, transparent 1px)',
backgroundSize: '28px 28px'
```

**Animated stat counters:** Use `useEffect` + `setInterval` to count up from 0 to final value over 1.5s when the section scrolls into view (or on mount). The four counters: organizations, open alerts, active regions, attacks today (from `useLiveAttacks`).

**Map section:** Same Mapbox map as current Landing, but with the Somalia fill layer added (light blue `#38bdf8` at 35% opacity) and the border is brighter blue. The map height increases to `480px` and gets a more dramatic dark overlay gradient at edges.
