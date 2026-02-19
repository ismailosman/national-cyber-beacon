
# Change Threat Map Sidebar Link to /cyber-map

## What's Changing

The sidebar navigation currently links "Threat Map" to `/threat-map`. This will be updated to point to `/cyber-map` instead, so clicking "Threat Map" in the dashboard sidebar opens the full cyber threat map experience.

## Technical Details

**File:** `src/components/layout/Sidebar.tsx`, line 18

Change:
```typescript
// Before
{ to: '/threat-map', icon: Map, label: 'Threat Map' },

// After
{ to: '/cyber-map', icon: Map, label: 'Threat Map' },
```

One line change. The label stays "Threat Map" — only the route changes.
