

## Expand North America Threat Targets for Realistic Coverage

### Overview
The current USA_TARGETS array only has 8 cities, heavily weighted to the East Coast. This update expands coverage across all US regions and adds Canada (nationwide), Mexico, and Caribbean nations to create a realistic North American threat corridor.

### Changes

**File: `src/hooks/useLiveAttacks.ts`**

1. **Rename corridor from `'usa'` to `'north_america'`** throughout the file (type unions, generateCorridorThreat, generateBurst) for accuracy.

2. **Replace `USA_TARGETS` with expanded `NORTH_AMERICA_TARGETS`** containing ~40 targets:

   - **USA - East Coast** (keep existing): Washington DC, New York, Miami, Atlanta
   - **USA - Midwest** (new): Chicago, Detroit, Minneapolis, St. Louis, Kansas City, Columbus, Indianapolis, Milwaukee
   - **USA - West Coast** (new): Los Angeles, San Francisco, San Diego, Portland, Denver, Phoenix, Las Vegas, Salt Lake City, Honolulu
   - **USA - South** (new): Dallas, Houston, Austin, Nashville, Charlotte, New Orleans, San Antonio
   - **Canada** (new): Toronto, Montreal, Vancouver, Calgary, Ottawa, Edmonton, Winnipeg, Halifax
   - **Mexico** (new): Mexico City, Guadalajara, Monterrey, Cancun, Tijuana
   - **Caribbean** (new): Kingston (Jamaica), Santo Domingo (Dominican Republic), San Juan (Puerto Rico), Nassau (Bahamas), Port-au-Prince (Haiti), Havana (Cuba), Port of Spain (Trinidad)

3. **Rename `USA_THREAT_SOURCES` to `NORTH_AMERICA_THREAT_SOURCES`** and add more source diversity:
   - Keep existing: Russia, Iran, North Korea, China (weighted)
   - Add: Brazil, Nigeria, Vietnam, Romania for variety

4. **Update type union** from `'usa'` to `'north_america'` in:
   - `generateCorridorThreat` function parameter type
   - `generateBurst` function corridor selection logic

5. **Update `generateBurst`** to reference `'north_america'` instead of `'usa'` in the burst logic (lines 326 and 330).

### No other files change
The corridor type is internal to this hook -- no external consumers reference the corridor string.

