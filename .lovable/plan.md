

## Simultaneous Multi-Region Attacks & Higher Daily Counter

### What Changes

**1. Burst multi-corridor attacks** -- Instead of firing one attack at a time, each tick will generate 2-3 attacks targeting different corridors simultaneously. When Africa/Somalia gets hit, USA and EU will also show attacks at the same moment, making the map feel like a coordinated global threat landscape.

**2. Increase daily attack count** -- Raise the base counter from 3,000-15,000 to 15,000-45,000 so the "Attacks Today" number looks more realistic and impressive.

### Technical Details

**File: `src/hooks/useLiveAttacks.ts`**

1. **New function `generateBurst(index)`** -- generates 2-3 threats at once, each forced into a different corridor (Somalia/Global South, USA, EU) so attacks always appear across multiple regions simultaneously. Uses the seeded PRNG to pick how many (2 or 3) and assigns each a distinct corridor.

2. **Update `addThreat` to `addThreats` (batch)** -- accepts an array of threats and appends them all at once to the ring buffer, incrementing the shared counter by the batch size.

3. **Update the timer loop** -- instead of calling `generateDayThreat(index)` once, call `generateBurst(index)` which returns an array of 2-3 threats, then advance the shared index by 1 per tick (each tick = one burst).

4. **Raise BASE_COUNT** -- change from `3_000 + rand * 12_000` to `15_000 + rand * 30_000` for a higher daily number.

### Corridor assignment per burst

```text
Burst of 3:
  - Attack 1: Somalia or Global South (50/50)
  - Attack 2: USA corridor
  - Attack 3: EU corridor

Burst of 2:
  - Attack 1: Somalia or Global South (50/50)
  - Attack 2: USA or EU (50/50)
```

This guarantees every burst hits multiple regions, so the map always shows simultaneous global activity.

