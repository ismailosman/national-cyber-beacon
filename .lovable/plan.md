

## Website Uptime Monitor for All Organizations

### Overview

Build a dedicated "Uptime Monitor" page that pings organization websites via a backend function, stores results, and displays real-time status with filtering, sorting, and historical uptime data.

### Database Changes

**Table 1: `uptime_logs`**
- id (uuid, PK, default gen_random_uuid())
- organization_id (uuid, nullable, references organizations)
- organization_name (text)
- url (text)
- status (text: "up" or "down")
- status_code (integer, nullable)
- response_time_ms (integer, nullable)
- checked_at (timestamptz, default now())

RLS: SuperAdmin/Analyst full access, Auditor read, OrgAdmin read own org.

**Table 2: `organizations_monitored`**
- id (uuid, PK, default gen_random_uuid())
- name (text)
- url (text)
- sector (text)
- is_active (boolean, default true)
- created_at (timestamptz, default now())

RLS: All authenticated can read; SuperAdmin can insert/update/delete.

Seed with the 16 default organizations (Government, Telecom, Banking, Education sites listed in the prompt).

### Backend Function

**New Edge Function: `ping-website`**
- Accepts POST with `{ url }` or `{ urls: [...] }` for batch pinging
- For each URL: HTTP HEAD request with 10s timeout
- Returns `{ url, status: "up"|"down", responseTime, statusCode, checkedAt }`
- Set `verify_jwt = false` in config.toml
- Include CORS headers

### Frontend Changes

**1. New Page: `src/pages/UptimeMonitor.tsx`**

Summary cards at top:
- Total monitored count
- Online count (green) with percentage
- Offline count (red) with percentage
- Average response time
- Last ping time with countdown to next (60s cycle)

Organization grid/table:
- Pulsing green/red status dot
- Name, clickable URL (opens in new tab)
- Sector badge
- Status text ("Online"/"Offline")
- Response time in ms
- Last checked timestamp
- Uptime % from last 24h of logs
- Mini bar of last 10 pings (green/red squares)

Features:
- Filter by sector and status
- Sort by name, status, response time, uptime %
- "Ping Now" button (all sites or per-site)
- Pulsing radar animation during active pings
- Add/Remove organization dialog (SuperAdmin only)
- Responsive: card layout on mobile, table on desktop
- Loading skeletons on initial load

**2. Sidebar: `src/components/layout/Sidebar.tsx`**
- Add nav item: `{ to: '/uptime', icon: Activity, label: 'Uptime Monitor' }`

**3. Router: `src/App.tsx`**
- Add route: `<Route path="/uptime" element={<UptimeMonitor />} />`

### Ping Logic

- On page mount: ping all active monitored organizations immediately
- setInterval every 60 seconds for re-ping (with cleanup on unmount)
- Countdown timer shows seconds until next cycle
- Each ping calls the `ping-website` edge function
- Results stored in `uptime_logs` table
- Uptime % calculated: (up pings in 24h / total pings in 24h) x 100
- Color coding: green >= 99%, yellow >= 95%, red < 95%

### Alert Integration

When a site goes down (transitions from up to down), automatically create an alert in the `alerts` table with severity "critical", matching the screenshot reference showing "Website Offline" alerts.

### Technical Details

- File count: ~4 files modified/created
  - `supabase/functions/ping-website/index.ts` (new)
  - `src/pages/UptimeMonitor.tsx` (new)
  - `src/components/layout/Sidebar.tsx` (edit - add nav item)
  - `src/App.tsx` (edit - add route)
- 2 new database tables via migration
- Seed data via insert tool
- config.toml updated for new function

