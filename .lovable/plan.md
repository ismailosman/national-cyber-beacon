

## Add DDoS Risk Monitor Page

### Overview

Create a new standalone "/ddos-monitor" page with its own edge function, database table, and full UI for DDoS risk assessment. This page reads from existing `organizations_monitored` and `uptime_logs` tables but has its own `ddos_risk_logs` table and `check-ddos-risk` edge function.

### 1. New Edge Function: `check-ddos-risk`

**File:** `supabase/functions/check-ddos-risk/index.ts`

Accepts POST with `{ urls: [...] }` or `{ url: "..." }`. For each URL:
- HTTP GET with 10s timeout
- Inspect all response headers for CDN indicators (Cloudflare cf-ray, AWS x-amz-cf-id, Akamai, Fastly, Sucuri), rate limiting headers (x-ratelimit-*), WAF headers, and server header
- Return: `{ url, ddosProtection: { hasCDN, cdnProvider, hasRateLimiting, hasWAF, originExposed, protectionHeaders, serverHeader, checkedAt } }`
- Set `verify_jwt = false` in config.toml

### 2. New Database Table: `ddos_risk_logs`

Columns: id, organization_id, organization_name, url, risk_level, has_cdn, cdn_provider, has_rate_limiting, has_waf, origin_exposed, response_time_spike, availability_flapping, extended_downtime, risk_factors (text[]), protection_headers (text[]), server_header, checked_at.

RLS policies matching existing pattern (authenticated SELECT, SuperAdmin/Analyst ALL, Auditor SELECT).

### 3. New Page: `src/pages/DdosMonitor.tsx`

Full standalone page with:

**Summary Cards:**
- Total Monitored (blue)
- Low Risk (green, ShieldCheck icon)
- Medium Risk (yellow, Shield icon)
- High Risk (orange, ShieldAlert icon)
- Critical (red, ShieldX icon, pulsing)
- CDN Protected (cyan)

**Alert Banners:**
- Critical: red pulsing full-width banner naming affected orgs
- High: orange banner with count
- All clear: green banner

**Main Table Columns:**
- Risk Level (color-coded badge, pulsing for critical)
- Organization name
- URL (clickable, external link)
- Sector badge
- DDoS Protection (CDN provider or "No Protection")
- WAF status
- Rate Limiting status
- Origin Exposed indicator
- Response Time Trend (mini sparkline from last 20 uptime_logs pings)
- Current Avg Response (1h average)
- Baseline Response (24h average)
- Status Flaps (1h count, color-coded)
- Active Risk Factors (tag chips)
- Actions (Re-check button)

**Expandable Detail Panel per org:**
- Full risk factor list with explanations
- Response time line chart (last 2h from uptime_logs via recharts)
- Availability timeline (green/red horizontal bar)
- Detected headers list
- Protection recommendations

**Filters & Sorting:**
- Risk level: All, Low, Medium, High, Critical
- Sector: All, Government, Telecom, Banking, Education
- Protection: All, CDN Protected, Unprotected
- Sort by: risk level (default), name, response time, flap count
- Search box

**Risk Calculation (client-side from uptime_logs):**
- Response Time Spike: 1h avg > 3x 24h avg
- Availability Flapping: 3+ status changes in 1h
- Extended Downtime: 3+ consecutive down pings
- Combined with header check results to compute LOW/MEDIUM/HIGH/CRITICAL

**Schedule:**
- On page load: header check + risk calculation
- Every 60s: recalculate risk from uptime_logs (no new API calls)
- Every 6h: re-check DDoS protection headers
- "Check All Now" triggers both immediately

**Mobile:** Card layout with risk badge, name, protection status, risk factors. Summary cards scroll horizontally.

### 4. Sidebar Update

**File:** `src/components/layout/Sidebar.tsx`

Add nav item: `{ to: '/ddos-monitor', icon: ShieldAlert, label: 'DDoS Monitor' }` after the Uptime Monitor entry. Import ShieldAlert from lucide-react.

### 5. Router Update

**File:** `src/App.tsx`

- Import DdosMonitor component
- Add route: `<Route path="/ddos-monitor" element={<DdosMonitor />} />` inside the AppLayout routes

### Files Changed

| File | Action |
|------|--------|
| `supabase/functions/check-ddos-risk/index.ts` | Create |
| `src/pages/DdosMonitor.tsx` | Create |
| `src/components/layout/Sidebar.tsx` | Edit (add nav item + ShieldAlert import) |
| `src/App.tsx` | Edit (add import + route) |
| Migration SQL | Create ddos_risk_logs table + RLS |

### Technical Notes

- Existing uptime/SSL pages, functions, and tables are NOT modified
- DDoS page only READS from uptime_logs and organizations_monitored
- Header checks go through the edge function, never from the browser
- Risk calculation from ping history is done client-side by querying uptime_logs
- Errors show "Unknown" in gray, never crash
- Response time sparkline uses recharts (already installed)

