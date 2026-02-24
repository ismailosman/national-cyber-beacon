## Fix Country Click to Open Panel for All Countries

### Problem

Clicking on the map only works for Somalia because it uses a hardcoded bounding box check (lat 0-12, lng 41-51). Other countries like Kenya, Ethiopia, Djibouti, etc. have no click handler on the map fill layer, so nothing happens when you click them.

### Solution

**File: `src/pages/CyberMap.tsx**`

1. **Replace the Somalia bounding-box click handler** (lines 1257-1264) with a click handler on the `country-hover-target` layer that works for ALL countries:
  - On click, read the `name_en` property from the clicked feature
  - If the country is "Somalia", open the `SomaliaPanel` (existing behavior)
  - For any other country, set `selectedCountry` to the country name, opening the `CountryPanel`
2. **Add missing ISO codes** to `COUNTRY_ISO` for the new target countries so the flag icon displays correctly:
  - `'Djibouti': 'dj'`
  - `'Tanzania': 'tz'`
  - `'South Sudan': 'ss'`
  - `'Sudan': 'sd'`
  - `'Uganda': 'ug'`
  - `'Rwanda': 'rw'`
3. **Add cursor pointer** on hover over the `country-hover-target` layer (if not already present) so users see a clickable affordance everywhere.

### Technical details

The key change is switching from:

```text
map.on('click', (e) => {
  // hardcoded Somalia bounding box only
});
```

To:

```text
map.on('click', 'country-hover-target', (e) => {
  const name = e.features?.[0]?.properties?.name_en;
  if (name === 'Somalia') { setSomaliaPanel(true); }
  else if (name) { setSelectedCountry(name); }
});
```

This reuses the existing `country-hover-target` interactive layer (added in a previous fix) that already covers all countries. The `CountryPanel` component already accepts any country name and generates seeded data for it, so no changes needed there.  


Add a legend or stats panel showing attack distribution by target country