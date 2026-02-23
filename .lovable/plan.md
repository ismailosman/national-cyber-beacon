

## Fix "Map Library Error" and Improve Map Visibility

### Root Cause

The "Map library error" appears because the `import('mapbox-gl')` promise's `.catch()` handler fires with that message (line 1217). The actual underlying error is "Failed to initialize WebGL" -- this happens in the Lovable preview iframe which has limited WebGL support. However, there's also a secondary issue: if the map **does** load but WebGL init fails, the `map.on('error')` handler sets a different message. The `.catch()` is too aggressive -- it catches the import *and* any synchronous errors inside the `.then()` callback (like the `new mapboxgl.Map()` constructor throwing).

The fix: wrap the `new Map()` constructor in a try/catch so the error message is more helpful, and add a graceful fallback with a retry mechanism instead of a dead-end error screen.

### Changes (all in `src/pages/CyberMap.tsx`)

**1. Fix the "Map library error" -- better error handling**

- Wrap the `new mapboxgl.Map(...)` constructor (line 935) in a try/catch block
- If the constructor throws (e.g., WebGL unavailable), set a descriptive error: "Map requires WebGL. Please use a supported browser."
- This prevents the generic `.catch()` from showing "Map library error" when the real problem is WebGL
- Update the `.catch()` on the import to say "Failed to load map library" for clarity

**2. Add a retry button to the error overlay**

- In the error overlay (line 1485-1489), add a "Retry" button that clears the error state and resets `mapRef.current = null` so the init effect re-runs
- This helps when the error is transient (e.g., slow network)

**3. Use a brighter map style for better visibility**

- Change the Mapbox style from `mapbox://styles/mapbox/dark-v11` to `mapbox://styles/mapbox/dark-v11` but override the background and water colors after load to make them lighter. Specifically:
  - After the map loads, set the `background` layer paint property to a slightly lighter dark (`#141824` instead of near-black)
  - Set the `water` layer fill color to a visible dark blue (`#1a2540`) so oceans are distinguishable
  - Brighten land color by setting `land` fill to `#1c2030`
- This makes the map significantly more visible while keeping the dark SOC theme

**4. Increase country boundary line brightness**

- Change the country boundary line color from `rgba(148,163,184,0.25)` to `rgba(148,163,184,0.45)` and width from `0.6` to `0.8` so borders are clearly visible

**5. Brighten Somalia highlight**

- Increase Somalia fill opacity from `rgba(56, 189, 248, 0.2)` to `rgba(56, 189, 248, 0.35)`
- Increase Somalia border from `rgba(56, 189, 248, 0.6)` to `rgba(56, 189, 248, 0.8)` and width from `1.5` to `2`

### Summary of edits

| Line(s) | What | Change |
|---|---|---|
| ~935 | Map constructor | Wrap in try/catch with descriptive WebGL error |
| ~1217 | `.catch()` handler | Change message to "Failed to load map library" |
| ~954 (after `map.on('load')`) | Map layer overrides | Brighten background, water, and land layers |
| ~970-976 | Country boundary lines | Opacity `0.25` to `0.45`, width `0.6` to `0.8` |
| ~982-988 | Somalia fill | Opacity `0.2` to `0.35` |
| ~995-1000 | Somalia border | Opacity `0.6` to `0.8`, width `1.5` to `2` |
| ~1485-1489 | Error overlay | Add retry button to clear error and re-init |

