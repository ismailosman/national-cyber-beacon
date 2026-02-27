

## Make Country Attack Counts Look Realistic

### Problem
The "Top Targeted Countries" list shows **0** for most countries because `countMap` only counts threats from the small live feed buffer (~40 threats). Since the simulated feed only covers a handful of countries per burst, most countries in the rotation never appear and show 0.

### Solution
Generate seeded baseline attack counts for every country in `COUNTRY_SETS` so they always display realistic, non-zero numbers. The seeded counts will be deterministic (based on the country name) so they stay consistent within a session, and the live feed counts will be added on top.

### Changes in `src/pages/ThreatMapStandalone.tsx`

1. **Add a `seededCountryCounts` constant** using a simple string hash to generate a realistic base count for each country (range: ~800 to ~15,000). Countries like the US, China, Russia, and India get higher base values to look realistic.

2. **Update the `countMap` useMemo** to merge seeded base counts with live feed counts:
   ```
   finalCount = seededBase[country] + liveFeedCount[country]
   ```

This way every country always shows a plausible number (e.g., Japan: 3,847, Germany: 5,212) and the numbers slowly increment as live threats come in.

### Technical Details

```text
// Seeded count generation (deterministic per country name)
function countryBaseCount(name: string): number {
  let hash = 0;
  for (const ch of name) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return 800 + Math.abs(hash) % 14200;  // range 800-15000
}
```

The merge in `countMap`:
```text
for each country in all COUNTRY_SETS:
  m[country] = countryBaseCount(country)
then add live feed counts on top
```

### File Modified
- `src/pages/ThreatMapStandalone.tsx`
