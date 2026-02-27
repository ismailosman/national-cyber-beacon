

## Fix: Pre-populate Threats on Page Load

### Problem
When `/threat-map` is refreshed, the `threats` array starts empty (`[]`). This means:
- All attack count badges show **0**
- The live feed sidebar is empty
- The "Active Threats" stat shows **0**
- The map has no arcs until the first burst fires (2-5 seconds later)

The `todayCount` counter is already pre-seeded correctly, but the actual threat list builds from scratch.

### Solution
Pre-generate an initial batch of threats on mount using the deterministic seeded random system that already exists. This ensures the page looks populated with realistic data immediately on load.

### Changes in `src/hooks/useLiveAttacks.ts`

1. **Add a `generateInitialThreats()` function** that uses the seeded PRNG to create ~30-40 threats (filling the visible feed) by running `generateBurst()` backwards from the current index. This reuses the existing burst generation logic so the data looks identical to live data.

2. **Initialize `useState` with pre-generated threats** instead of an empty array:
   - Change `useState<LiveThreat[]>([])` to `useState<LiveThreat[]>(() => generateInitialThreats())`

3. **Set realistic timestamps** on initial threats -- space them out over the last few minutes so timestamps in the feed look natural (not all showing the same time).

### Technical Details

```text
generateInitialThreats():
  - Start from sharedThreatIndex and work backwards ~15 bursts
  - Each burst produces 2-3 threats (so ~30-45 total)
  - Assign timestamps going back in time (each burst ~2-5s apart)
  - Return the array capped at RING_BUFFER_SIZE
```

This is a single-file change with no new dependencies.

### File Modified
- `src/hooks/useLiveAttacks.ts`

