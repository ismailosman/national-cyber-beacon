

## Adjust Cyber Map Line Thickness and Attack Frequency

### Overview
Two changes: make the attack arc lines thinner (matching the reference images which show thin, clean lines) and space out attacks so only 1-2 appear every 5 seconds instead of the current rapid-fire pace.

### Changes

**File: `src/hooks/useLiveAttacks.ts`** -- Slow down attack spawn rate

Update the `getDelay` function (line 37-39) to produce delays of 2500-5000ms instead of 300-1000ms:

```text
Before:  return 300 + r() * 700;   // 0.3-1s
After:   return 2500 + r() * 2500; // 2.5-5s (1-2 attacks per 5 seconds)
```

**File: `src/pages/CyberMap.tsx`** -- Make lines thinner to match reference

1. **Guide rail line** (line 781): Reduce `lineWidth` from `2` to `1.2`
2. **Glow trail** (line 806): Reduce `lineWidth` from `12` to `6`
3. **Core bright line** (line 820): Reduce `lineWidth` from `3` to `1.5`

### Result
- Attack lines will look thin and clean, similar to the reference screenshots
- Attacks will be well-spaced with 1-2 new arcs appearing every 5 seconds, creating a calmer, more readable visualization
