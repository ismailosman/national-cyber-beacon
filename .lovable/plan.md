

## Improve Cyber Map Visibility and Highlight Somalia

### Problem
The map is too dark and hard to see. Somalia has no visual distinction on the map, making it blend into the dark background.

### Changes

#### File: `src/pages/CyberMap.tsx`

**1. Add a light blue Somalia fill layer on the Mapbox map**

After the map loads (inside the `map.on('load', ...)` callback, around line 954), add a new fill layer that highlights Somalia using Mapbox's built-in `country-boundaries` source:

- Add a fill layer filtering for Somalia's ISO code (`SO`) from the `admin-0-country-boundaries` tileset
- Color: light blue (`rgba(56, 189, 248, 0.2)`) with a brighter border (`rgba(56, 189, 248, 0.6)`)
- This gives Somalia a distinct glow on the map

**2. Improve overall map visibility**

- Add country boundary outlines using Mapbox's built-in boundaries source so all countries are distinguishable (thin white/gray lines)
- Brighten the mobile dot-grid background opacity from `0.12` to `0.18` (line 1343)

**3. Brighten the header gradient on desktop**

- The desktop header gradient is very opaque (`rgba(0,0,0,0.85)`), which darkens the top portion. Reduce to `rgba(0,0,0,0.6)` for better map visibility behind the header.

### Technical Detail

All changes are in `src/pages/CyberMap.tsx`:

| What | Where | Change |
|---|---|---|
| Somalia fill layer | Inside `map.on('load')` callback (~line 961) | Add vector source + fill + line layers for Somalia |
| Country boundaries | Same location | Add thin boundary lines for all countries |
| Mobile dot-grid | Line 1343 | Opacity `0.12` to `0.18` |
| Desktop header gradient | Line 1349 | `rgba(0,0,0,0.85)` to `rgba(0,0,0,0.6)` |

