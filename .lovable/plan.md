

## Widen Jitter for Large Countries (US, Canada, Russia)

### Problem
The current ±1.5° jitter is too small for geographically massive countries like the US, Canada, and Russia. Arcs still cluster near the centroid instead of spreading across multiple "states/regions."

### Solution
Make `jitterCoords` country-aware by accepting an optional country parameter. For large countries, use much wider jitter ranges that match their geographic span:

**`src/components/cyber-map/shared.ts`** — Update `jitterCoords`:

```typescript
const LARGE_COUNTRY_JITTER: Record<string, { latRange: number; lngRange: number }> = {
  'USA':           { latRange: 15, lngRange: 40 },  // spans ~25°N–48°N, ~67°W–125°W
  'United States': { latRange: 15, lngRange: 40 },
  'United States of America': { latRange: 15, lngRange: 40 },
  'Canada':        { latRange: 12, lngRange: 40 },
  'Russia':        { latRange: 15, lngRange: 60 },
  'China':         { latRange: 15, lngRange: 25 },
  'Brazil':        { latRange: 18, lngRange: 18 },
  'India':         { latRange: 12, lngRange: 10 },
  'Australia':     { latRange: 12, lngRange: 20 },
};
```

- Add optional `country?: string` parameter to `jitterCoords`
- Look up the country in the map; if found, use its wider range; otherwise default ±1.5°
- This ensures US/Canada/Russia arcs spread across 5+ visually distinct locations

**`src/hooks/useLiveThreatAPI.ts`** — Pass country name to jitter:

```typescript
const src = jitterCoords(e.source.lat, e.source.lng, e.id + '-src', e.source.country);
const dst = jitterCoords(e.target.lat, e.target.lng, e.id + '-dst', e.target.country);
```

Two files changed, no API changes needed.

