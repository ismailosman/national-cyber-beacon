## Slow Down Cyber Map Attack Lines

### Overview

Reduce the speed of the attack arc animations on the `/cyber-map` page so the traveling lines move more gradually across the globe.

### Changes

**File: `src/pages/CyberMap.tsx**`

Update three speed-related constants:

1. `**TRAVEL_DURATION**` (line 55): Increase from `1.2` to `3.0` seconds -- this controls how long the Mapbox-layer arc takes to travel from source to Somalia.
2. `**FLASH_DURATION**` (line 56): Increase from `1.2` to `2.0` seconds -- this controls the impact flash ring expansion at the destination.
3. `**SPEED**` (line 723): Decrease from `0.012` to `0.005` per frame -- this controls the Canvas-overlay projectile dot speed (~3.3s travel at 60fps).

### Result

Attack arcs will take roughly 3 seconds to travel instead of ~1.2 seconds, giving a calmer, more cinematic feel while still looking active. Also the lines are too thin, if you can make bit visible