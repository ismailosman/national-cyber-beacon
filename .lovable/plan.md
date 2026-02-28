

## Fix KSN Data Tab — Empty Panels

### Root Cause

The API at `/threat/map/combined` returns a `kaspersky` object, but with empty data:

```text
kaspersky: {
  api_key_active: false,
  quota_remaining: 2000,
  subsystems: {},       <-- empty
  top_threats: []       <-- empty
}
```

The Kaspersky API key on the backend is not active (`api_key_active: false`), so no subsystem or threat data is returned. The frontend code is correct but has nothing to display.

### Solution

Add client-side fallback/demo data when the Kaspersky API key is inactive or subsystems are empty. This ensures the KSN Data tab always shows meaningful information.

### Changes

**File: `src/hooks/useLiveThreatAPI.ts`**

- Add a `FALLBACK_KASPERSKY` constant containing the sample subsystem and top_threats data (from the user's previous message)
- In `fetchData`, after receiving `data.kaspersky`, check if `api_key_active` is false or `subsystems` is empty
- If so, merge the fallback data into the kaspersky state, preserving the real `quota_remaining` value
- This keeps the UI populated while clearly sourced from fallback data

**File: `src/pages/ThreatMapStandalone.tsx`**

- Add a small "(demo)" indicator next to "DETECTIONS BY SUBSYSTEM" header when `kaspersky.api_key_active` is false, so it's transparent that fallback data is shown
- No other UI changes needed — existing rendering logic already handles the data correctly

### Technical Details

The fallback data constant will contain:
- 8 subsystems (OAS, IDS, WAV, ODS, VUL, KAS, MAV, RMW) with labels, totals, colors, severity
- 10 top threat names as strings
- Preserves real `quota_remaining` and `api_key_active` from the API

This approach means no backend changes are needed, and the KSN tab will display data immediately.

