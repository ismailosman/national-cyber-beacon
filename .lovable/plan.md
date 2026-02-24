## Add Global Attack Corridors: USA and EU Targets

### Overview

Expand the attack simulation to show three distinct threat corridors:

1. **East Africa corridor** (existing) -- global sources attacking Somalia and neighbours
2. **USA corridor** -- Russia, Iran, North Korea, and China attacking US cities
3. **EU corridor** -- South American and Asian sources attacking European countries

### Changes

**File: `src/hooks/useLiveAttacks.ts**`

1. **Add USA target locations** -- US cities as attack destinations:
  - Washington DC, New York, Los Angeles, Chicago, Houston, Atlanta, Seattle, Miami
2. **Add EU target locations** -- Major European cities:
  - London, Paris, Berlin, Amsterdam, Brussels, Madrid, Rome, Stockholm
3. **Define attack corridors** with weighted source-target pairings:
  - **East Africa** (~50% of attacks): Uses existing `WEIGHTED_SOURCES` -> `REGION_TARGETS`
  - **USA** (~25%): Sources limited to Russia, Iran, North Korea, China -> US targets
  - **EU** (~25%): Sources limited to Brazil, Argentina, Colombia, Venezuela, China, India, Vietnam, Indonesia, Pakistan -> EU targets
4. **Update `generateDayThreat**` to first pick a corridor (using the seeded PRNG), then pick source and target from that corridor's pools. This ensures geopolitically coherent attack paths (no USA attacking itself, no EU attacking EU).

### Technical details

The corridor selection will use the same seeded PRNG to stay deterministic:

```text
function generateDayThreat(index: number): LiveThreat {
  const rand = createSeededRand(DAY_SEED + index * 7919);
  const corridorRoll = rand();
  let source, target;

  if (corridorRoll < 0.50) {
    // East Africa corridor (existing behavior)
    source = pick from WEIGHTED_SOURCES
    target = pick from REGION_TARGETS
  } else if (corridorRoll < 0.75) {
    // USA corridor
    source = pick from USA_THREAT_SOURCES (Russia, Iran, NK, China)
    target = pick from USA_TARGETS
  } else {
    // EU corridor
    source = pick from EU_THREAT_SOURCES (South America, Asia)
    target = pick from EU_TARGETS
  }
  // ... rest unchanged
}
```

New target arrays:

```text
USA_TARGETS = [
  Washington DC, New York, Los Angeles, Chicago,
  Houston, Atlanta, Seattle, Miami
]

EU_TARGETS = [
  London, Paris, Berlin, Amsterdam,
  Brussels, Madrid, Rome, Stockholm
]

USA_THREAT_SOURCES = [
  Russia (x4), Iran (x3), North Korea (x2), China (x4)
]

EU_THREAT_SOURCES = [
  Brazil (x2), Argentina, Colombia, Venezuela,
  China (x3), India (x2), Vietnam, Indonesia, Pakistan
]
```

No changes needed to the map rendering -- attack arcs already animate between any source/target coordinate pair globally. The `COUNTRY_ISO` map in `CyberMap.tsx` already includes USA and most EU countries, so panels will work when clicking those countries too.  
Don't make the attacks happen at once, make it spread now that many other countries added. 