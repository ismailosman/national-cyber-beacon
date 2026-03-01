

## Fix Kaspersky Iframe Map Zoom

### Problem
The embedded Kaspersky Cyberthreat Live Map (3D globe iframe) does not respond to scroll-to-zoom or touch-to-zoom gestures. The iframe loads from `cybermap.kaspersky.com/en/widget/dynamic/dark` and its internal controls require mouse wheel and touch events to pass through properly.

### Root Cause
The iframe container sits inside a scrollable panel, so scroll events are captured by the parent `overflow-y-auto` container instead of being forwarded to the iframe. Additionally, the iframe is missing key `allow` attributes for fullscreen and pointer-lock.

### Solution (File: `src/pages/ThreatMapStandalone.tsx`, lines 319-328)

1. **Add `overflow: hidden`** to the iframe wrapper `div` so the parent scroll container doesn't steal wheel events when the cursor is over the iframe area.

2. **Add `sandbox` attribute** with `allow-scripts allow-same-origin allow-popups` to permit the Kaspersky widget's internal interactivity while keeping it secure.

3. **Set a taller default height** (600px instead of 500px) so the globe is more usable without needing to zoom as much.

4. **Add `pointer-events: auto`** explicitly and wrap the iframe in a container that uses `touch-action: none` to prevent the parent from intercepting pinch/scroll gestures meant for the iframe.

5. **Add a subtle instruction label** below the iframe: "Scroll to zoom -- Drag to rotate" so users know the globe is interactive.

### Technical Detail
The key fix is wrapping the iframe in a div with `onWheel={(e) => e.stopPropagation()}` and `touch-action: none` CSS, which prevents the KSN tab's scrollable container from consuming wheel/touch events before they reach the iframe. The Kaspersky widget internally handles zoom via standard wheel events, so once they pass through, zoom will work.

