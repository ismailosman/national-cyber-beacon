

## Spread Attack Arcs Across Country Locations

### Problem
All attack arcs targeting or originating from the same country hit the exact same lat/lng point (the country centroid from the API), making them visually stack on one spot.

### Solution
Add a coordinate jitter function in `shared.ts` that applies a deterministic, per-event random offset (±1–3° depending on country size) to both source and target coordinates. Apply this jitter in `mapEvent()` in `useLiveThreatAPI.ts` so every event gets unique coordinates while staying within the country's general area.

### Changes

**`src/components/cyber-map/shared.ts`** — Add a `jitterCoords` function:
- Takes `lat`, `lng`, and a string seed (the event `id`)
- Uses the existing `seededRand` to generate a deterministic offset (so the same event always renders the same way)
- Applies ±1.5° jitter (enough to spread within a country, not so much it crosses borders for most countries)
- Clamps latitude to [-85, 85]

**`src/hooks/useLiveThreatAPI.ts`** — Apply jitter in `mapEvent()`:
- Import `jitterCoords` from shared
- Jitter both `source` and `target` coordinates using `e.id + '-src'` and `e.id + '-dst'` as seeds
- No other changes to the data flow

This keeps the approach lightweight — no country bounding-box data needed — and produces visually spread arcs with zero API changes.

