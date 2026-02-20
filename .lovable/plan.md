

## Fix DDoS Monitor Data Source + Make Cyber Map Deterministic

### Three Issues to Fix

**1. DDoS Monitor uses legacy `organizations_monitored` table (17 orgs instead of 36)**

Same fix as was applied to Uptime Monitor: change the `loadOrgs` function to query the `organizations` table, map `domain` to `url` with `https://` prefix, and update sector constants/colors to match.

**2. Cyber Map attack counter resets on every page refresh**

The `useLiveAttacks` hook has a seeded base count (3,000-15,000) that is deterministic per day, but the counter increments from that base starting at 0 on each page load. After a refresh, it restarts from the base count instead of showing a count that reflects "time elapsed today." Additionally, `generateDayThreat()` uses `Math.random()` instead of the seeded PRNG, so each refresh produces different attack data.

**3. Cyber Map animations are not deterministic across visitors**

The threat generation uses `Math.random()` for source/target/type selection, meaning every visitor sees different attacks. This should use the day-seeded PRNG so all visitors see the same sequence.

---

### Changes

**File: `src/pages/DdosMonitor.tsx`**

- Change `loadOrgs` (line 124-132) to query `organizations` table instead of `organizations_monitored`
- Map `domain` to `url` with `https://` prefix (same pattern as Uptime Monitor fix)
- Update `SECTORS` constant (line 55) to match main org table: `['All', 'Government', 'Bank', 'Telecom', 'Health', 'Education', 'Other']`
- Update `sectorColors` (line 59-71) to include lowercase variants and new sectors (Bank, Health, Other)
- Update sector filter comparison to be case-insensitive

**File: `src/hooks/useLiveAttacks.ts`**

- Fix `generateDayThreat()` to use a seeded PRNG per index instead of `Math.random()`, so the Nth threat of the day is always the same regardless of when/who loads the page
- Make the counter time-based: calculate how many threats "should have been generated" based on elapsed time since midnight (using the deterministic delay function), so the counter at 3pm shows more attacks than at 9am, and refreshing at the same time shows the same count
- Pre-calculate `sharedTodayCount` based on current time of day so it does not restart from the base on refresh
- The `sharedThreatIndex` should start from the calculated "current position" in the day's sequence, not from 0

The key formula: iterate through the day's deterministic delays from midnight until "now" to find how many threats have been generated so far today. Start the live feed from that index.

---

### Technical Details

**Deterministic threat generation fix:**
```
// Before (non-deterministic):
const source = WEIGHTED_SOURCES[Math.floor(Math.random() * WEIGHTED_SOURCES.length)];

// After (deterministic per index):
const rand = createSeededRand(DAY_SEED + index * 7919);
const source = WEIGHTED_SOURCES[Math.floor(rand() * WEIGHTED_SOURCES.length)];
```

**Time-based counter initialization:**
```
// Calculate elapsed ms since midnight
const now = new Date();
const midnightMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
const elapsedMs = now.getTime() - midnightMs;

// Walk through deterministic delays to find current index
let totalMs = 0;
let startIndex = 0;
while (totalMs < elapsedMs) {
  const r = createSeededRand(DAY_SEED + startIndex * 3571);
  totalMs += 300 + r() * 700; // same delay formula as scheduleNext
  startIndex++;
}
sharedTodayCount = BASE_COUNT + startIndex;
sharedThreatIndex = startIndex;
```

This ensures:
- All visitors at the same time see the same counter value
- Refreshing shows the same (or very close) number
- The attack feed continues from where it "should be" in the day's sequence
- Animations show the same attacks for all visitors

### Files Changed

| File | Action |
|---|---|
| `src/pages/DdosMonitor.tsx` | Switch from `organizations_monitored` to `organizations` table, update sectors |
| `src/hooks/useLiveAttacks.ts` | Make threat generation fully deterministic using seeded PRNG per index, calculate time-based counter on init |

