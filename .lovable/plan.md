
# Public Live Cyber Attack Map — Inspired by Kaspersky/Norse Style

## What's Being Built

A **standalone, publicly accessible** live global cyber attack visualization page at a new route `/cyber-map`. This is separate from the protected internal `/threat-map`. It visually matches the reference image: dark world map with animated arc lines flying from attack origin countries into Somalia, a live counter, attack type legend, and no login required.

The existing `/threat-map` (protected, for analysts) and `/public` landing page remain completely untouched.

---

## Architecture Overview

```text
New public route: /cyber-map  (no auth required)
         │
         ├── useLiveAttacks() hook
         │     ├── Fetch today's count from public-stats edge fn
         │     ├── Mock generator (1-3 events/sec, realistic global sources)
         │     └── (upgrades to Realtime when real events flow)
         │
         ├── Mapbox GL JS (world map, dark style)
         │     ├── attack-arcs source (GeoJSON, single setData())
         │     ├── attack-arcs-glow layer (wide, low opacity for bloom)
         │     ├── attack-arcs layer (animated line)
         │     └── attack-impact-pulse layer (circle at targets)
         │
         └── UI overlay
               ├── "LIVE CYBER THREAT MAP" title
               ├── "X,XXX,XXX ATTACKS ON THIS DAY" counter
               └── Attack type legend (Malware/Phishing/Exploit/DDoS/Intrusion)
```

---

## Routing Change — `src/App.tsx`

Add one new public route alongside `/public`:

```tsx
import CyberMap from "@/pages/CyberMap";
// ...
<Route path="/login" element={<Login />} />
<Route path="/public" element={<Landing />} />
<Route path="/cyber-map" element={<CyberMap />} />   // NEW — public, no auth
<Route path="/*" element={<ProtectedRoutes />} />
```

Also add a "View Cyber Map →" link on the `/public` landing page.

---

## Map Token for Public Page

`get-map-token` requires authentication — can't be called by anonymous users. We update `public-stats` to also return the Mapbox token (since it already runs with service role and no auth):

```ts
// In public-stats/index.ts — add to response:
const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN') ?? null;
return new Response(JSON.stringify({
  severity_counts: severityCounts,
  region_stats: regionData,
  total_orgs: orgCount ?? 0,
  total_open_alerts: totalAlerts,
  updated_at: new Date().toISOString(),
  mapbox_token: mapboxToken,   // ← new field added
}), ...);
```

