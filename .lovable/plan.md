
# Make Mobile Feed Drawer Transparent (Glassmorphism)

## What's Happening Now

The mobile live feed drawer (lines 1539–1598) renders as a bottom sheet with a fully opaque dark background:

```typescript
style={{ height: '60vh', background: '#07070f', border: '1px solid rgba(255,255,255,0.1)' }}
```

This completely covers the map underneath. The user wants the feed to be see-through so the map (and its animated arc lines) remain visible behind the feed.

## What's Changing

**One element changes** — the drawer container `div` at line 1544–1545, replacing the solid `#07070f` background with a glassmorphism style using `backdrop-filter: blur()` and a semi-transparent background.

Also updating the section dividers and pill backgrounds inside the drawer to use more transparent versions so the overall glass effect is consistent end-to-end.

## Technical Details

### Drawer container (line 1544–1545)
```typescript
// BEFORE:
style={{ height: '60vh', background: '#07070f', border: '1px solid rgba(255,255,255,0.1)' }}

// AFTER:
style={{
  height: '60vh',
  background: 'rgba(5, 7, 15, 0.72)',   // ~72% opaque — map shows through
  backdropFilter: 'blur(20px)',           // frosted glass blur
  WebkitBackdropFilter: 'blur(20px)',     // Safari support
  border: '1px solid rgba(255,255,255,0.12)',
  borderBottom: 'none',
}}
```

### Header bar (line 1547)
```typescript
// BEFORE:
style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}

// AFTER:
style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)' }}
```

### Backdrop overlay (line 1542)
The `bg-black/60` backdrop behind the drawer is already semi-transparent — it will remain as-is, but reduce it slightly to `bg-black/40` so more map is visible even outside the drawer area.

### Feed row items (line 1579–1581)
The feed entries use `borderBottom: '1px solid rgba(255,255,255,0.05)'` — this stays the same (already transparent enough).

### Severity pills (line 1564–1568)
The pills already use `color}0d` (5% opacity) backgrounds — no change needed, they already look glass-like.

## Visual Result

```text
Before:                          After:
┌─────────────────────┐         ┌─────────────────────┐
│███ DARK OPAQUE ████│         │ ░░ GLASS BLUR  ░░░░ │  ← map visible through
│████████████████████│         │ ░░░░░░░░░░░░░░░░░░░░ │
│████████████████████│         │ Feed entry #1        │
│████████████████████│         │ Feed entry #2        │
│████████████████████│         │ Feed entry #3        │
└─────────────────────┘         └─────────────────────┘
```

The map, its animated arc lines, and attack dots remain fully visible through the frosted glass drawer.

## Files Changed

| File | Lines | What |
|---|---|---|
| `src/pages/CyberMap.tsx` | 1542, 1544–1545, 1547 | Replace solid background with glassmorphism, reduce backdrop opacity |

All changes are cosmetic — no logic, data, or animation code is touched.
