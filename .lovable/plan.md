

## Make Attack Lines Disappear Instantly on Arrival

### Problem
Currently, when an attack arc reaches Somalia (progress reaches 1.0), it enters a "fading" phase where it gradually fades out over ~60 frames (~1 second). The user wants lines to vanish immediately upon reaching the destination.

### Change

**File: `src/pages/CyberMap.tsx`** -- Remove the arc immediately when it finishes traveling

In the animation loop (around line 743-755), instead of transitioning to a `fading` phase when `progress >= 1`, simply remove the arc from the array immediately. The impact rings at the destination will still fire since those are triggered separately, but the arc line itself will be gone instantly.

```text
// Current behavior (lines 743-755):
if (arc.phase === 'animating') {
  arc.progress = Math.min(arc.progress + SPEED * dt, 1);
  if (arc.progress >= 1) {
    arc.phase       = 'fading';
    arc.fadeOpacity = 1;
  }
} else {
  arc.fadeOpacity -= (1 / FADE_FRAMES) * dt;
  if (arc.fadeOpacity <= 0) {
    arcs.splice(i, 1);
    continue;
  }
}

// New behavior:
if (arc.phase === 'animating') {
  arc.progress = Math.min(arc.progress + SPEED * dt, 1);
  if (arc.progress >= 1) {
    arc.phase       = 'impact';
    arc.fadeOpacity = 0;   // line invisible immediately
  }
} else if (arc.phase === 'impact') {
  // Only keep the arc alive for impact rings, no visible line
  arc.fadeOpacity -= (1 / FADE_FRAMES) * dt;
  if (arc.fadeOpacity <= -1) {  // allow impact rings time to play
    arcs.splice(i, 1);
    continue;
  }
}
```

Also update the guide rail and trail rendering sections to skip drawing when `arc.phase === 'impact'` -- wrap the guide rail block (~line 776-793) and the trail/core line block (~line 795-830) in a condition:

```text
if (arc.phase !== 'impact') {
  // ... guide rail drawing ...
  // ... glow trail drawing ...
  // ... core bright line drawing ...
}
```

The impact ring animations (destination rings at ~lines 855-900) will continue to render during the `impact` phase, so the user still sees the arrival effect but the line itself is gone.

### Result
- Attack arcs travel from source to Somalia as before
- The moment an arc reaches its destination, the line vanishes completely
- Impact rings still animate at the arrival point for visual feedback
- Clean, professional look with no lingering arc lines cluttering the map
