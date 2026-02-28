

## Replace Simulated Threat Map with Live API Data

### Overview
Replace the current simulated/seeded threat data on `/threat-map` with real data from the backend API (`/threat/map/live`), polled every 30 seconds. The existing Mapbox-based `ThreatMapEngine` (canvas arc animations) will be preserved -- only the data source and sidebar UI change.

### Changes

#### 1. New Hook: `src/hooks/useLiveThreatAPI.ts`
Create a dedicated hook that:
- Polls `api-proxy?path=/threat/map/live` every 30 seconds (using the active `api-proxy` edge function, not the deprecated `compliance-scan-proxy`)
- Deduplicates events by `id` -- only new events trigger arc animations
- Maps API event shape to the existing `LiveThreat` interface used by `ThreatMapEngine`
- Exposes: `events`, `stats`, `topCountries`, `topTypes`, `sourcesActive`, `home`, `refreshedAt`, `isPaused`, `togglePause`, `forceRefresh`, `loading`, `error`
- Keeps a rolling buffer of up to 100 events
- Supports pause/resume and a "Refresh Now" (appends `?force=true`)
- Falls back gracefully when API returns no data (shows "Collecting threat intelligence..." message)

#### 2. Rewrite: `src/pages/ThreatMapStandalone.tsx`
Replace the simulated data layer with the new hook. Restructure the layout:

**Header bar:**
- Globe icon + "Global Threat Intelligence" title
- Blinking red LIVE indicator
- Total attacks counter (from `stats.total`)
- Last updated timestamp (from `refreshed_at`)
- Pause/Resume toggle button
- "Refresh Now" button

**Left sidebar (desktop):**
- Live attack counter (increments with each new event)
- Attack rate: events per minute (derived from event timestamps)
- Bar chart of attacks by type (top 5, from `stats.by_type` or `top_types`)
- Data sources status indicators (green/grey dots for AbuseIPDB, URLhaus, AlienVault, Firewall from `sources_active`)

**Center map:**
- Keep existing `ThreatMapEngine` component unchanged
- Feed it the mapped `LiveThreat[]` array from the API
- Max 30 arcs visible (existing canvas engine already handles this)
- Somalia remains highlighted as home node

**Right sidebar (desktop):**
- Top 10 Attacking Countries (from `top_countries` array) with flag, name, count, mini bar
- Top Attack Types (from `top_types`) with colored dot + label + count
- Live feed of last 10 events with relative timestamps ("2s ago", "5s ago") and masked IPs (last 2 octets replaced with `x.x`)

**Mobile:**
- Collapsible bottom stats panel (existing pattern)
- Feed button to open attack drawer

**Fallback state:**
- When no API data: show map with Somalia highlighted + message "Collecting threat intelligence... Waiting for live feed data"

#### 3. Data Mapping
The API event format maps to `LiveThreat` as follows:

```text
API event.type ("ssh"|"http"|"malware"|...) -> LiveThreat.attack_type
  Mapping: ssh/exploit/recon -> "intrusion", http -> "exploit", 
           malware/botnet -> "malware", phishing/spam -> "phishing", ddos -> "ddos"
  (or extend AttackType to include the new types)

API event.source.lat/lng/country/city -> LiveThreat.source
API event.target.lat/lng/country/city -> LiveThreat.target  
API event.label -> LiveThreat.name
API event.severity (uppercase) -> LiveThreat.severity (lowercase)
API event.color -> used directly for arc coloring
API event.timestamp -> LiveThreat.timestamp (parsed to epoch ms)
```

Since the API provides a `color` field per event, we'll extend the canvas engine to accept per-event colors rather than only type-based colors.

#### 4. Minor Update: `src/components/cyber-map/ThreatMapEngine.tsx`
- Support an optional `color` override on `LiveThreat` so API-provided colors are used directly
- No other changes to the engine

#### 5. IP Masking Utility
Add a simple helper to mask IPs: `185.220.101.42` becomes `185.220.x.x` for the live feed display.

### What Stays the Same
- All existing pages, routes, and navigation remain intact
- The `/threat-map` route stays at the same path with the same Turnstile gate
- The Mapbox canvas arc animation engine is preserved
- The `useLiveAttacks` hook (simulated data) is kept for the `/cyber-map` route if still referenced elsewhere

### Technical Notes
- API calls go through `api-proxy` edge function (path prefix `/threat/` is already in the allowed list)
- The `compliance-scan-proxy` is deprecated; `api-proxy` is the active gateway
- No new dependencies needed -- uses existing Mapbox, Lucide icons, and Tailwind

