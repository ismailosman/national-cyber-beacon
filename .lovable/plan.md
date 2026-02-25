

## Fix Dashboard Live Alerts, Russia Attacks, Missing Flags, and Attack Counter

### Issue 1: Live Alerts Sidebar Always Empty

**Root Cause**: The `AlertSidebar` component filters alerts to only show those created within the **last 1 hour** (`Date.now() - 60 * 60 * 1000`). If no alerts were generated in that narrow window, the sidebar shows "No active alerts."

**Fix** (`src/components/dashboard/AlertSidebar.tsx`):
- Widen the time window from 1 hour to **24 hours**, and increase the limit from 10 to 20
- This ensures recent alerts are always visible even during quiet periods

---

### Issue 2: No Attacks To/From Russia on the Map

**Root Cause**: In `src/hooks/useLiveAttacks.ts`, Russia exists only as an attack **source** (in `WEIGHTED_SOURCES` and `USA_THREAT_SOURCES`). There is no corridor where Russia is a **target**, so no attack arcs ever land on Russia.

**Fix** (`src/hooks/useLiveAttacks.ts`):
- Add a new **Russia corridor** with Russian target cities (Moscow, St. Petersburg, Novosibirsk, Yekaterinburg)
- Add corresponding threat sources for the Russia corridor (USA, UK, Israel, Ukraine, China)
- Update the `generateBurst()` function to include the Russia corridor as a 5th option, giving it roughly 15% of bursts
- Update the corridor type to include `'russia'`

---

### Issue 3: Countries With Missing Flags on the Map

**Root Cause**: Some countries referenced in the live attack feed do not have entries in the `COUNTRY_ISO` lookup table in `src/pages/CyberMap.tsx`, causing them to fall back to the UN flag.

**Fix** (`src/pages/CyberMap.tsx`):
- Audit all country names used across all corridor arrays in `useLiveAttacks.ts` against the `COUNTRY_ISO` map
- Specifically missing or potentially problematic: ensure consistent naming (e.g., confirm all target/source country strings match keys exactly)

---

### Issue 4: "Today's Attack" Counter Too Low

**Root Cause**: The `BASE_COUNT` in `useLiveAttacks.ts` is seeded as `15,000 + random * 30,000` (range: 15k--45k). This produces visually underwhelming numbers for a national cyber defense dashboard.

**Fix** (`src/hooks/useLiveAttacks.ts`):
- Increase `BASE_COUNT` range to `80,000 + random * 120,000` (range: 80k--200k)
- Increase the per-burst increment from `batch.length` (2--3) to a multiplied value to reflect the idea that each visible burst represents many more underlying events

---

### Technical Details

**File: `src/components/dashboard/AlertSidebar.tsx`** (line 21):
- Change `60 * 60 * 1000` (1 hour) to `24 * 60 * 60 * 1000` (24 hours)
- Change `.limit(10)` to `.limit(20)`

**File: `src/hooks/useLiveAttacks.ts`**:
- Add `RUSSIA_TARGETS` array with 4 cities
- Add `RUSSIA_THREAT_SOURCES` array (USA, UK, Israel, Ukraine, China)
- Update `generateCorridorThreat` to handle `'russia'` corridor
- Update `generateBurst` to randomly include Russia as a corridor option
- Change `BASE_COUNT` formula: `Math.floor(80_000 + countRand() * 120_000)`
- Change `incrementSharedCountBy` to multiply by a factor (e.g., each burst adds `batch.length * 3`) to simulate underlying volume

**File: `src/pages/CyberMap.tsx`**:
- Verify and add any missing country ISO codes to the `COUNTRY_ISO` map (cross-referenced against all corridor data)