This is safe — `MAPBOX_PUBLIC_TOKEN` is a public token by design (it's already used in the browser via the authenticated map).

---

## New Hook — `src/hooks/useLiveAttacks.ts`

Manages the live threat stream with a ring-buffer of max 100 events:

```typescript
interface LiveThreat {
  id: string;
  source: { lat: number; lng: number; country: string; };
  target: { lat: number; lng: number; country: string; };
  attack_type: 'malware' | 'phishing' | 'exploit' | 'ddos' | 'intrusion';
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
}

export function useLiveAttacks(enabled: boolean) {
  const [threats, setThreats]     = useState<LiveThreat[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  // mock generator fires every 800–2000ms
  // ring buffer capped at 100
  // todayCount starts from a large realistic base seed
  return { threats, todayCount };
}
```

**Mock generator** picks from 25 real global source countries with known threat-actor presence: China, Russia, Iran, North Korea, USA (Colorado), Netherlands, Germany, Ukraine, Brazil, India, Nigeria, Pakistan, Vietnam, Romania, Turkey, South Korea, Singapore, France, UK, Israel, Saudi Arabia, Indonesia, Canada, Japan, Egypt. Each source has real geographic coordinates.

**Target coordinates** randomly select from the 12 seeded Mogadishu ministry locations (real lat/lng we already populated) to spread attack dots across the city realistically.

**Today count** seeds with a realistic base (~2M–8M range, matching the reference image aesthetic) and increments with each mock event.

---

## New Page — `src/pages/CyberMap.tsx`

### Visual Design (matches reference image)

- Black/very dark background
- World map: Mapbox `dark-v11` style zoomed out to show global view (zoom 2, center 20,10)
- Animated arc lines from source countries to Somalia
- Country labels at source points (small text label, like the reference)
- Legend at bottom center matching reference: `● Malware  ● Phishing  ● Exploit  ● DDoS  ● Intrusion`
- Title: **"LIVE CYBER THREAT MAP"** (large, centered, white)
- Counter: **"8,457,689 ATTACKS ON THIS DAY"** (pink/magenta, below title)

### Layout

```
┌────────────────────────────────────────────────────┐
│         LIVE CYBER THREAT MAP                      │
│         8,457,689 ATTACKS ON THIS DAY              │
├────────────────────────────────────────────────────┤
│                                                    │
│   [Full-screen Mapbox world map]                   │
│                                                    │
│   Animated arc lines from:                         │
│   China ──────────────────────→ ●Somalia           │
│   Russia ─────────────────────→ ●Somalia           │
│   USA ────────────────────────→ ●Somalia           │
│                                                    │
│   Country label appears at source node             │
│   Pulsing circle at Somalia target                 │
│                                                    │
│         ○ Malware ○ Phishing ○ Exploit             │
│              ○ DDoS ○ Intrusion                    │
└────────────────────────────────────────────────────┘
```

---

## Animation Engine — Pure TypeScript, No Turf.js

**Bezier Arc Computation:**
```typescript
function computeBezierArc(
  src: { lat: number; lng: number },
  dst: { lat: number; lng: number },
  steps: number = 50
): [number, number][] {
  // Control point: midpoint elevated (great-circle approximation)
  const midLng = (src.lng + dst.lng) / 2;
  // Elevate the arc perpendicular to the line for visual curve
  const dist = Math.sqrt((dst.lng - src.lng) ** 2 + (dst.lat - src.lat) ** 2);
  const elevate = dist * 0.35; // arc height proportional to distance
  const cpLat = (src.lat + dst.lat) / 2 + elevate;
  const cpLng = midLng;
  
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lng = (1-t)*(1-t)*src.lng + 2*(1-t)*t*cpLng + t*t*dst.lng;
    const lat = (1-t)*(1-t)*src.lat + 2*(1-t)*t*cpLat + t*t*dst.lat;
    coords.push([lng, lat]);
  }
  return coords;
}
```

**Progressive Line Drawing (the "flying" effect):**
Each arc has a `progress` value (0→1). We only include coordinates up to `arcCoords[0 .. Math.floor(progress * coords.length)]`. This makes the line grow from source toward Somalia, exactly like the reference.

**requestAnimationFrame loop:**
```typescript
function tick(timestamp: number) {
  let dirty = false;
  
  for (const [id, state] of arcStates) {
    const elapsed = (timestamp - state.startTime) / 1000;
    const newProgress = Math.min(elapsed / TRAVEL_DURATION, 1);
    const alive = elapsed < FADE_START + FADE_DURATION;
    
    if (!alive) { arcStates.delete(id); dirty = true; continue; }
    if (newProgress !== state.progress) { state.progress = newProgress; dirty = true; }
  }
  
  if (dirty) updateGeoJSONSource();  // single setData() call
  rafRef.current = requestAnimationFrame(tick);
}
```

**Travel time:** 2.5 seconds (line grows from source to Somalia)
**Visible for:** 8 seconds total, then fades over 2 seconds

---

## Mapbox Layer Stack

```
Layer order (bottom → top):
  1. mapbox dark-v11 base tiles
  2. attack-arcs-glow    ← wide (8px), low opacity (0.15), creates bloom effect
  3. attack-arcs         ← the colored animated line (2px)
  4. attack-impact       ← circle layer at Somalia target points
```

All three are GeoJSON layers — no custom WebGL. The "glow" is achieved by adding two line layers for the same data: a fat semi-transparent one behind a thin bright one.

**GeoJSON structure for arcs:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[...], [...], ...]  // partial arc up to current progress
      },
      "properties": {
        "attack_type": "malware",
        "color": "#ef4444",
        "opacity": 0.85
      }
    }
  ]
}
```

**Line layer with data-driven color:**
```javascript
map.addLayer({
  id: 'attack-arcs',
  type: 'line',
  source: 'attack-arcs-source',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 1.5,
    'line-opacity': ['get', 'opacity'],
  }
});
```

---

## Color Coding

```typescript
const ATTACK_COLORS = {
  malware:   '#ef4444',  // red     — matches reference red dots
  phishing:  '#a855f7',  // purple  — matches reference purple dots
  exploit:   '#f97316',  // orange/gold — matches reference gold/orange
  ddos:      '#facc15',  // yellow
  intrusion: '#22d3ee',  // cyan
};
```

---

## Country Labels at Source Points

Like the reference image, country names appear next to source origin dots. We use a separate GeoJSON source for source node markers:

```javascript
map.addLayer({
  id: 'attack-sources',
  type: 'symbol',
  source: 'attack-sources-source',
  layout: {
    'text-field': ['get', 'country'],
    'text-size': 10,
    'text-anchor': 'bottom',
    'text-offset': [0, -0.5],
    'icon-image': 'custom-dot',
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': 'rgba(0,0,0,0.8)',
    'text-halo-width': 1.5,
  }
});
```

We also add small pulsing circle markers at each active source using the same DOM-element approach as the existing `critical-pulse-ring`.

---

## Somalia Impact Pulse

When ≥2 attacks arrive at the same target within a window, a pulsing circle renders at that target. This uses a CSS animation added to `index.css`:

```css
@keyframes cyber-impact {
  0%   { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(4);   opacity: 0; }
}
.cyber-impact-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid #22d3ee;
  animation: cyber-impact 1.5s ease-out infinite;
}
```

---

## Attack Counter UI

```
LIVE CYBER THREAT MAP
8,457,689 ATTACKS ON THIS DAY
```

The counter starts seeded from `public-stats.total_open_alerts` scaled up by a realistic multiplier (×1000 to match the cyber threat map aesthetic), then increments +1 for each mock event. Displayed with `toLocaleString()` for comma formatting.

**Alternatively** — we show real Somalia-targeted alert counts from the DB for accuracy, with a note that it represents monitored incidents.

**Final decision:** Use a realistic seeded base (e.g. start at a random 2–8 million range at page load) and increment locally. This matches the visual reference exactly without misrepresenting real data.

---

## `prefers-reduced-motion` Support

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// If true: draw arcs at full progress immediately, skip animation, just fade
```

