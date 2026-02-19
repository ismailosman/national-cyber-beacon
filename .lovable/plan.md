
# Plan: Live Attack Feed Sidebar on /cyber-map + Login Logo

## Summary of Changes

Two focused changes:
1. Restructure `/cyber-map` from a single full-screen overlay into a split layout with a visible map left and a live attack feed sidebar right, plus severity count cards at the bottom that reflect live data
2. Replace the Shield icon on `/login` with the uploaded Somalia Cyber Defence logo image

Also: synchronize the `todayCount` across all hook instances so both maps always show the same number.

---

## Change 1 — Live Feed Sidebar + Severity Cards (CyberMap.tsx)

### Current Layout

The entire page is `relative w-screen h-screen overflow-hidden` with:
- A fullscreen `<div ref={mapContainer} className="absolute inset-0 w-full h-full" />`  
- All UI floating as absolute overlays on top

This means no sidebar is possible without covering the map.

### New Layout Structure

```text
┌──────────────────────────────────┬───────────────────┐
│                                  │  LIVE FEED        │
│    WORLD MAP  (flex-1)           │  header + count   │
│    (arcs, dots, animations)      │  ─────────────    │
│                                  │  🔴 Russia        │
│                                  │  DDoS · CRITICAL  │
│                                  │  2s ago           │
│                                  │  ─────────────    │
│                                  │  🟡 China         │
│                                  │  Malware · HIGH   │
│                                  │  5s ago           │
├──────────────────────────────────┴───────────────────┤
│  [● 2 Critical] [● 5 High] [● 3 Medium] [● 1 Low]   │
│  Legend: ● Malware ● Phishing ● Exploit ● DDoS ...  │
└──────────────────────────────────────────────────────┘
```

The wrapper becomes a `flex flex-col h-screen w-screen bg-black`:
- **Top row**: `flex flex-1 min-h-0` containing:
  - **Left (map area)**: `relative flex-1 min-w-0` — the `mapContainer` div fills this absolutely, all existing overlays (header, nav, toggle, hint, panels) stay inside here
  - **Right (feed sidebar)**: `w-64 xl:w-72 flex-shrink-0 flex flex-col bg-[#08080f] border-l border-white/10`
- **Bottom bar**: `flex-shrink-0 bg-black border-t border-white/10 px-4 py-3` — severity cards + legend

### Live Feed Sidebar Content

**Header row:**
```
⚡ LIVE ATTACK FEED    [badge: count of threats in buffer]
```

**Each entry** (newest first, max 50 shown, `overflow-y-auto`):
- Left color bar border matching attack type color
- Flag emoji or `flagcdn` img + country name → Somalia
- Attack type label + severity badge (colored pill)
- Time ago (`formatDistanceToNow` from `date-fns`)

```
┌─ [red bar] ──────────────────────────┐
│  🇷🇺 Russia → Somalia               │
│  Malware          [● CRITICAL]       │
│  2 seconds ago                       │
└──────────────────────────────────────┘
```

### Severity Count Cards (Bottom Bar)

4 cards derived from `threats.filter(t => t.severity === 'critical').length` etc.:

```
[ ● 2 CRITICAL ] [ ● 7 HIGH ] [ ● 4 MEDIUM ] [ ● 1 LOW ]
```

Colors: Critical = `#ef4444`, High = `#f97316`, Medium = `#facc15`, Low = `#22d3ee`

These numbers come from the in-memory `threats` ring buffer (last 100 threats), which reflects what's currently visible on the map — so they are always in sync.

### Live Counter Sync

The `todayCount` currently uses isolated component state — so CyberMap and ThreatMap each show different numbers. Fix this by promoting to module-level in `useLiveAttacks.ts`:

```typescript
// Module-level singleton — shared across all hook instances in the tab
const BASE_COUNT = Math.floor(3_000 + Math.random() * 12_000);
let sharedTodayCount = BASE_COUNT;
const todayListeners = new Set<React.Dispatch<React.SetStateAction<number>>>();

function incrementSharedCount() {
  sharedTodayCount += 1;
  todayListeners.forEach(fn => fn(sharedTodayCount));
}
```

Each hook instance registers its `setTodayCount` into `todayListeners` on mount and unregisters on unmount. Calling `incrementSharedCount()` instead of `setTodayCount(c => c + 1)` notifies all subscribers simultaneously.

### SomaliaPanel and CountryPanel Position Adjustment

Currently both panels use `right: 16`. With the new sidebar taking 256-288px on the right, these panels will render underneath the sidebar. They need to move to `right: 16` within the map container (which is now `flex-1`, not full-screen) — since they're `absolute` children of the map container div, they will naturally stay inside it. No position change needed.

### Live Toggle Button

Currently positioned at `right-16` (absolute) to avoid overlapping a scrollbar. With the sidebar now occupying the right, the toggle moves to `right-4` within the map container.

---

## Change 2 — Logo on Login Page (Login.tsx)

The uploaded `image-7.png` is the Somalia Cyber Defence circular emblem.

- Save it as `src/assets/logo-emblem.png`
- Import it: `import logoEmblem from '@/assets/logo-emblem.png'`
- Replace the `Shield` icon div:

```tsx
// Before:
<div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-neon-cyan mb-4 glow-cyan">
  <Shield className="w-10 h-10 text-neon-cyan" />
</div>

// After:
<img
  src={logoEmblem}
  alt="Somalia Cyber Defence"
  className="w-28 h-28 object-contain mb-4 drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]"
/>
```

- Remove `Shield` from the lucide-react import (it's still used in other places on other pages, so only remove from Login.tsx)

---

## Files Changed

| File | What |
|---|---|
| `src/hooks/useLiveAttacks.ts` | Module-level `sharedTodayCount` + `todayListeners` set — sync counter across all pages |
| `src/pages/CyberMap.tsx` | Restructure layout to split (map + sidebar); add LiveFeedSidebar component inline; add severity cards + legend in bottom bar; adjust toggle button position |
| `src/pages/Login.tsx` | Import `logo-emblem.png`, replace Shield icon with `<img>`, remove Shield import |
| `src/assets/logo-emblem.png` | New asset — the uploaded Somalia Cyber Defence logo |
