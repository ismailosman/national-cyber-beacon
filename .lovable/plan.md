

## Make Attacks Feel Like Real Threats: Burst Pattern with Auto-Clear

### Overview
Change the attack pattern from individual trickles to realistic **bursts of 3 attacks every 20 seconds**, where each batch disappears when the next one arrives. This creates a dramatic, intelligence-dashboard feel.

### Changes

**File: `src/hooks/useLiveAttacks.ts`** -- Burst spawning pattern

1. **Update `getDelay`** (line 37-39): Change to produce a 20-second cycle delay. Each cycle spawns 3 threats in rapid succession (~300ms apart), then waits ~20 seconds for the next burst.

```text
// New logic: every 3rd index triggers a ~20s pause, others fire 300ms apart
function getDelay(index: number): number {
  const r = createSeededRand(DAY_SEED + index * 3571);
  // Every 3 attacks = 1 burst. After a burst, wait 18-22 seconds.
  if ((index + 1) % 3 === 0) {
    return 18000 + r() * 4000; // 18-22s pause between bursts
  }
  return 200 + r() * 300; // 200-500ms between attacks within a burst
}
```

2. **Update `addThreat` callback** (line 224-227): Clear previous threats when a new burst starts (every 3rd attack is the first of a new burst).

```text
const addThreat = useCallback((threat: LiveThreat, isBurstStart: boolean) => {
  setThreats(prev => {
    if (isBurstStart) return [threat]; // clear old batch
    return [threat, ...prev].slice(0, RING_BUFFER_SIZE);
  });
  incrementSharedCount();
}, []);
```

3. **Update the scheduler** (lines 236-249): Pass `isBurstStart` flag when the current index is the start of a new group of 3.

```text
const scheduleNext = () => {
  const delay = getDelay(sharedThreatIndex);
  return setTimeout(() => {
    const realRecently = Date.now() - lastRealEventRef.current < 5000;
    if (!realRecently) {
      const isBurstStart = sharedThreatIndex % 3 === 0;
      addThreat(generateDayThreat(sharedThreatIndex), isBurstStart);
      sharedThreatIndex += 1;
    }
    timerRef.current = scheduleNext();
  }, delay);
};
```

**File: `src/pages/CyberMap.tsx`** -- Adjust arc lifecycle for burst visibility

1. **`VISIBLE_DURATION`** (line 57): Reduce from `15` to `12` seconds so arcs from the previous burst fully fade before the next burst arrives at ~20s.

2. **`FADE_DURATION`** (line 58): Reduce from `3` to `2` seconds for a crisper disappearance.

### Result
- 3 attacks fire in quick succession (200-500ms apart), creating a dramatic burst
- Then a calm 18-22 second pause follows
- When the next burst starts, the previous 3 arcs are cleared from the feed, keeping the display clean
- The visual rhythm mimics real threat intelligence dashboards where attacks come in waves

