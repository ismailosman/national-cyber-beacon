

## Randomize Attack Sources for Visual Variety

### Problem
Currently, the threat generator uses a day-seeded deterministic PRNG. This means the same sequence of source countries plays out identically every session. The user sees repetitive patterns rather than a dynamic, varied stream.

### Solution
Replace the deterministic source selection with true randomness (`Math.random()`) so that each attack comes from a genuinely different country. The attack names, types, severities, and targets will also be randomized for full variety. The deterministic daily count and threat IDs will be preserved.

### Technical Details

**File: `src/hooks/useLiveAttacks.ts`**

Update the `generateDayThreat` function (around line 128) to use `Math.random()` instead of the seeded PRNG for selecting:
- Source country (from `WEIGHTED_SOURCES`)
- Target location (from `SOMALIA_TARGETS`)
- Attack type
- Attack signature name
- Severity

This ensures every attack displayed is from a different, randomly chosen country rather than following a fixed daily sequence.

The deterministic day seed will still be used for the daily total count (`BASE_COUNT`), keeping that stat consistent across sessions.

Only one file changes: `src/hooks/useLiveAttacks.ts`.

