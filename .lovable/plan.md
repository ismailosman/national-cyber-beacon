

## Update Threat Intelligence: Single-Org Scanning with Sequential Queue

Replace the bulk scan approach with individual org scanning, add scan queue functionality, per-org localStorage persistence, and enhanced card UI states.

### Changes to `src/pages/ThreatIntelligence.tsx`

#### 1. Per-Org localStorage Persistence

Replace the single `threat_intel_last_scan` key with per-org keys `threat_intel_{orgName}`. On mount, iterate through loaded orgs and restore each result from localStorage. Remove the old bulk `saveToLS`/`loadFromLS` helpers.

#### 2. Single-Org Scan with Mutex

Replace `refreshSingleOrg` with a scan function that enforces one-at-a-time:
- Track `scanningOrgId` (string or null) and `scanPhase`/`scanPercent` state
- If a scan is running and another card's button is clicked, show toast: "Please wait -- scan in progress for {orgName}"
- POST to `/threat/scan/single` via `proxyFetch`, poll every 4 seconds
- While polling, update `scanPhase` and `scanPercent` from response `phase` and `percent` fields
- On completion, update that org's result in state and save to `localStorage.setItem('threat_intel_{orgName}', ...)`
- On error, set an `errorOrgs` set to track which orgs had failures

#### 3. Sequential Queue ("Scan All")

Repurpose "Run Full Scan" button to "Scan All (Sequential)":
- On click, show confirmation dialog: "This will scan all N organizations one by one. Continue?"
- If confirmed, set `queueRunning = true`, iterate through `orgs` array
- For each org: call the same single-scan function, wait for completion, then move to next
- Track `queueIndex` and `queueTotal` for progress display
- Show a progress bar at the top: "Queue: {done}/{total} -- scanning {currentOrg}..."
- Add a "Stop Queue" button that sets a `queueCancelled` ref to true, stopping after current scan finishes
- Each card updates individually as its scan completes

#### 4. Scan Status Bar

Add a status bar below the National Threat Level banner:
- When idle: "{scannedCount}/{total} organizations scanned"
- When scanning single: "Scanning: {orgName} -- {phase} ({percent}%)"
- When queue running: "Queue: {done}/{total} complete -- scanning {orgName}..."

#### 5. Card UI Updates

Each scorecard now shows these states:

**Never scanned**: Grey score circle showing "N/A", text "Not yet scanned", scan button enabled

**Scanning**: Spinning loader icon replacing the refresh button, phase text below score circle ("Checking SSL... 40%"), small progress bar on card

**Scan complete**: Score gauge with grade, checked_at as "Last scanned: 5m ago", "Rescan" link under timestamp, check badges row

**Scan failed**: Red "Scan failed" text with retry button

**While another scan is running**: Scan button greyed out with tooltip "Scan in progress..."

#### 6. State Changes

Remove:
- `scanning` boolean (replace with `scanningOrgId`)
- `scanStatus` string (replace with `scanPhase`)
- `refreshingOrg` (merge into `scanningOrgId`)
- `runBulkScan` callback
- Bulk `saveToLS`/`loadFromLS`

Add:
- `scanningOrgId: string | null` -- which org is currently scanning
- `scanningOrgName: string` -- display name of current scan
- `scanPhase: string` -- current phase text from poll
- `scanPercent: number` -- current percent from poll
- `errorOrgs: Set<string>` -- org IDs that had scan failures
- `queueRunning: boolean` -- whether sequential queue is active
- `queueIndex: number` -- current position in queue
- `queueTotal: number` -- total queue size
- `queueCancelledRef: React.MutableRefObject<boolean>` -- cancel flag

#### 7. Confirmation Dialog

Add an `AlertDialog` for the "Scan All (Sequential)" confirmation. Import from existing `@/components/ui/alert-dialog`.

#### 8. Tooltip on Disabled Buttons

Use existing `Tooltip` component to show "Scan in progress..." on disabled scan buttons.

### Technical Notes

- No backend or edge function changes needed
- All API calls use existing `proxyFetch` helper with `/threat/scan/single` and `/threat/scan/{scan_id}`
- The sequential queue is implemented as an async loop with early-exit check on `queueCancelledRef.current`
- Grade distribution pills and national banner will compute from loaded per-org results rather than from a bulk summary object
- File size stays roughly the same (~730 lines)

