
## Add South American and African Countries to Threat Sources

### What Changes

Add new countries to the `THREAT_SOURCES` and `WEIGHTED_SOURCES` arrays in `src/hooks/useLiveAttacks.ts` so attacks appear from more diverse global locations.

### New Countries

**South America (3-4 new entries):**
- Argentina (Buenos Aires) -- -34.60, -58.38
- Colombia (Bogota) -- 4.71, -74.07
- Chile (Santiago) -- -33.44, -70.65
- Venezuela (Caracas) -- 10.48, -66.90

**Africa (3-4 new entries):**
- Rwanda (Kigali) -- -1.94, 29.87
- South Africa (Johannesburg) -- -26.20, 28.04
- Ghana (Accra) -- 5.60, -0.19
- Tanzania (Dar es Salaam) -- -6.79, 39.28

### File Changes

**`src/hooks/useLiveAttacks.ts`**

1. Add all 8 new entries to the `THREAT_SOURCES` array (after existing African countries around line 75)
2. Add them to `WEIGHTED_SOURCES` so they appear in the random selection pool (included via `...THREAT_SOURCES` spread, but South Africa and Rwanda get extra weight with `Array(2).fill()` entries)

Only one file changes. The existing `Math.random()` selection will automatically include the new countries.
