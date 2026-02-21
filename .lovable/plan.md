

## Security Health and Monitoring Dashboard

### Overview

Build a new page at `/admin/security-monitor` that provides a comprehensive security health dashboard. The page is restricted to SuperAdmin users only and follows the existing dark cybersecurity aesthetic with slate/emerald accents.

### New Files

| File | Purpose |
|---|---|
| `src/pages/SecurityMonitor.tsx` | Main dashboard page with all sections |

### Modified Files

| File | Change |
|---|---|
| `src/App.tsx` | Add route `/admin/security-monitor` inside ProtectedRoutes |
| `src/components/layout/Sidebar.tsx` | Add nav item for "Security Monitor" with Shield icon |

### Dashboard Sections

**1. Role Guard**
- Check `userRole?.role === 'SuperAdmin'` at the top of the component
- Show an "Access Denied" message for non-SuperAdmin users

**2. Compliance Overview (top row of cards)**
- Three status badges/cards:
  - **RLS Enabled**: Query `user_roles` table (if data returns without error, RLS is functioning). Show green "Active" badge.
  - **SSL Active**: Use the latest `ssl_logs` entry to check `is_valid`. Show green/red badge accordingly.
  - **HSTS Forced**: Call the existing `check-security-headers` edge function against the app domain, check for `strict-transport-security` header presence.

**3. Auth Metrics (Recharts area chart)**
- Query `auth_logs` is not directly available from the client. Instead, use a proxy approach:
  - Query the `check_errors` table for failed auth-related entries over the last 7 days
  - Query successful login activity by counting distinct sessions from `user_roles` activity
  - Display as an AreaChart with two series: "Successful" (emerald) and "Failed" (red) over 7 days
  - Since actual auth logs aren't available client-side, generate simulated/aggregated data from available tables, with a note that full auth logs require backend log access

**4. Active Sessions Table**
- Since Supabase doesn't expose active sessions to the client SDK, display the most recent user activity:
  - Query `user_roles` joined with recent activity timestamps
  - Show columns: User (masked email), Role, Last Active (from role creation or latest action), Device Type (derived from user-agent if available, otherwise "N/A")
  - Use the existing `Table` components from shadcn/ui

**5. Header Auditor**
- Call the existing `check-security-headers` edge function with the application's own domain
- Display the returned headers in a styled list showing:
  - `Content-Security-Policy` value or "Not Set"
  - `X-Frame-Options` value or "Not Set"
  - `Strict-Transport-Security` value or "Not Set"
  - Other security headers with present/missing status

**6. Threat Feed Health**
- Query `threat_intelligence_logs` for the most recent entry to show last check timestamp and status
- Query `dast_scan_results` for the most recent scan to show DAST runner status
- Display connection status indicators (green dot = healthy, red = stale/no data)

**7. "Run Security Audit" Button**
- Triggers a re-fetch of all queries on the page
- Calls `check-security-headers` edge function fresh
- Shows a loading spinner while running
- Displays a toast on completion

### Technical Details

**Route Registration (App.tsx)**:
- Add `<Route path="/admin/security-monitor" element={<SecurityMonitor />} />` inside the `AppLayout` routes in `ProtectedRoutes`

**Sidebar Navigation (Sidebar.tsx)**:
- Add entry: `{ to: '/admin/security-monitor', icon: Shield, label: 'Security Monitor' }` before Settings

**Component Structure (SecurityMonitor.tsx)**:
- Uses `useAuth()` for role check
- Uses `useQuery` from TanStack Query for data fetching
- Uses `supabase.functions.invoke('check-security-headers', ...)` for header auditing
- Grid layout: `grid grid-cols-1 md:grid-cols-3 gap-4` for top cards, full-width sections below
- Recharts `AreaChart` for auth metrics visualization
- shadcn/ui `Table`, `Badge`, `Card`, `Button` components
- Color scheme: slate backgrounds, emerald/green for healthy, red for issues, amber for warnings

**Data Sources**:
- `ssl_logs` table (latest entry per org)
- `check-security-headers` edge function
- `threat_intelligence_logs` table (latest entry)
- `dast_scan_results` table (latest scan)
- `user_roles` table (active users list)
- `check_errors` table (failed check counts for the chart)
- `alerts` table (recent alert counts for context)

