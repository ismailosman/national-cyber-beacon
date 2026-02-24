

## Keep Attack Feed History in Sidebar

### Problem
The sidebar feed currently clears all previous attacks when a new burst starts (every ~20 seconds). This means only the latest 1-3 attacks are visible at any time, making the feed look empty and unrealistic.

### Solution
Maintain a separate, persistent history of all attacks in the feed that never gets cleared on burst start. The feed will accumulate attacks over time like a real security operations log.

### Changes

**File: `src/hooks/useLiveAttacks.ts`**

- Stop clearing old threats on burst start. Change the `addThreat` callback so it always prepends new threats to the existing list (never resets to `[threat]`).
- Keep the `RING_BUFFER_SIZE` (100) cap so memory doesn't grow unbounded.

The key change is in the `addThreat` callback (line 228-233):
```text
// Before: clears old batch on burst start
if (isBurstStart) return [threat];
return [threat, ...prev].slice(0, RING_BUFFER_SIZE);

// After: always accumulate, never clear
return [threat, ...prev].slice(0, RING_BUFFER_SIZE);
```

This single change ensures:
- The sidebar feed accumulates all attacks over time (up to 100 entries)
- Attacks that have already reached Somalia and vanished from the map remain visible in the feed
- The feed looks like a real-time security log with continuous history
- Memory stays bounded at 100 entries maximum

### Result
The attack feed sidebar will show a continuous, scrollable log of all recent attacks -- including those whose map lines have already disappeared -- matching the reference image's dense, realistic feed appearance.

