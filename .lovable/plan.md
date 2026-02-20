

## Add SSL Certificate Monitoring to Uptime Monitor

### Overview

Add SSL certificate checking on top of the existing uptime ping monitor. The existing ping/uptime functionality remains untouched. SSL monitoring adds a new edge function, a new database table, new columns in the table view, new summary cards, an alerts section, and new filter options.

### 1. New Edge Function: `check-ssl`

**File:** `supabase/functions/check-ssl/index.ts`

Accepts POST with `{ urls: ["https://..."] }` (batch) or `{ url: "https://..." }` (single).

For each URL:
- Extract hostname from the URL
- Attempt an HTTPS fetch to verify SSL validity (success = valid, certificate error = invalid)
- Call a public SSL API (e.g., `https://ssl-checker.io/api/v1/check/{hostname}`) to get certificate details: issuer, valid_from, valid_to, protocol
- Calculate `daysUntilExpiry`, `isExpired`, `isExpiringSoon` (within 30 days)
- Return: `{ url, ssl: { isValid, isExpired, isExpiringSoon, issuer, protocol, validFrom, validTo, daysUntilExpiry } }`
- If the public API is unavailable, fall back to just the fetch-based check (valid/invalid) with null for detailed fields

Set `verify_jwt = false` in `supabase/config.toml`.

### 2. New Database Table: `ssl_logs`

Columns:
- `id` (uuid, PK, default gen_random_uuid())
- `organization_id` (uuid, nullable)
- `organization_name` (text)
- `url` (text)
- `is_valid` (boolean)
- `is_expired` (boolean)
- `is_expiring_soon` (boolean)
- `issuer` (text, nullable)
- `protocol` (text, nullable)
- `valid_from` (timestamptz, nullable)
- `valid_to` (timestamptz, nullable)
- `days_until_expiry` (integer, nullable)
- `checked_at` (timestamptz, default now())

RLS policies matching existing uptime_logs pattern:
- All authenticated can SELECT
- SuperAdmin and Analyst have ALL access
- Auditor has SELECT access

Auto-delete entries older than 30 days via a scheduled database function or handled at query time.

### 3. Frontend Changes to `src/pages/UptimeMonitor.tsx`

**New state and types:**
- Add `SslResult` interface with `isValid`, `isExpired`, `isExpiringSoon`, `issuer`, `protocol`, `validFrom`, `validTo`, `daysUntilExpiry`
- Add `sslStatuses` state map (orgId to SslResult)
- Add `sslFilter` state: 'All' | 'Secure' | 'Expiring Soon' | 'Expired/Invalid'
- Add `sslChecking` state boolean
- SSL check interval: 6 hours (tracked via last check timestamp in state)

**New SSL check function:**
- `checkAllSsl()` - calls `check-ssl` edge function with all org URLs
- Stores results in `ssl_logs` table
- Updates `sslStatuses` state map
- Called on page load and every 6 hours

**New summary cards (added after existing 5 cards):**
- SSL Valid (green) - count of orgs with valid SSL and > 30 days to expiry
- SSL Expiring Soon (yellow) - count expiring within 30 days
- SSL Expired/Invalid (red) - count of expired or invalid certificates

**New table columns (added after existing columns, before "Checked" and actions):**
- **SSL Status** - color-coded badge:
  - Green "Secure" with Lock icon (valid, > 30 days)
  - Yellow "Expiring Soon" with AlertTriangle icon (valid, <= 30 days)
  - Red "Expired"/"Invalid"/"No SSL" with ShieldAlert icon
  - Gray "Unknown" if check pending/failed
- **SSL Expiry** - date + days remaining, color-coded text
- **SSL Issuer** - certificate issuer name or "---"

**New filter option:**
- Add SSL Status filter dropdown: All, Secure, Expiring Soon, Expired/Invalid
- Add "sslExpiry" sort option (soonest expiry first)

**SSL Alerts section (below the table):**
- Shows expired SSL certs in red rows at top
- Shows expiring-soon certs in yellow rows below
- Green banner if all certs are healthy

**Updated "Ping Now" / "Check All Now" button:**
- Triggers both ping and SSL check
- Per-org: add a small "Check SSL" button in the actions area

**Mobile cards:**
- Add SSL status badge and expiry info to mobile card layout

### 4. Config Updates

**`supabase/config.toml`** - add:
```toml
[functions.check-ssl]
verify_jwt = false
```

### Files Changed

| File | Action |
|------|--------|
| `supabase/functions/check-ssl/index.ts` | Create |
| `supabase/config.toml` | Edit (add check-ssl config) |
| `src/pages/UptimeMonitor.tsx` | Edit (add SSL columns, cards, alerts, filters) |
| Migration SQL | Create ssl_logs table + RLS policies |

### Technical Notes

- SSL checks go through the edge function only, never from the browser
- Existing ping logic, uptime_logs table, and ping-website function are not modified
- Errors in SSL checking show "Unknown" in gray, never crash the page
- The 6-hour re-check interval is tracked client-side; on page load always checks immediately
- SSL logs older than 30 days cleaned up via a SQL function or periodic delete

