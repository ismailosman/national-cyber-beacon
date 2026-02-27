
## Fix Missing Country Flags

### Problem
The "United States" flag is broken because `COUNTRY_SETS` uses the name `"United States"`, but the `COUNTRY_ISO` lookup table in `shared.ts` only has entries for `"USA"` and `"United States of America"` -- not `"United States"`. The flag CDN URL ends up using the fallback `"un"` code, which returns no valid image.

### Solution
Add `'United States': 'us'` to the `COUNTRY_ISO` map in `src/components/cyber-map/shared.ts`. All other countries used in `COUNTRY_SETS` (Ethiopia, Indonesia, Georgia, Ukraine, Kenya, Somalia, India, Pakistan, Brazil, Turkey, Nigeria, South Africa, Egypt, Bangladesh, Iran, China, Philippines, Vietnam, Colombia) already have correct entries and their flags load fine.

### File Modified
- `src/components/cyber-map/shared.ts` -- add one line: `'United States': 'us'`
