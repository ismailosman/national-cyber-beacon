

## Add Country Name Tooltip on Hover

### What it does
When hovering over any country on the cyber map, a tooltip will appear near the cursor showing the country's name -- similar to the reference image showing "South Africa."

### How it works

**File: `src/pages/CyberMap.tsx`**

1. **Add a hover-highlight fill layer** (`country-hover-fill`) on top of the existing `continent-fills` layer. This layer uses a feature-state filter (`hover: true`) to subtly brighten the hovered country, giving visual feedback.

2. **Add a symbol layer for the tooltip** (`country-hover-label`) that displays the `name_en` property from the Mapbox `country-boundaries-v1` tileset as a text label near the hovered country. This label will have:
   - White text with a dark background halo for readability
   - Small font size (~12px) matching the reference style
   - Only visible when a country is hovered

3. **Add mouse event handlers** on the `continent-fills` layer:
   - `mousemove`: Track the currently hovered feature, set its `feature-state` to `{ hover: true }`, and update a React ref tracking the hovered country ISO code
   - `mouseleave`: Clear the feature state and hide the label
   - Change cursor to `pointer` on hover

4. **Use a Mapbox Popup** (lightweight built-in tooltip) instead of a symbol layer for simpler implementation:
   - Create a `mapboxgl.Popup` instance with `closeButton: false, closeOnClick: false` and custom CSS class
   - On `mousemove` over `continent-fills`, set its content to the country's `name_en` and position it at the cursor
   - On `mouseleave`, remove the popup
   - Style the popup with a dark semi-transparent background, white text, and no arrow -- matching the SOC dark theme

5. **Add state ref** (`hoveredCountryIdRef`) to track the previously hovered feature for clearing feature-state on the next move.

### Technical details

- The `country-boundaries-v1` tileset includes `name_en` (English country name) on every feature
- Using Mapbox's built-in Popup is simpler and more performant than a custom HTML overlay since it auto-positions relative to the map
- The popup will be styled via a CSS class injected in the component to match the dark theme (dark background, white text, no border arrow)
- The popup is created once and reused (moved/updated on each mousemove) for performance
