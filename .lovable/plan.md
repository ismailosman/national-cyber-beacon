
## Separate Somalia from Other African Countries in Attack Corridors

### Problem
Right now, the "East Africa" corridor lumps Somalia together with Kenya, Ethiopia, Tanzania, etc. in one `REGION_TARGETS` array. This makes the attack pattern too obvious -- half the attacks all cluster in the same region.

### Solution
Split into **4 corridors** instead of 3, giving each a distinct identity:

1. **Somalia corridor (30%)** -- Somalia-only targets (Mogadishu, Hargeisa, etc.) attacked by global sources
2. **Africa corridor (20%)** -- Kenya, Ethiopia, Djibouti, Tanzania, Sudan, Uganda, Rwanda attacked by different global sources  
3. **USA corridor (25%)** -- Russia, Iran, North Korea, China attacking US cities
4. **EU corridor (25%)** -- South America and Asia attacking European cities

### Changes

**File: `src/hooks/useLiveAttacks.ts`**

1. **Split `REGION_TARGETS` into two arrays:**
   - `SOMALIA_TARGETS` -- the 12 Somalia entries (Mogadishu, Banaadir, Hodan, Hargeisa, etc.)
   - `AFRICA_TARGETS` -- the remaining entries (Djibouti, Kenya, Ethiopia, Tanzania, Sudan, Uganda, Rwanda)

2. **Update `generateDayThreat` corridor selection:**

```text
const corridorRoll = rand();
if (corridorRoll < 0.30) {
  // Somalia corridor
  source = WEIGHTED_SOURCES[...]
  target = SOMALIA_TARGETS[...]
} else if (corridorRoll < 0.50) {
  // Africa corridor
  source = WEIGHTED_SOURCES[...]
  target = AFRICA_TARGETS[...]
} else if (corridorRoll < 0.75) {
  // USA corridor
  source = USA_THREAT_SOURCES[...]
  target = USA_TARGETS[...]
} else {
  // EU corridor
  source = EU_THREAT_SOURCES[...]
  target = EU_TARGETS[...]
}
```

This spreads attacks more naturally across the globe -- Somalia still gets the highest share but the other African countries appear as separate, distinct targets rather than part of one obvious block.
