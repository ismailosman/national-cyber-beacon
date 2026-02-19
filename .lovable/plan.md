
# Fit World Map on Mobile + Static Daily Data + Add Kenya & Ethiopia

## 3 Changes

### 1. Responsive Map Zoom for All Mobile Devices

**Problem:** The Mapbox map is initialized with hardcoded `center: [20, 10]` and `zoom: 2` (line 937-938 in CyberMap.tsx). On narrow mobile screens this only shows Africa and part of Europe.

**Fix:** Use `window.innerWidth` at initialization time to set responsive values:

| Viewport | center | zoom | minZoom |
|---|---|---|---|
| < 768px (mobile) | [20, 10] | 0.8 | 0.3 |
| >= 768px (desktop) | [20, 10] | 2 | 1 |

Zoom 0.8 on a ~390px screen shows the full world map including all continents, matching the reference image.

**File:** `src/pages/CyberMap.tsx` lines 937-938

---

### 2. Static Deterministic Data Per Day

**Problem:** The threat generator in `useLiveAttacks.ts` uses `Math.random()` everywhere -- for picking sources, targets, attack types, severity, and IDs. Every page load produces completely different attacks.

**Fix:** Replace `Math.random()` with a **day-seeded PRNG**. The seed is derived from today's date string (e.g., `"2026-02-19"`), so:
- Every visitor on the same day sees the exact same sequence of attacks
- The data changes automatically at midnight (new day = new seed)
- The "today count" is also deterministic (seeded from the date)

Changes in `src/hooks/useLiveAttacks.ts`:
- Add a `seededRand` function (same pattern already used in CyberMap.tsx)
- Compute `DAY_SEED` from `new Date().toISOString().slice(0, 10)`
- Replace all `Math.random()` calls in `pickRandom`, `generateMockThreat`, `BASE_COUNT`, and the delay timer with the seeded PRNG
- Each threat gets a sequential index so the Nth threat of the day is always the same

---

### 3. Add Kenya and Ethiopia as Attacking Nations

**Problem:** Kenya and Ethiopia are not in `THREAT_SOURCES` in `useLiveAttacks.ts`, and their ISO codes are missing from `COUNTRY_ISO` in `CyberMap.tsx`.

**Fix:** Add both countries to:

| File | What to add |
|---|---|
| `src/hooks/useLiveAttacks.ts` | Kenya (lat: -1.29, lng: 36.82) and Ethiopia (lat: 9.14, lng: 40.49) to `THREAT_SOURCES` |
| `src/hooks/useLiveAttacks.ts` | Add Kenya and Ethiopia to `WEIGHTED_SOURCES` with weight 2 each (moderate frequency) |
| `src/pages/CyberMap.tsx` | Add `'Kenya': 'ke'` and `'Ethiopia': 'et'` to `COUNTRY_ISO` map |

---

## Files Changed

| File | What |
|---|---|
| `src/hooks/useLiveAttacks.ts` | Add Kenya + Ethiopia to sources; replace Math.random() with day-seeded PRNG for deterministic daily data |
| `src/pages/CyberMap.tsx` | Responsive mobile zoom; add Kenya/Ethiopia ISO codes |

## Visual Result

- On any mobile phone, the full world map is visible (all continents) matching the reference image
- Every visitor on the same calendar day sees the exact same attack sequence and count
- Kenya and Ethiopia appear as attack source nations with arcs flying from Nairobi/Addis Ababa to Somalia
