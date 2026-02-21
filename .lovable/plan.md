

## Fix Cyber Map Mobile View -- Full Globe Fit and Better Visibility

### Problem

On mobile devices, the Cyber Threat Map:
1. Is too zoomed in (zoom 0.8) -- doesn't show the full world map, leaving large empty dark areas
2. The center point [20, 10] puts too much ocean/empty space in view
3. The dark-v11 Mapbox style is extremely dark on small screens with no visual texture
4. The map doesn't adapt its viewport to different mobile screen sizes

The desktop/laptop view is perfect and will NOT be changed.

### Solution

Make three mobile-only adjustments:

**1. Lower mobile zoom and adjust center to fit the full globe**

Change the mobile zoom from `0.8` to `0.4` and adjust the center point for mobile to `[38, 8]` (centered closer to Somalia/Africa) so the entire world map is visible with Somalia prominently positioned. Also lower `minZoom` for mobile from `0.3` to `0.1`.

**2. Add a subtle dot-grid background pattern on mobile for better contrast**

Add a CSS-based repeating dot pattern behind the map container (visible through the dark Mapbox tiles) to match the reference image's dotted world aesthetic. This gives the dark background visual texture and depth instead of pure black emptiness.

**3. Adjust the gradient overlay opacity on mobile**

Reduce the header gradient overlay intensity on mobile so it doesn't darken the already-dark map further.

### Files Changed

| File | Change |
|---|---|
| `src/pages/CyberMap.tsx` | Adjust mobile zoom (0.8 to 0.4), center, and minZoom; reduce mobile header gradient opacity; add dot-pattern background div for mobile |

### Technical Details

**Map initialization (line 934-951)**:
- Change `zoom` from `window.innerWidth < 768 ? 0.8 : 2` to `window.innerWidth < 768 ? 0.4 : 2`
- Change `center` from `[20, 10]` to `window.innerWidth < 768 ? [38, 8] : [20, 10]` -- centers on East Africa/Somalia on mobile
- Change `minZoom` from `window.innerWidth < 768 ? 0.3 : 1` to `window.innerWidth < 768 ? 0.1 : 1`

**Dot-grid background (new element in JSX, before map container)**:
- Add a `<div>` with a CSS radial-gradient repeating dot pattern behind the map
- Only visible on mobile (`lg:hidden`) as the desktop view should not change
- Uses subtle purple/slate dots on dark background matching the reference image

**Header gradient (line 1336)**:
- On mobile, use a less intense gradient so the map remains more visible under the title/counter area
