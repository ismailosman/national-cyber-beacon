

## Dark Web Monitoring Panel

### Overview
Add a new "Dark Web Monitor" page accessible from the sidebar. It will allow users to initiate dark web scans against a domain, poll for results, view past scans, and display findings organized by source (ransomware, HIBP, pastes, dark web mentions, intelligence databases, GitHub).

### Architecture

The existing `security-scanner-proxy` edge function already proxies requests to `cybersomalia.com` with the `SECURITY_API_KEY`. The dark web API endpoints (`/darkweb/scan`, `/darkweb/scans`, `/darkweb/scan/{id}`) follow the same pattern, so **no new edge function is needed** -- the proxy handles arbitrary paths.

### Files to Create

**1. `src/pages/DarkWebMonitor.tsx`** -- Main page component
- Scan form: domain input, comma-separated emails, comma-separated keywords
- Start scan button that POSTs via the proxy
- Poll every 5s while status is `queued` or `running`, showing `darkweb_phase` as live status
- Summary cards: total findings, critical, high, medium counts
- Tabbed results view with 6 tabs: Ransomware, Credential Leaks (HIBP), Paste Sites, Dark Web (Ahmia), Intel Database (IntelX), GitHub
- Each tab shows a table of findings from `darkweb_results.[source].findings`
- Scan history sidebar listing past scans from `/darkweb/scans`

**2. `src/types/darkweb.ts`** -- TypeScript types
```text
DarkWebScanRequest { domain, emails[], keywords[] }
DarkWebFinding { varies per source }
DarkWebResults { ransomware, hibp, pastes, ahmia, intelx, github }
DarkWebSummary { total_findings, critical, high, medium }
DarkWebScan { scan_id, darkweb_status, darkweb_phase, darkweb_summary, darkweb_results, ... }
DarkWebScanSummary (for list endpoint)
```

**3. `src/services/darkwebApi.ts`** -- API service layer
- `startDarkWebScan(domain, emails, keywords)` -- POST `/darkweb/scan`
- `getDarkWebScan(scanId)` -- GET `/darkweb/scan/{id}`
- `listDarkWebScans()` -- GET `/darkweb/scans`
- `pollDarkWebScan(scanId, onUpdate)` -- 5s polling loop, returns stop function
- All use the existing `security-scanner-proxy` edge function

### Files to Modify

**4. `src/components/layout/Sidebar.tsx`** -- Add nav item
- Add `{ to: '/dark-web', icon: Eye, label: 'Dark Web Monitor' }` after Threat Intel

**5. `src/App.tsx`** -- Add route
- Import `DarkWebMonitor` and add `<Route path="/dark-web" element={<DarkWebMonitor />} />`

### UI Design

The page follows the existing scan queue panel pattern with a dark, monospace-heavy design:

```text
+----------------------------------+-------------------------------+
|  Dark Web Monitor                |  [Status: LIVE/Offline]       |
+----------------------------------+-------------------------------+
|  SCAN FORM                       |                               |
|  Domain: [___________]           |  RESULTS PANEL                |
|  Emails: [___________]           |  +---------+---------+-----+  |
|  Keywords: [___________]         |  | Summary Cards (4)       |  |
|  [Start Scan]                    |  | Total | Crit | High | Med|  |
|                                  |  +---------+---------+-----+  |
|  SCAN HISTORY                    |  | Phase: "Checking HIBP"  |  |
|  - scan-abc (done) [View]        |  |                         |  |
|  - scan-def (running) [View]     |  | TABS:                   |  |
|                                  |  | [Ransom][HIBP][Paste]   |  |
|                                  |  | [DarkWeb][Intel][GitHub] |  |
|                                  |  |                         |  |
|                                  |  | Finding table per tab   |  |
+----------------------------------+-------------------------------+
```

### Technical Details

- **Proxy reuse**: Calls go through `security-scanner-proxy` using the `path` query parameter (e.g., `?path=/darkweb/scan`)
- **Polling**: Uses the same pattern as `SecurityDashboard` -- a `while(active)` loop with 5s intervals, stopped on unmount or terminal status
- **No new secrets needed**: `SECURITY_API_KEY` and `SECURITY_API_URL` are already configured
- **No database changes**: Results come from the external API, not stored locally

