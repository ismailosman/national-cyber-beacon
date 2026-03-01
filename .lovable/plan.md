

## Fix Threat Map Zoom and Mobile Data Parity

### Problem 1: Cannot zoom in/out on the map
The Mapbox map has `scrollZoom: false`, `boxZoom: false`, and `doubleClickZoom: false` on desktop. On mobile, `touchZoomRotate` is enabled but `dragPan` is the only desktop interaction. Users have no way to zoom on desktop at all.

**Fix in `src/components/cyber-map/ThreatMapEngine.tsx`:**
- Enable `scrollZoom: true` on all devices
- Enable `doubleClickZoom: true` on all devices
- Enable `dragPan: true` on all devices (currently only mobile)
- Keep `boxZoom: false` and `dragRotate: false` as they aren't needed
- Enable `touchZoomRotate: true` on all devices (for trackpad pinch on desktop too)
- Add zoom +/- buttons to the map via Mapbox's `NavigationControl` (compact style, no compass)

### Problem 2: Mobile users cannot see the same data as PC users
The left sidebar (`hidden lg:flex`) and right sidebar (`hidden lg:flex`) are completely hidden on mobile. The only mobile content is a tiny collapsible bottom bar showing 5 countries and 3 events. Mobile users miss:
- Attack type breakdown
- Data sources status
- KSN subsystem stats
- Top targeted countries
- Top attack types
- Recent events with details
- Indicator lookup
- Live statistics

**Fix in `src/pages/ThreatMapStandalone.tsx`:**
- Replace the minimal mobile bottom panel with a full-height slide-up drawer (similar to CyberMap.tsx pattern)
- The drawer will have tabs/sections covering all the data from both sidebars:
  - **Stats**: Attack counter, arcs/min, attack types chart
  - **Countries**: Top attackers and targets with flags and bars
  - **Feed**: Live feed with KSN/TIP prefixes
  - **KSN**: Kaspersky subsystems, data sources, indicator lookup
- A floating button at the bottom-right opens the drawer (like the existing CyberMap feed button)
- The drawer uses 60vh height with a glassmorphic background so the map stays partially visible
- The KSN Data tab content should also be scrollable and responsive on mobile (already works since it uses grid with `grid-cols-1 md:grid-cols-2`)

### Technical Details

**ThreatMapEngine.tsx changes (lines 240-257):**
```typescript
scrollZoom: true,
boxZoom: false,
dragPan: true,
dragRotate: false,
doubleClickZoom: true,
touchZoomRotate: true,
touchPitch: false,
```
Add after map creation:
```typescript
map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
```

**ThreatMapStandalone.tsx changes:**
- Add `mobileDrawerOpen` state and `mobileDrawerTab` state
- Replace the minimal bottom bar (lines 620-654) with:
  1. A floating "Data" button (bottom-right, only on mobile)
  2. A slide-up drawer with horizontal tab buttons at the top (Stats / Countries / Feed / Sources)
  3. Each tab renders the same data as the desktop sidebars, adapted for mobile touch
- Keep the existing mobile bottom stats toggle for quick glance (attack count), but add the full drawer for deep data access

