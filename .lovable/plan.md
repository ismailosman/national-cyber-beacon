
# Mobile-Friendly Overhaul

## Problem Summary

The application has six distinct mobile problem areas, each needing a targeted fix:

1. **CyberMap (`/cyber-map`)** — Uses `w-screen h-screen` with a hard-coded `w-64 xl:w-72` sidebar that stacks alongside the map. On phones the map shrinks to ~60% width, the live feed sidebar eats remaining space, the bottom bar with severity cards overflows horizontally, and the absolute overlays (header title, nav buttons, toggle) all collide.

2. **Landing page (`/public`)** — The `iframe` of the cyber-map is shown at a fixed `height: 560px` and tries to render the full map+sidebar at phone width, creating a broken embedded view. The nav header hides the "Live Attack Map" link on small screens (`hidden sm:flex`). The CTA section has `p-10` which is very wide on phones.

3. **Dashboard (`/`)** — The alert sidebar (`hidden xl:flex`) only shows on extra-large screens which is fine, but the `grid grid-cols-4` severity breakdown cards are too small on phones. The trend chart is readable but `xl:grid-cols-4` means the National Score card and stats are stacked correctly — mostly OK but needs minor tweaks.

4. **ThreatMap (`/threat-map`)** — Uses `grid-cols-1 lg:grid-cols-[1fr_280px]` so the sidebar stacks below the map on mobile — this is actually decent. The map height is calculated `calc(100vh - 100px)` which works. Severity counters row wraps with `flex-wrap`. The country panel overlays may need size constraints.

5. **Alerts/Incidents/etc. pages** — Use `overflow-x-auto` tables which scroll horizontally on mobile — acceptable behaviour, but filter rows with many buttons need `flex-wrap`.

6. **AppLayout / Sidebar** — The sidebar already has a mobile hamburger menu (`lg:hidden` mobile header). This works, but the sidebar could use better touch targets.

## Fixes Per File

### 1. `src/pages/CyberMap.tsx` — Full mobile layout

**Current:** `flex flex-row` with fixed-width sidebar always visible  
**Fix:** On mobile (`< lg`), hide the sidebar and show a floating "Feed" toggle button instead. The feed opens as a bottom drawer/sheet. The bottom severity bar switches to a 2×2 grid on mobile.

- Wrapper: `w-screen h-screen bg-black flex flex-col overflow-hidden` (unchanged)
- Top row map container: add `<div className="relative flex-1 min-w-0">` (unchanged)
- Sidebar: add `hidden lg:flex` to make it desktop-only
- Add mobile feed toggle button (bottom-right floating, above severity bar) — appears on `lg:hidden`
- Add `feedOpen` state for mobile drawer
- Mobile feed drawer: `fixed inset-x-0 bottom-0 z-50 flex flex-col` with height `60vh`, slides up from bottom when `feedOpen === true`
- Bottom severity bar: change `flex items-center gap-2` to `grid grid-cols-2 lg:flex gap-2` so cards go 2×2 on mobile
- Legend: `hidden lg:flex` (hide on mobile to save space)
- Header overlay text: reduce font sizes on mobile using `text-xs sm:text-base`
- Nav buttons (top-left): hide "Public Dashboard" label on mobile, show only icons — use `gap-1 text-[10px] sm:text-xs`
- CountryPanel & SomaliaPanel: add `max-h-[80vh] overflow-y-auto` and `w-[calc(100vw-32px)] max-w-sm` so they don't overflow on phones

### 2. `src/pages/Landing.tsx` — Iframe + nav

- **Nav:** The "Live Attack Map" button is `hidden sm:flex` — change to always show but with a shorter label on xs: show icon only below sm
- **Iframe section:** Replace the fixed `height: 560px` iframe with a responsive height. On mobile show a static preview card instead of an iframe (iframes with maps are very heavy on phones and break layout). Use a `<div className="aspect-video sm:h-[400px] lg:h-[560px]">` wrapping the iframe, and add `pointer-events-none` on mobile so it doesn't intercept scroll. Or simply replace with a link-card on mobile using `block sm:hidden` / `hidden sm:block`.
- **CTA section:** Change `p-10` to `p-6 sm:p-10`
- **Hero:** Already uses `text-4xl sm:text-6xl`, mostly fine
- **Stats grid:** `grid-cols-2 sm:grid-cols-3` — already responsive

**Best approach for iframe:** Show the iframe only on `sm:` and above. On mobile show a "View Live Map →" card instead, avoiding iframe performance issues on phones entirely.

### 3. `src/pages/Dashboard.tsx` — Minor tweaks

- Alert severity cards: `grid grid-cols-2 sm:grid-cols-4 gap-3` (change from `grid-cols-4`)
- Chart container: already responsive with `ResponsiveContainer`
- Header: already uses `flex-wrap`
- National Score section: `grid-cols-1 xl:grid-cols-4` already stacks on mobile

### 4. `src/pages/ThreatMap.tsx` — Minor tweaks

- Severity counters row: already uses `flex gap-2 flex-wrap` — OK
- Map height: `height: calc(100vh - 100px)` may be too tall on mobile after header. Change to `calc(100vh - 140px)` on mobile
- CountryPanel: add responsive width `w-[calc(100%-32px)] max-w-sm` instead of fixed `w-80`
- The `lg:grid-cols-[1fr_280px]` already collapses to 1 col on mobile

### 5. `src/pages/Alerts.tsx` — Filter bar

- Filter buttons row: ensure `flex-wrap gap-2` is used
- Bulk action buttons: use `flex-wrap`

### 6. `src/components/layout/AppLayout.tsx` — Already has mobile sidebar

The mobile header and hamburger already work. No major changes needed, but ensure `main` padding is appropriate: `p-4 lg:p-6` — this is already set.

---

## Technical File Changes

| File | Changes |
|---|---|
| `src/pages/CyberMap.tsx` | Hide sidebar on mobile (`hidden lg:flex`); add floating feed toggle button + bottom drawer for mobile; 2×2 severity grid on mobile; responsive font sizes in header; CountryPanel/SomaliaPanel responsive width |
| `src/pages/Landing.tsx` | Replace iframe with mobile-only link card (`sm:hidden`); hide iframe on mobile (`hidden sm:block`); responsive CTA padding; nav always shows icon |
| `src/pages/Dashboard.tsx` | Severity cards: `grid-cols-2 sm:grid-cols-4` |
| `src/pages/ThreatMap.tsx` | CountryPanel responsive width; minor header spacing |
| `src/pages/Alerts.tsx` | Filter row flex-wrap fix |

---

## Visual Result (Mobile — 390px width)

**`/cyber-map`:**
- Map fills full screen width
- Top header: compact title + counter, no overflow
- Nav buttons: small icons, no overflow
- Bottom bar: 2×2 severity grid (Critical/High on top row, Medium/Low below), no legend (hidden on mobile)
- Floating ⚡ button (bottom-right above the severity bar): taps to open a bottom drawer showing the live feed with up to 30 recent attacks

**`/public` (Landing):**
- Nav shows icon buttons that fit on one line
- Hero text scales properly
- Map section shows a "View Live Map →" full-width card instead of a broken iframe
- Stat cards in 2-column grid
- CTA section uses tighter padding

**Dashboard, Alerts, ThreatMap:**
- Severity cards wrap to 2 columns
- Tables scroll horizontally (already implemented)
- Panels don't overflow screen edges
