

## Remove Duplicate `/threat-map` Route

The `/threat-map` route uses `ThreatMap.tsx` (1171 lines), which is a duplicate of the `/cyber-map` route. It is not referenced in the sidebar or any other navigation -- only in `App.tsx`.

### Changes

**1. `src/App.tsx`**
- Remove the `import ThreatMap from "@/pages/ThreatMap"` line
- Remove the `<Route path="/threat-map" element={<ThreatMap />} />` line
- Visiting `/threat-map` will now show the 404 page (handled by the `/*` catch-all)

**2. Delete `src/pages/ThreatMap.tsx`**
- Remove the entire file (1171 lines) since it is no longer used

### Result
- `/cyber-map` remains the sole threat map route
- `/threat-map` will show the new animated 404 page
- No sidebar or navigation changes needed (it was never linked there)

