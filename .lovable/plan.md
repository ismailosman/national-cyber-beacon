

## Replace Threat Intelligence Scorecards with Real Backend Data

Replace the simulated scorecard data (built from multiple DB tables and edge functions) with real scan results from the Kali Linux backend API, routed through the existing `security-scanner-proxy` edge function. Only the Scorecards tab changes; other tabs show a "Coming soon" placeholder.

### API Integration

Use the same proxy pattern as DDoS Monitor. The `security-scanner-proxy` edge function already forwards any path to the backend.

| Action | Method | Proxy Path |
|--------|--------|------------|
| Bulk scan | POST | `/threat/scan/bulk` |
| Single scan | POST | `/threat/scan/single` |
| Poll result | GET | `/threat/scan/{scan_id}` |

### Changes to `src/pages/ThreatIntelligence.tsx`

#### 1. New Types

Replace `OrgScorecard` and `BreakdownItem` with types matching the backend response:

- `ThreatScanResult` -- mirrors the single scan `result` object (score, grade, risk_level, alerts, checks with all 10 sub-objects, checked_at)
- `BulkScanSummary` -- mirrors `summary` (total, avg_score, critical/high/medium/low counts, grade_counts, national_risk)
- `ThreatScanRecord` -- wraps `{ org: MonitoredOrg, result: ThreatScanResult }`

#### 2. Proxy Helper

Add `proxyFetch<T>(path, method?, body?)` using the same pattern as DDoS Monitor -- builds URL via `security-scanner-proxy?path=...`, includes apikey header.

#### 3. "Run Full Scan" Button

- Collect all orgs (name, url, sector) from existing org state
- POST to `/threat/scan/bulk`
- Poll every 5s showing progress: "Scanning {phase} -- {percent}%"
- When `status === "done"`, populate `scanResults` map and `summary` state
- Save to localStorage key `threat_intel_last_scan`

#### 4. National Threat Level Banner

- Use `summary.national_risk` for level text (CRITICAL/HIGH/MEDIUM/LOW)
- Use `summary.avg_score` for percentage display
- Use `summary.total` for orgs assessed count

#### 5. Grade Distribution Pills

- Use `summary.grade_counts` object (`A+`, `A`, `B`, `C`, `D`, `F`) for the 5 grade cards
- D/F card combines `grade_counts.D + grade_counts.F`

#### 6. Scorecard Grid (Real Data)

Each card shows:
- `ScoreGauge` using `result.score` (out of 100) and `result.grade`
- Risk badge using `result.risk_level`
- Score text: `{result.score}/100 pts ({result.score}%)`
- Timestamp: `result.checked_at` formatted as "Xm ago"
- 10 check badges at bottom, each showing pass/warn/fail:
  - uptime: `checks.uptime.verdict === "ONLINE"` -> green; score > 0 but not 10 -> amber; else red
  - ssl: `checks.ssl.valid && checks.ssl.days_left > 30` -> green; valid but expiring -> amber; else red
  - ddos: `checks.ddos.protected` -> green; else red
  - email: `checks.email.results.spf.present && checks.email.results.dmarc.present` -> green; one present -> amber; else red
  - headers: `checks.headers.score >= 7` -> green; >= 4 -> amber; else red
  - ports: `checks.ports.risky_count === 0` -> green; else red
  - defacement: `!checks.defacement.defaced` -> green; else red
  - dns: `checks.dns.zone_transfer_blocked` -> green; else red
  - blacklist: `!checks.blacklist.listed` -> green; else red
  - software: `checks.software.vulnerabilities.length === 0` -> green; else red

#### 7. Detail Drawer (Sheet)

Replace the current Dialog with a Sheet (slide-out). When a scorecard is clicked:
- Overall score + grade as large display
- All 10 checks with individual scores (0-10) as progress bars
- Alerts list with severity badges
- For each failed check: show `alert_msg`
- SSL: issuer, expiry, days_left
- DDoS: providers list or "None", evidence
- Email: SPF/DMARC/DKIM status
- Ports: table of `exposed_risky` (port, service, severity)
- Software: detected tech and vulnerabilities
- Blacklist: `listed_on` entries
- DNS: zone transfer, DNSSEC, CAA
- `checked_at` timestamp

#### 8. Single Org Refresh

Add a refresh icon button on each scorecard. On click:
- POST `/threat/scan/single` with that org's details
- Show spinner on that card only
- Poll until done, update just that card's result
- Update localStorage

#### 9. localStorage Persistence

- On mount, load from `localStorage.getItem('threat_intel_last_scan')`
- Parse and restore `scanResults` map and `summary`
- On any scan completion, save updated state

#### 10. Other Tabs -- "Coming Soon"

Replace Threat Feed, Tech Stack, Phishing, and Breaches tab content with a centered "Coming soon -- real data integration in progress" message. Keep the tab structure intact.

#### 11. Code Removal

Remove all old scanning logic:
- `calculateScorecards` function and all DB queries (uptime_logs, ssl_logs, ddos_risk_logs, early_warning_logs, tech_fingerprints)
- `runFingerprinting`, `runSecurityHeadersCheck`, `runEmailDnsCheck`, `runBlacklistCheck`, `runDefacementCheck`, `runPortsCheck` callbacks
- `invokeWithRetry`, `logCheckError` helpers
- `runBreachCheck`, `runPhishingCheck`, `fetchThreatFeed` callbacks
- All realtime subscriptions and background scheduling intervals
- `OrgScorecard`, `BreakdownItem`, `ThreatFeedData`, `TechFingerprint`, `PhishingResult`, `BreachResult` types
- `matchLogToOrg`, `matchFirstLogToOrg`, `orgNameMatches`, `NAME_ALIASES`
- `ConfidenceBadge` component
- Breach detail dialog

Keep: `MonitoredOrg` type, org loading from `organizations` table, `ScoreGauge` component, `gradeColor`/`gradeBg`/`severityBadge`/`timeAgo` helpers, search/filter/grade filter logic, all styling/layout.

### Technical Notes

- No new edge function needed -- reuses `security-scanner-proxy`
- File will shrink from ~2132 lines to ~800-900 lines
- Polling uses `setInterval` with ref-based cleanup, same pattern as DDoS Monitor
- All data gracefully handles missing fields with optional chaining
- Error handling: catch non-OK responses, show toast with error detail

