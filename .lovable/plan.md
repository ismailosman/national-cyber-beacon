

## Fix Mobile Feed Drawer -- Stop Covering the Full Map

### Problem

When tapping "Feed" on mobile, the attacks drawer covers the entire screen:
- A full-screen dark overlay (`bg-black/40` on `fixed inset-0`) blocks the map
- The feed panel itself takes `60vh` height with a mostly opaque background

The user wants the feed to show attacks without hiding the map, similar to the reference screenshot where the map is still partially visible above the drawer.

### Solution

Three targeted changes to the mobile feed drawer in `src/pages/CyberMap.tsx`:

**1. Remove the full-screen dark overlay**
Delete the `bg-black/40` backdrop div entirely. Instead, tapping outside the drawer (on the map) will still close it via the container div.

**2. Shrink the feed panel to 45vh**
Reduce from `60vh` to `45vh` so the top half of the map stays fully visible and interactive.

**3. Make the container only cover the bottom, not the full screen**
Change the container from `fixed inset-0` to `fixed bottom-0 left-0 right-0` so it only occupies the bottom portion of the screen, leaving the map above fully tappable.

### Files Changed

| File | Change |
|---|---|
| `src/pages/CyberMap.tsx` | Lines 1537-1541: Remove overlay div, change container positioning from full-screen to bottom-anchored, reduce panel height from 60vh to 45vh |

### Technical Details

**Line 1537** -- Container div:
- Change `fixed inset-0 z-50 flex flex-col justify-end` to `fixed bottom-0 left-0 right-0 z-50`
- This anchors the drawer only to the bottom of the screen

**Line 1538** -- Dark overlay div:
- Remove entirely (the `bg-black/40` absolute overlay)
- The map above the drawer will remain fully visible and interactive

**Line 1541** -- Feed panel:
- Change `height: '60vh'` to `height: '45vh'`
- Keep the existing glassmorphism background (`rgba(5, 7, 15, 0.72)` + backdrop blur) so entries remain readable

This matches the reference screenshot where the map is visible above the attacks list, and the drawer only occupies the lower portion of the screen.

