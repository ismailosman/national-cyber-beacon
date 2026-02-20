

## Diversify US and Canada Attack Sources Across Multiple States/Provinces

### Problem
Currently, the USA has only one source entry (Virginia) and Canada has only one (Toronto). Every attack from these countries originates from the same static point on the map, which looks unrealistic.

### Solution
Replace the single USA and Canada entries with multiple state/province-level entries, each with accurate coordinates. When an attack comes from the US or Canada, it will randomly pick from different locations, creating visual variety on the map.

### Technical Details

**File: `src/hooks/useLiveAttacks.ts`**

**1. Update `THREAT_SOURCES` array** -- replace the single USA and Canada entries with multiple:

USA states (6-8 entries):
- Virginia (VA) -- 37.43, -78.65
- California (CA) -- 36.77, -119.41
- Texas (TX) -- 31.96, -99.90
- New York (NY) -- 40.71, -74.00
- Florida (FL) -- 27.99, -81.76
- Illinois (IL) -- 40.63, -89.39
- Washington (WA) -- 47.75, -120.74
- Georgia (GA) -- 32.16, -82.90

Canada provinces (4-5 entries):
- Ontario (Toronto) -- 43.65, -79.38
- Quebec (Montreal) -- 45.50, -73.56
- British Columbia (Vancouver) -- 49.28, -123.12
- Alberta (Calgary) -- 51.04, -114.07
- Manitoba (Winnipeg) -- 49.89, -97.13

**2. Update `WEIGHTED_SOURCES` array** -- replace the static USA/Canada fills with arrays that pick from these new entries. Instead of `Array(3).fill(single_usa)`, spread all USA entries with appropriate weighting, and similarly for Canada.

No other files need changes. The `generateDayThreat` function already uses `Math.random()` to pick from `WEIGHTED_SOURCES`, so the variety will be automatic.

