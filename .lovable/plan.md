
# Add Animated Canvas Arc Lines to the Cyber Threat Map

## Analysis: What's Missing

The current `CyberMap.tsx` has a full Mapbox GeoJSON-based animation engine (arc layers, projectile dots, flash rings). However, the user reports the animated arc lines are **not visible** on the map. After reading the code carefully, here's why:

The Mapbox layer approach has a critical dependency chain:
1. Token must load from `public-stats` edge function
2. Map must fully initialize and fire `map.on('load')`
3. GeoJSON sources must be registered in the correct order
4. Layers must render on top of the dark map tiles

The user's request specifies a **Canvas-based approach** using HTML5 `<canvas>` with `requestAnimationFrame` drawn directly on top of the map. This is more reliable — it doesn't depend on Mapbox internals, works at 60fps with direct pixel control, and produces the glowing trail effect shown in the reference image.

## What the User Wants (from the prompt)

- **Quadratic Bézier curves** from source country → Somalia
- **Progressive drawing** segment by segment (progress 0→1, +0.012 per frame)
- **Trail fade**: bright head, fading tail
- **Glowing moving dot** at the leading edge (radius 3px, shadowBlur 15)
- **Source dot** at origin when animation starts
- **Destination pulse ring** at 80% progress
- **Fade out** after reaching destination (opacity 1→0 over ~60 frames)
- **Lifecycle**: animating → fading → done
- **Color coded** by attack type (existing `ATTACK_COLORS`)
- **Spawning**: new arc every 1.5–3s, 3 arcs on load staggered 400ms

## Implementation Plan

### New approach: Canvas overlay

Add a `<canvas>` element absolutely positioned over the Mapbox canvas. The canvas handles ALL arc drawing independently of Mapbox.

Key conversion needed: lat/lng → pixel coordinates. Since the map uses Mapbox, use `map.project(lngLat)` to convert geographic coordinates to pixel positions. This is called every frame so arcs move correctly when the map pans/zooms.

### New types and data

```typescript
interface CanvasArc {
  id: string;
  srcLng: number; srcLat: number;
  dstLng: number; dstLat: number;
  color: string;
  progress: number;       // 0→1 while animating
  phase: 'animating' | 'fading';
  fadeProgress: number;   // 0→1 while fading (60 frames)
  spawnTime: number;
}
```

### The draw loop

Each frame:
1. Clear the canvas
2. For each active arc:
   - Project src/dst/control point to pixel coords via `map.project()`
   - Build Bézier path to current `progress`
   - Draw trail: iterate from tail to head, each segment with decreasing opacity
   - Draw glowing head dot
   - If `progress > 0.8` → draw expanding pulse ring at dst
   - If `phase === 'fading'` → reduce opacity of the whole arc
3. Remove arcs where `fadeProgress >= 1`

### Bezier drawing with trail

```typescript
// Draw N points along the curve from tailProgress to progress
for (let i = tailStart; i <= currentPoint; i++) {
  const t = i / SEGMENTS;
  const pt = bezierPoint(srcPx, ctrlPx, dstPx, t);
  const segOpacity = ((i - tailStart) / tailLength) * baseOpacity;
  ctx.strokeStyle = `${color}${toHex(segOpacity)}`;
  // draw small segment
}
// Head dot
ctx.shadowBlur = 15;
ctx.shadowColor = color;
ctx.fillStyle = 'white';
ctx.arc(headX, headY, 3, 0, Math.PI * 2);
```

### Integration with existing system

The Canvas approach **adds to** the existing Mapbox layers (doesn't remove them). The Mapbox layers provide source country dots and labels. The Canvas provides the animated arc lines and projectile dots that the user says are missing.

### Canvas sizing

The canvas is created with `devicePixelRatio` scaling for crisp rendering on retina displays. It's resized via a `ResizeObserver` on the map container.

## Files Changed

| File | Changes |
|---|---|
| `src/pages/CyberMap.tsx` | Add `canvasRef`, `canvasArcsRef`, canvas draw loop, canvas element in JSX, arc spawner that picks from `useLiveAttacks` threats |

## Technical Details

### Canvas element placement (in JSX)
```tsx
<canvas
  ref={canvasRef}
  className="absolute inset-0 w-full h-full pointer-events-none z-10"
  style={{ mixBlendMode: 'screen' }} // screen blend for glow effect over dark map
/>
```
The `pointer-events-none` lets map clicks pass through. `mixBlendMode: 'screen'` makes dark portions transparent, enhancing the glow against the dark map.

### Control point elevation
```typescript
const dist = Math.sqrt((dstLng - srcLng)**2 + (dstLat - srcLat)**2);
const elevate = Math.min(dist * 0.35, 45); // higher arc for distant countries
const cpLat = (srcLat + dstLat) / 2 + elevate;
const cpLng = (srcLng + dstLng) / 2;
```

### Spawner
Driven by `threats` from `useLiveAttacks`. Each new threat → new `CanvasArc`. Minimum spawn rate: one arc per threat received (max 1 arc per 1.5s to avoid flooding).

### Cleanup
Arcs are removed when `phase === 'fading' && fadeProgress >= 1`. The ref array never grows unbounded (capped at 60 concurrent arcs).

### Map readiness
The canvas loop only runs when `mapLoaded === true` and `mapRef.current` exists (needed for `map.project()`).
