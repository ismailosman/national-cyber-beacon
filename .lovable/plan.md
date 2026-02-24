

## Change Attack Timing to 2s, 3s, 5s Cycle

### Current Behavior
Attacks fire in bursts of 3 (200-500ms apart) followed by an 18-22 second pause.

### New Behavior
Attacks will fire in a repeating 3-step cycle:
1. First attack: wait **2 seconds**
2. Second attack: wait **3 seconds**
3. Third attack: wait **5 seconds**
4. Repeat from step 1

This creates a steady, rhythmic flow across the map instead of rapid bursts with long pauses.

### Technical Details

**File: `src/hooks/useLiveAttacks.ts`**

Update the `getDelay` function to cycle through 2s, 3s, 5s delays:

```text
function getDelay(index: number): number {
  const cycle = index % 3;
  if (cycle === 0) return 2000;  // 2 seconds
  if (cycle === 1) return 3000;  // 3 seconds
  return 5000;                   // 5 seconds
}
```

The seeded randomness for delay is no longer needed since the pattern is fixed. The `getDelay` function is also used by `calculateCurrentIndex` to determine where we are in the day's sequence, so that will automatically stay consistent.

