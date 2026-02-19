
# Plan: Cyber Map Mobile Polish + Login Logo Replacement

## Current State Analysis

Reading the full `CyberMap.tsx` reveals the mobile layout is already partially implemented from the previous round, but it has issues compared to the reference screenshot:

1. **Bottom severity bar is always visible on mobile** — this takes ~80px of vertical space away from the map, which should be fullscreen on phones. The reference screenshot shows the map filling the full screen with only the floating Feed button visible.
2. **Feed button is positioned `bottom-12`** inside the map container — but `bottom-12` (48px) puts it right above the severity bar, making it awkwardly placed. The reference shows it should be at the very bottom-right, floating cleanly over the map.
3. **Severity cards should move into the feed drawer on mobile** — when the user taps "Feed", they see both the live threat list AND the severity breakdown, not just the list.
4. **Login logo** needs to be replaced: currently using `logo-emblem.png` (old asset), needs to use the newly uploaded `login-logo.png`.

## Changes Required

### 1. `src/pages/CyberMap.tsx` — Three targeted fixes

**Fix A: Hide bottom bar on mobile, show it only on desktop**

Change the bottom severity/legend bar to `hidden lg:flex` (or equivalent). On mobile this bar disappears entirely, giving the map full screen height.

```tsx
// Before
<div className="flex-shrink-0 px-3 sm:px-4 py-2" ...>
  <div className="grid grid-cols-2 lg:flex ...">

// After — entire bottom bar hidden on mobile
<div className="hidden lg:flex flex-shrink-0 px-4 py-2" ...>
  <div className="flex items-center gap-2">
```

**Fix B: Reposition the mobile Feed button**

Move the Feed button from `bottom-12` (which was above the now-hidden bar, creating dead space) to `bottom-4`. Style it to match the reference screenshot — larger, with a red badge for the count:

```tsx
// Current (inside map div):
className="lg:hidden absolute bottom-12 right-4 z-20 ..."

// Fix:
className="lg:hidden absolute bottom-4 right-4 z-20 ..."
// Also increase size slightly to match screenshot — text-sm, px-4 py-2.5
```

**Fix C: Add severity cards into the mobile feed drawer**

The mobile drawer currently only shows the threat list. Add a mini severity row at the top of the drawer (4 colored pills in a horizontal row) so users can see the counts when they open the feed:

```tsx
// Inside the mobile drawer, before the scrollable list:
<div className="flex gap-2 px-4 py-2 border-b border-white/5 flex-shrink-0">
  {[
    { label: 'Crit', key: 'critical', color: '#ef4444' },
    { label: 'High', key: 'high',     color: '#f97316' },
    { label: 'Med',  key: 'medium',   color: '#facc15' },
    { label: 'Low',  key: 'low',      color: '#22d3ee' },
  ].map(({ label, key, color }) => (
    <div key={key} className="flex-1 flex flex-col items-center py-1.5 rounded-lg" style={{ background: `${color}0d`, border: `1px solid ${color}33` }}>
      <span className="text-sm font-mono font-bold" style={{ color }}>{severityCounts[key]}</span>
      <span className="text-[9px] uppercase font-mono" style={{ color: `${color}99` }}>{label}</span>
    </div>
  ))}
</div>
```

### 2. Login Page Logo Replacement

**Current:** `src/pages/Login.tsx` imports `logo-emblem.png` from `src/assets/`

**New:** Copy `user-uploads://login-logo.png` → `src/assets/login-logo.png` and update the import.

The new logo is a detailed circular emblem with "SOMALIA CYBER DEFENCE" text on a banner. It should render at a slightly larger size than before to show the detail properly — `w-32 h-32` instead of `w-28 h-28`. Keep the cyan drop shadow glow effect.

```tsx
// Before:
import logoEmblem from '@/assets/logo-emblem.png';
// ...
<img src={logoEmblem} className="w-28 h-28 object-contain mb-4 mx-auto drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]" />

// After:
import loginLogo from '@/assets/login-logo.png';
// ...
<img src={loginLogo} className="w-32 h-32 object-contain mb-4 mx-auto drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]" />
```

## Files Changed

| File | What Changes |
|---|---|
| `src/assets/login-logo.png` | New file — copied from `user-uploads://login-logo.png` |
| `src/pages/Login.tsx` | Import `login-logo.png`; update img src and size (`w-32 h-32`) |
| `src/pages/CyberMap.tsx` | Hide bottom bar on mobile (`hidden lg:flex`); fix Feed button position to `bottom-4`; add severity summary row inside the mobile feed drawer |

## Visual Result on Mobile (390px)

- Map fills the entire screen — no bottom bar eating vertical space
- Top header: logo + "LIVE CYBER THREAT MAP" + attacks count — compact and centered
- Top-left: two icon-only nav buttons (Globe, Shield)  
- Top-right: "⚡ Live •" toggle button
- Bottom-right: "⚡ Feed [48]" floating button with red badge — exactly matching the reference screenshot
- Tap Feed → bottom drawer slides up (60vh) showing:
  - 4 severity count pills (Critical / High / Medium / Low) in a horizontal row
  - Scrolling list of 30 most recent threats

## Login Page

- Same layout and background effects
- New official Somalia Cyber Defence emblem logo (larger, more detailed circular seal) at `w-32 h-32`
- Cyan glow drop shadow preserved
