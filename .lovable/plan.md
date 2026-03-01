

## Show Kaspersky Globe on Mobile

### Problem
Mobile users can switch to the "KSN Data" tab and see the subsystem charts, but the Kaspersky 3D globe iframe is too tall (600px) and may not render well. More importantly, mobile users accessing data through the mobile drawer's "Sources" tab only see data source indicators and subsystem stats -- they never see the Kaspersky globe widget itself.

### Solution

**File: `src/pages/ThreatMapStandalone.tsx`**

1. **Add a "KSN Map" tab to the mobile drawer** -- extend the mobile drawer tab options from `['stats', 'countries', 'feed', 'sources']` to include a 5th tab `'ksn-map'`.

2. **Render the Kaspersky iframe in the new tab** with mobile-friendly sizing:
   - Height set to ~350px (fits within the 65vh drawer)
   - Same `onWheel` stop-propagation and `touch-action: none` wrapper
   - Include the "Scroll to zoom / Drag to rotate" hint

3. **Make the KSN Data tab's iframe responsive** -- change the fixed 600px height to use a responsive value: `height: min(600px, 50vh)` so it fits better when mobile users switch to the KSN Data tab directly via the top tab bar.

### Technical Details

- Update `mobileDrawerTab` type to `'stats' | 'countries' | 'feed' | 'sources' | 'ksn-map'`
- Add `'ksn-map'` to the tab button array in the mobile drawer
- Add a new conditional block rendering the Kaspersky iframe inside the drawer's scrollable content area
- Update the KSN tab's iframe `style.height` to be viewport-aware
