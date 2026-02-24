
Goal: make every attack line fully disappear the instant it reaches Somalia, with zero lingering arc visibility, while keeping only the arrival flash effect.

What is happening now (root cause):
1. There are two render paths for attack visuals in `src/pages/CyberMap.tsx`:
   - Canvas overlay arcs (recently updated to use `impact` phase)
   - Map-layer GeoJSON arcs (`attack-full-arcs`, `attack-arcs-glow`, `attack-arcs`)
2. The map-layer path still keeps/outputs arc geometry after arrival (especially via `buildFullArcsGeoJSON`), so users still see lines even if canvas logic hides them.
3. The map-layer animation clock currently mixes `Date.now()` and `performance.now()`, which can keep state timing wrong and allow stale visuals to persist.

Implementation plan (single file: `src/pages/CyberMap.tsx`):

1) Fix timing source consistency for arc lifecycle
- In “sync new threats into arc state”, set `startTime` using `performance.now()` (and reduced-motion equivalent based on `performance.now()`), so elapsed/progress/fade calculations are accurate in the RAF loop.
- Keep all arc-state lifecycle math on the same clock (`performance.now()`).

2) Stop emitting any line geometry once an arc arrives
- Update `buildArcsGeoJSON(states)`:
  - Render only while `0 < progress < 1`.
  - Remove the “after arrival show full arc” branch.
- Update `buildFullArcsGeoJSON(states)`:
  - Render guide rail only while `progress < 1`.
  - Do not output full-arc features for impacted attacks.
- Result: all mapbox line layers receive no post-impact line features.

3) Remove arc state immediately at first impact (after triggering flash)
- In the RAF tick loop (map-layer state update):
  - When `newProgress >= 1`:
    - Trigger flash once (existing `flashStatesRef` logic).
    - Immediately delete the arc from `arcStatesRef`.
    - `continue` so no lingering opacity/fade line lifecycle applies.
- Keep flash/ring effects independent via `flashStatesRef`, so arrival still feels realistic without line clutter.

4) Clean up now-obsolete fade behavior for map-layer arcs
- Since arcs are removed on impact, map-layer fade constants/branches should be simplified to avoid conflicting future behavior.
- Preserve canvas behavior as-is (it already hides arc lines in `impact` phase).

5) Verification checklist (desktop + mobile `/cyber-map`)
- Watch a line travel into Somalia:
  - At arrival frame, line is gone immediately (no faint guide rail, no glow, no core trace).
  - Only impact flash/ring remains briefly.
- Let multiple bursts run:
  - No historical line accumulation.
  - Map remains visually clean between bursts.
- Toggle Live off/on:
  - No stale lines reappear.
- Pan/zoom test:
  - No ghost arc artifacts after camera movement.

Acceptance criteria:
- Zero visible attack line segments after impact.
- Arrival flash still plays.
- No persistent/stacked old lines over time.
- Visual result matches “clean, realistic live-threat map” requirement.

Technical notes:
- This is intentionally strict removal (impact = line death) rather than fade.
- By fixing the clock mismatch and post-impact feature emission together, we eliminate both “intended linger” and “buggy stale” line persistence paths.
