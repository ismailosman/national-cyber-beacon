

## Replace DDoS Monitor with Real Backend Data

Replace the simulated DDoS risk data with live results from the Kali Linux backend API, using the existing `security-scanner-proxy` edge function as the proxy.

### Current State
The DDoS Monitor page currently calculates risk from local `uptime_logs` and a `check-ddos-risk` edge function that checks HTTP headers. It builds risk assessments client-side from ping data.

### New Approach
Route all DDoS scanning through the backend API via the existing `security-scanner-proxy` edge function (same pattern as compliance scanning). The backend returns complete risk assessments including WAF detection, response time analysis, exposed ports, and protection status.

### API Paths (via `security-scanner-proxy`)

| Action | Method | Path | Body |
|--------|--------|------|------|
| Scan single org | POST | `/ddos/scan/single` | `{ name, url, sector }` |
| Scan all orgs | POST | `/ddos/scan/bulk` | `{ organizations: [{name, url, sector}] }` |
| Poll result | GET | `/ddos/scan/{scan_id}` | -- |

### Changes

**File: `src/pages/DdosMonitor.tsx`** -- Major refactor

1. **New types**: Replace `DdosProtection` and `RiskAssessment` interfaces with types matching the backend response shape (`DdosScanResult` with `risk_level`, `risk_score`, `risk_factors`, `waf_cdn`, `protected`, `rate_limited`, `origin_exposed`, `response_time`, `exposed_ports`, `waf_evidence`, `checked_at`).

2. **Proxy helper**: Add a `proxyUrl(path)` function (same pattern as ComplianceScan) that builds the URL through `security-scanner-proxy`.

3. **"Check All Now" button**:
   - Collect all loaded orgs (name, url, sector) from existing state
   - POST to `/ddos/scan/bulk`
   - Show progress: "Scanning X organizations..."
   - Poll GET `/ddos/scan/{scan_id}` every 5 seconds until `status === "done"`
   - When done, populate table with real results from `result.organizations`
   - Update summary stats from `result.summary`

4. **Single org re-check**:
   - POST to `/ddos/scan/single` with that org's `{ name, url, sector }`
   - Poll until done
   - Update just that row in state

5. **Table columns mapped to real data**:
   - Risk badge: `result.risk_level` (CRITICAL/HIGH/MEDIUM/LOW)
   - DDoS Protection: CDN provider name if `protected`, otherwise "No Protection"
   - WAF: first item from `waf_cdn` array or "None"
   - Rate Limit: checkmark if `rate_limited`, cross if not
   - Origin: "Hidden" if `!origin_exposed`, "Exposed" if true
   - Resp. Trend: `response_time.trend` with arrow icon (up/down/stable)
   - 1h Avg: `response_time.avg_ms` + "ms"
   - Flaps: `exposed_ports.length` (exposed dangerous ports count)

6. **Detail drawer** (expanded row):
   - Risk score as large colored number
   - Risk factors list with severity badges
   - WAF evidence list
   - Response time details (avg, min, max, trend, status)
   - Exposed ports table (port, service, risk)
   - Checked at timestamp

7. **Summary stat cards**: Use `result.summary` fields (total, critical, high, medium, low, protected).

8. **localStorage persistence**: Save last scan results under key `ddos_last_scan`. On mount, load from localStorage if available so the table persists between page visits.

9. **Remove old code**: Remove `calculateRiskLevel` function, `checkHeaders` function, `calculateRisks` function, uptime_logs queries, and the `check-ddos-risk` edge function invocation. Keep all filter/sort/search/styling logic intact.

### Technical Notes

- No new edge function needed -- reusing `security-scanner-proxy` with `/ddos/scan/*` paths
- The org list still loads from `organizations` table via existing query
- All existing filters (risk level, sector, protection, search, sort) remain unchanged
- The `MiniSparkline` component will be removed since the backend doesn't return ping history; the "Resp. Trend" column will show a text trend indicator instead
- Error handling follows same pattern as compliance scanner (catch non-OK, show toast)
- Polling uses `setInterval` with cleanup, same as compliance scanner