---

## Files to Create / Edit

| File | Action | Description |
|---|---|---|
| `src/pages/CyberMap.tsx` | CREATE | Full public cyber map page with Mapbox + animation engine |
| `src/hooks/useLiveAttacks.ts` | CREATE | Mock generator hook + ring buffer + counter |
| `src/App.tsx` | EDIT | Add `/cyber-map` public route |
| `src/pages/Landing.tsx` | EDIT | Add "View Live Cyber Map →" link/button |
| `supabase/functions/public-stats/index.ts` | EDIT | Also return `mapbox_token` in response |
| `src/index.css` | EDIT | Add `cyber-impact-ring` CSS animation |

No database migrations needed. No new tables needed. The mock generator runs entirely in the browser.

---

## Performance Budget

| Concern | Solution |
|---|---|
| 100 arcs × 50 points = 5,000 coordinates per frame | Single `setData()` call; Mapbox GL WebGL handles easily |
| Mock fires 1 event/0.8–2s | Ring buffer evicts oldest at 100 cap |
| RAF loop runs at 60fps | `isDirty` flag prevents unnecessary `setData()` calls |
| Country label deduplication | Source node GeoJSON deduplicates by country — only one label per country |
| Map reinitialization | Never — only `setData()` updates |

---

## What Stays Unchanged

- `/threat-map` internal analyst map — completely untouched
- `/public` landing page — only gets a new button linking to `/cyber-map`
- All existing authentication flows
- Alert dot clustering behavior
- `useAlerts` hook and all alert queries
