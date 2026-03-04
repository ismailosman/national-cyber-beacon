

## Snap Attacks to Real City Coordinates (US, Canada, Russia)

### Problem
The current jitter approach applies random offsets from the country centroid, which can land attacks in oceans or empty areas. The user wants attacks to hit recognizable locations like NY, CA, TX, DC, etc.

### Solution
Replace random jitter for US, Canada, and Russia with a **city pool** approach: define arrays of real city coordinates for these countries, and deterministically pick a city from the pool using the event seed. This ensures every attack lands on a real, recognizable location.

### Changes

**`src/components/cyber-map/shared.ts`**

1. Add city coordinate pools for US, Canada, and Russia:

```typescript
const COUNTRY_CITIES: Record<string, { lat: number; lng: number }[]> = {
  'USA': [
    { lat: 40.71, lng: -74.01 },   // New York
    { lat: 34.05, lng: -118.24 },  // Los Angeles
    { lat: 41.88, lng: -87.63 },   // Chicago
    { lat: 29.76, lng: -95.37 },   // Houston/TX
    { lat: 33.45, lng: -112.07 },  // Phoenix
    { lat: 38.91, lng: -77.04 },   // Washington DC
    { lat: 47.61, lng: -122.33 },  // Seattle
    { lat: 25.76, lng: -80.19 },   // Miami
    { lat: 39.96, lng: -82.99 },   // Columbus/OH
    { lat: 44.98, lng: -93.27 },   // Minneapolis/MN
    { lat: 37.77, lng: -122.42 },  // San Francisco
    { lat: 42.36, lng: -71.06 },   // Boston
    { lat: 32.78, lng: -96.80 },   // Dallas/TX
    { lat: 39.74, lng: -104.99 },  // Denver
    { lat: 36.17, lng: -115.14 },  // Las Vegas
  ],
  // Same aliases
  'United States': [...],
  'United States of America': [...],
  'Canada': [
    { lat: 43.65, lng: -79.38 },   // Toronto
    { lat: 45.50, lng: -73.57 },   // Montreal
    { lat: 49.28, lng: -123.12 },  // Vancouver
    { lat: 51.05, lng: -114.07 },  // Calgary
    { lat: 45.42, lng: -75.70 },   // Ottawa
    { lat: 53.55, lng: -113.49 },  // Edmonton
    { lat: 49.90, lng: -97.14 },   // Winnipeg
    { lat: 44.65, lng: -63.57 },   // Halifax
  ],
  'Russia': [
    { lat: 55.76, lng: 37.62 },    // Moscow
    { lat: 59.93, lng: 30.32 },    // St Petersburg
    { lat: 56.84, lng: 60.60 },    // Yekaterinburg
    { lat: 55.03, lng: 82.92 },    // Novosibirsk
    { lat: 43.12, lng: 131.89 },   // Vladivostok
    { lat: 56.33, lng: 44.00 },    // Nizhny Novgorod
    { lat: 55.79, lng: 49.11 },    // Kazan
    { lat: 54.99, lng: 73.37 },    // Omsk
  ],
};
```

2. Update `jitterCoords`: if the country has a city pool, pick a city deterministically (using the seed hash modulo pool length), then apply a tiny ±0.3° jitter around it. Otherwise fall back to the existing range-based jitter.

**`src/hooks/useLiveThreatAPI.ts`** — No changes needed (already passes country).

