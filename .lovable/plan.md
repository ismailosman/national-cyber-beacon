

## Make the Threat Map Feel Continuously Alive

### Problem
The map has 30-second gaps between API polls where no new arcs appear, making it look static.

### Solution: 3 changes across 2 files

#### 1. Faster Polling + Arc Recycling (`src/hooks/useLiveThreatAPI.ts`)

- Reduce poll interval from 30s to 8s (5s is too aggressive for the backend that already 504s)
- Expose a new `onNewEvents` callback ref so the page can react to fresh arrivals
- Keep the existing 25s AbortController timeout and 504 resilience

#### 2. Client-Side Arc Queue in `src/pages/ThreatMapStandalone.tsx`

Add an arc queue system that keeps the map alive between polls:

- **Arc queue**: When new API events arrive, push them into a queue
- **Ticker** (every 800ms): Pop the next event from the queue and feed it to `ThreatMapEngine` as a "display threat"
- **Recycling**: When the queue is empty, recycle random existing events with new IDs so arcs keep flowing (the map never goes static)
- **Display threats** = real API events drip-fed via the queue, so the engine's existing canvas animation handles everything -- no SVG overlay needed
- Feed the `displayThreats` array (instead of raw `events`) to `ThreatMapEngine`
- Cap at 30 active display threats; oldest auto-expire

This keeps the existing high-performance canvas arc engine intact -- we just control the *timing* of when threats are fed into it.

#### 3. Animated Counter + Feed Fade (`src/pages/ThreatMapStandalone.tsx`)

- **Animated total counter**: `displayCount` state that smoothly increments toward `stats.total` using a `setInterval` stepping by `ceil(diff/10)` every 50ms
- **Attack rate**: Track timestamps of recently displayed arcs in a ref, count those within last 60s
- **Feed fade animation**: Add a CSS `@keyframes fadeSlideIn` animation to new feed items

### What stays the same
- The entire `ThreatMapEngine` component (canvas arcs, Mapbox layers, country highlighting) -- unchanged
- All sidebar panels, legend, header controls
- The `api-proxy` edge function -- no backend changes
- Mobile layout

### Technical Details

```text
useLiveThreatAPI.ts:
  - Change: setInterval 30000 -> 8000
  - No other changes

ThreatMapStandalone.tsx:
  - Add state: arcQueue, displayThreats, displayCount
  - Add ref: recentArcTimestamps (for rate calc)
  - Add useEffect: ticker interval (800ms) that pops from queue or recycles
  - Add useEffect: animated counter toward stats.total
  - Add useEffect: when events change, push new ones to arcQueue
  - Change: pass displayThreats to ThreatMapEngine instead of events
  - Add CSS keyframe for feed item fade-in
```

