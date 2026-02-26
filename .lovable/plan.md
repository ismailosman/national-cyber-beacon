

## New Standalone Threat Map Page Using the Mapbox Engine

### Overview
Create a new page that combines the **three-column layout** from your provided design (left sidebar with chart/feed, center map, right sidebar with stats) with the **real Mapbox-powered map and Canvas arc engine** already running on `/cyber-map`.

### Approach: Refactor and Reuse

Rather than duplicating 1,800+ lines, the plan extracts the Mapbox map + animation engine into a reusable component, then builds the new page layout around it.

### Files to Create/Modify

**1. `src/components/cyber-map/ThreatMapEngine.tsx` (new)**
- Extract the Mapbox initialization, Canvas overlay, arc animation loop, and GeoJSON builders from `src/pages/CyberMap.tsx` into a self-contained component
- Props: `threats`, `todayCount`, `liveOn`, `onCountryClick`, `onSomaliaClick`
- Renders the map container + canvas overlay + loading/error states
- This component handles all Mapbox token fetching, map setup, country highlights, arc rendering, and the Canvas draw loop

**2. `src/components/cyber-map/shared.ts` (new)**
- Move shared constants out: `COUNTRY_ISO`, `ATTACK_COLORS`, `ATTACK_LABELS`, `AttackType` re-exports, Bezier math, GeoJSON builders, panel data generators (`genCountryDefaultPercentages`, `genCountry30DayData`, sparkline generators)

**3. `src/pages/ThreatMapStandalone.tsx` (new)**
- The new standalone page with the three-column layout from your design:
  - **Left panel**: Daily attacks bar chart, attack rate counter, scrolling live feed
  - **Center**: The `ThreatMapEngine` component (full Mapbox + Canvas arcs)
  - **Right panel**: Top targeted countries (with flags from CDN), top targeted industries, top malware types, live statistics (active threats, attack rate, total today)
- Uses `useLiveAttacks` hook for threat data
- Header bar with logo, "LIVE CYBER THREAT MAP" title, attack counter, and pause/resume button
- Country/Somalia detail panels overlay on the map (reuse existing `SomaliaPanel` and `CountryPanel`)

**4. `src/pages/CyberMap.tsx` (modify)**
- Import and use `ThreatMapEngine` from the new shared component instead of inline Mapbox code
- Keeps existing sidebar feed, header, and mobile drawer -- only the map engine code moves out

**5. `src/App.tsx` (modify)**
- Add route for the new page (e.g., `/threat-map`) as a public page wrapped in `TurnstileGate`

### Layout Structure (New Page)

```text
+----------------------------------------------------------+
|  Logo  |  LIVE CYBER THREAT MAP  |  Counter  | Pause Btn |
+--------+-------------------------+-----------+-----------+
| LEFT   |        CENTER           |         RIGHT         |
| 220px  |     (flex-1)            |         240px         |
|        |                         |                       |
| Daily  |   Mapbox Map with       | Top Targeted          |
| Chart  |   Canvas Arc Overlay    | Countries (flags)     |
|        |   + Country Panels      |                       |
| Rate   |                         | Top Targeted          |
| Counter|                         | Industries            |
|        |                         |                       |
| Live   |                         | Top Malware           |
| Feed   |                         | Types                 |
| (scroll)|                        |                       |
|        |                         | Live Statistics       |
+--------+-------------------------+-----------------------+
```

### Key Details
- The Mapbox map uses the same dark style, Somalia highlight, continent fills, country hover tooltips, and Canvas-based Bezier arc animations as the existing `/cyber-map`
- Stats panels (top countries, industries, malware) are computed from the `useLiveAttacks` threat stream with seeded defaults for initial display
- The page is responsive: on mobile, left and right panels collapse into a bottom drawer or are hidden, with a "Feed" toggle button
- The bar chart uses simple styled divs (no extra chart library needed for the daily bars)
- Country flags use `flagcdn.com` with the existing `COUNTRY_ISO` lookup

