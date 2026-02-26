## Rotate "Top Targeted Countries" with Somalia Every 30 Seconds

### Problem

The Top Targeted Countries list appears static because `topCountries` is recomputed from the same threat buffer and the ranking barely changes. Somalia either always appears or never appears, making it look frozen.

### Solution

Add a rotating country list that cycles through different sets of countries every 30 seconds. Somalia will appear in one specific rotation slot, ensuring it shows once per cycle (roughly every 30 seconds).

### Changes in `src/pages/ThreatMapStandalone.tsx`

1. **Create multiple country rotation sets** -- define 3-4 preset groups of 5 countries each, with Somalia included in exactly one group. Examples:
  - Set 0: Ethiopia, Indonesia, Georgia, Ukraine, Kenya
  - Set 1: **Somalia**, United States, India, Pakistan, Brazil
  - Set 2: Turkey, Nigeria, South Africa, Egypt, Bangladesh
  - Set 3: Iran, China, Philippines, Vietnam, Colombia
2. **Add a `rotationIndex` state** that increments every 30 seconds via `useEffect` with `setInterval`, cycling through the sets.
3. **Replace the static `defaultCountries` and `topCountries` logic** -- instead of computing from threats (which barely changes), use the current rotation set as the displayed list. This makes the list visibly cycle, with Somalia appearing once every ~2 minutes (every 4th rotation at 30s each).
4. **Add a subtle fade transition** using CSS opacity/transition on the country list so entries animate smoothly when the set changes.

### Technical Details

- `useState(0)` for `rotationIndex`
- `useEffect` with 30-second `setInterval` incrementing `rotationIndex` modulo number of sets
- Render `COUNTRY_SETS[rotationIndex]` instead of `topCountries`/`defaultCountries`
- Each set is an array of country name strings
- Add `transition: opacity 0.5s` for smooth visual swap

### File Modified

- `src/pages/ThreatMapStandalone.tsx`  
  
`Add TOP TARGETED COUNTRIES in MOBILE USERS. Now only map is visible for mobile device users`