

## Add More African Cities & Shuffle All Targets

### Problem
The `GLOBAL_SOUTH_TARGETS` array is visually grouped by country with comments, making the pattern obvious. It also lacks coverage across West, Central, and Southern Africa.

### Solution
1. Add ~10 new African cities spanning West, Central, and Southern Africa
2. Remove the country-group comments and shuffle all entries so no regional clustering is apparent

### Changes

**File: `src/hooks/useLiveAttacks.ts`**

Replace the `GLOBAL_SOUTH_TARGETS` array (lines 148-180) with a shuffled version that includes new cities and removes grouping comments.

**New cities to add:**

| Country | City | Lat | Lng |
|---------|------|-----|-----|
| Nigeria | Lagos | 6.52 | 3.38 |
| Nigeria | Abuja | 9.06 | 7.49 |
| Ghana | Accra | 5.60 | -0.19 |
| Cameroon | Douala | 4.05 | 9.77 |
| Senegal | Dakar | 14.72 | -17.47 |
| Morocco | Casablanca | 33.57 | -7.59 |
| Tunisia | Tunis | 36.81 | 10.17 |
| South Africa | Johannesburg | -26.20 | 28.04 |
| South Africa | Cape Town | -33.92 | 18.42 |
| Mozambique | Maputo | -25.97 | 32.57 |
| DR Congo | Kinshasa | -4.44 | 15.27 |
| Libya | Tripoli | 32.90 | 13.18 |

**Shuffled order** -- all entries will be interleaved (African, MENA, South Asian cities mixed together) with no grouping comments, so the array reads like a random global list rather than a region-by-region catalog.

### Technical Detail

The array grows from 24 to ~36 entries. Since targets are picked randomly via `rand() * length`, the larger pool naturally spreads attacks across more countries without changing any corridor logic or weights.

