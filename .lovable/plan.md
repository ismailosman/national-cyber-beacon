

## Fix Country Hover Tooltip

### Problem
The country hover tooltip isn't appearing because of two issues:
1. The `continent-fills` layer uses fully transparent fill (`rgba(0,0,0,0)`) for countries not in the hardcoded continent lists, so Mapbox doesn't fire mouse events on those invisible areas.
2. The vector source has no `promoteId`, making `feature.id` unreliable for `setFeatureState` hover highlights.

### Solution

**File: `src/pages/CyberMap.tsx`**

1. **Add `promoteId`** to the `country-boundaries` source so each feature gets a stable ID based on `iso_3166_1`:
```text
map.addSource('country-boundaries', {
  type: 'vector',
  url: 'mapbox://mapbox.country-boundaries-v1',
  promoteId: { 'country_boundaries': 'iso_3166_1' },
});
```

2. **Add an invisible interactive fill layer** (`country-hover-target`) that covers ALL countries (not just the continent-listed ones). This layer sits below `continent-fills` and catches mouse events everywhere:
   - Fill color: `rgba(0,0,0,0.01)` (nearly invisible but interactive)
   - Placed before `continent-fills` in the layer order

3. **Switch mouse event handlers** from listening on `continent-fills` to listening on `country-hover-target` so every country triggers the tooltip.

4. **Update `hoveredCountryIdRef`** to store a string (ISO code) instead of a number, matching the promoted ID type. Update all `setFeatureState` calls accordingly.

5. **Use `name_en`** from feature properties for the tooltip label (already in place, just needs the events to actually fire).

### Result
- Hovering over any country on the map will show a dark tooltip with the country name (matching the reference image style: "Ethiopia")
- A subtle highlight will appear on the hovered country
- Works for ALL countries, not just those in the continent color lists
