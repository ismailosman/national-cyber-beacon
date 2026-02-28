

## Add Country Search to "TOP 10 COUNTRIES BY EVENTS" Panel

### Overview
Add a compact search/filter input to the KSN Data tab's country panel so users can search for specific countries beyond the top 10.

### Changes

**File: `src/pages/ThreatMapStandalone.tsx`**

1. Add a new `useState` for the country search query (e.g., `countrySearch`)
2. Replace the hardcoded `.slice(0, 10)` with filtered logic:
   - When search is empty: show top 10 as before
   - When search has text: filter ALL `topAttackers`/`topCountries` by name match (case-insensitive), show up to 20 results
3. Add a small search input above the country list inside the panel:
   - Compact input with a search icon, matching the dark theme (`bg-transparent`, border `rgba(255,255,255,0.1)`)
   - Placeholder: "Search countries..."
   - `text-[10px]` font size to match existing panel style
4. Update the header to say "TOP COUNTRIES BY EVENTS" (drop the "10" when searching)

### UI Layout
```text
+------------------------------------+
| TOP COUNTRIES BY EVENTS            |
| [🔍 Search countries...         ]  |
| 🇨🇳 China          ████████  205  |
| 🇷🇺 Russia         ███████   200  |
| ...                                |
+------------------------------------+
```

### Technical Details
- The `displayAttackers` memo already combines `topAttackers` and `topCountries` but slices to 10
- We'll create a new filtered memo that applies the search filter before slicing
- The search input will be styled consistently with the dark cyber theme
- The max bar width will recalculate based on the filtered set's top value
- Clear button (x) appears when search text is present
