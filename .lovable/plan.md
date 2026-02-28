

## Integrate Kaspersky Threat Intelligence into Global Threat Map

This is a large integration touching the API proxy, the data hook, and the map UI across 4 files.

### 1. Update API Proxy -- Add `/kaspersky/` prefix

**File: `supabase/functions/api-proxy/index.ts`**

Add `"/kaspersky/"` to the `ALLOWED_PREFIXES` array so the proxy forwards requests to `/kaspersky/live`, `/kaspersky/stats`, and `/kaspersky/check`.

### 2. Update Data Hook -- Switch to Combined Endpoint + Kaspersky State

**File: `src/hooks/useLiveThreatAPI.ts`**

- Change the fetch path from `/threat/map/live` to `/threat/map/combined`
- Add new state fields to `LiveThreatAPIState`:
  - `kaspersky`: subsystems data, top_threats, quota_remaining, api_key_active
- Extend `SourcesActive` to include `kaspersky_ksn` and `kaspersky_tip`
- Extend `APIEvent` interface with optional Kaspersky fields: `subsystem`, `subsystem_label`, `kaspersky_zone`, `threat_name`, `verified`
- Map these extra fields through to the event objects so the UI can access them
- Parse `data.kaspersky` from the combined response and expose it
- Add a new `checkIndicator` function that POSTs to `/kaspersky/check`
- Export new interfaces for Kaspersky subsystem data and indicator check results

### 3. Update Threat Map Page -- All UI Changes

**File: `src/pages/ThreatMapStandalone.tsx`**

**Header tabs**: Rename "Kaspersky Feed" to "KSN Data" (3 tabs: Live Map, KSN Data)

**Left sidebar -- Kaspersky KSN section** (after existing DATA SOURCES):
- Add a divider and "KASPERSKY KSN" header
- Render each subsystem (OAS, ODS, WAV, MAV, IDS, VUL, KAS, RMW) as a row with:
  - Colored dot using `subsystem.color`
  - Abbreviation + label
  - Detection count (`subsystem.total`)
- Below subsystems show API quota with color coding:
  - Green if > 500, yellow if > 100, red if < 100
- Add Kaspersky source dots to the DATA SOURCES section (kaspersky_ksn, kaspersky_tip)

**Left sidebar -- Live feed** (update event rendering):
- For events with `source_api === "Kaspersky KSN Stats"`: prefix with `[KSN]` in teal
- For events with `source_api === "Kaspersky TIP"`: prefix with `[TIP]` in gold

**Right sidebar -- Indicator Lookup widget** (bottom of right panel):
- Add a section titled "CHECK INDICATOR"
- Small input field + Check button
- On submit: POST to `/kaspersky/check` via the proxy with `{ indicator, type: "auto" }`
- Display result as colored badge:
  - Red zone: red badge "MALICIOUS -- {threat_name}"
  - Yellow zone: yellow badge "SUSPICIOUS -- {categories[0]}"
  - Green zone: green badge "CLEAN"
- Show ISP and Country below

**KSN Data tab** (replace existing Kaspersky iframe-only tab):
- Bar chart of detections by subsystem (horizontal bars, using subsystem colors)
- Top 10 countries by detection count
- Top threats list from `kaspersky.top_threats`
- Kaspersky widget iframe at the bottom

**Arc visual changes** (in the live feed display logic, not in the Canvas engine):
- Events with `source_api === "Kaspersky KSN Stats"` use `event.color` (already passed through)
- Events with `verified === true` get a small "verified" indicator in the feed

### 4. No changes needed to ThreatMapEngine

The canvas-based arc engine already uses the `color` property from each event object. Since Kaspersky events will have their subsystem color in the `color` field, arcs will automatically render with the correct colors. The thickness/glow modifications would require canvas engine changes that risk breaking the high-performance rendering, so we keep those visual differences in the feed UI only.

### Summary of files changed

| File | Change |
|------|--------|
| `supabase/functions/api-proxy/index.ts` | Add `/kaspersky/` to allowed prefixes |
| `src/hooks/useLiveThreatAPI.ts` | Switch to `/threat/map/combined`, add Kaspersky state + indicator check |
| `src/pages/ThreatMapStandalone.tsx` | KSN subsystem panel, indicator lookup, KSN Data tab, feed prefixes |

