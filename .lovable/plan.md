

## Plan: Lightweight DAST Security Scanner

### Overview
Add a new "/dast-scanner" page with 6 backend functions that perform passive security tests against monitored organizations' websites. The scanner checks for information disclosure, dangerous HTTP methods, cookie security, CORS misconfiguration, redirect vulnerabilities, and error handling issues.

### Changes

#### 1. Database: Create `dast_scan_results` table
- Columns: id (uuid PK), organization_id (uuid, UNIQUE), organization_name (text), url (text), results (jsonb), summary (jsonb), dast_score (integer 0-100), scanned_at (timestamptz)
- RLS policies matching existing patterns (SuperAdmin/Analyst full, Auditor/OrgAdmin read)

#### 2. Backend Functions (6 new)
Each function accepts `{ url }` and returns `{ success, test, findings[], checkedAt }`. All use safe HTTP methods only (HEAD/GET/OPTIONS).

| Function | What It Tests |
|---|---|
| `dast-info-disclosure` | Server version headers, X-Powered-By, exposed paths (/.env, /.git, /phpinfo.php, etc.) |
| `dast-http-methods` | Dangerous methods (PUT, DELETE, TRACE, CONNECT, PATCH) acceptance |
| `dast-cookie-security` | Missing Secure, HttpOnly, SameSite flags on cookies |
| `dast-cors-check` | Wildcard CORS, origin reflection, null origin acceptance |
| `dast-redirect-check` | HTTP-to-HTTPS redirect, open redirect parameters, redirect chain length |
| `dast-error-handling` | Verbose error pages, stack traces in 404s, exposed admin panels |

All functions have `verify_jwt = false` in config.toml and include standard CORS headers.

#### 3. Sidebar Update (src/components/layout/Sidebar.tsx)
- Add `{ to: '/dast-scanner', icon: Search, label: 'DAST Scanner' }` after the Threat Intel entry
- Import `Search` from lucide-react

#### 4. Router Update (src/App.tsx)
- Add `<Route path="/dast-scanner" element={<DastScanner />} />` inside ProtectedRoutes

#### 5. New Page: src/pages/DastScanner.tsx

**Header section:**
- Title "DAST Security Scanner" with disclaimer about passive scanning
- "Scan All Organizations" button and single-org dropdown selector
- Progress bar showing current test and organization during scans

**Summary cards:**
- Total Scans, Critical/High/Medium/Low finding counts, Last Scan timestamp

**Results table:**
- One row per test category with finding counts by severity
- Rows are clickable to expand individual findings
- Each finding shows severity badge, status, ID, detail, evidence, and remediation steps

**Scoring:**
- DAST score 0-100 calculated as `100 - (critical*25 + high*15 + medium*5 + low*2)`
- Displayed as a grade (A-F) with color coding
- CircularGauge component reused for visual display

**Export:**
- "Export Report" button generates a text/CSV summary of findings

**Scanner logic:**
- Calls all 6 functions sequentially with 2-second delays between tests
- Shows real-time progress updates
- Upserts results to `dast_scan_results` table (one row per org)
- On page load, displays cached results from previous scans

### Technical Details

| File | Action |
|---|---|
| Database migration | Create `dast_scan_results` table with RLS |
| `supabase/functions/dast-info-disclosure/index.ts` | New edge function |
| `supabase/functions/dast-http-methods/index.ts` | New edge function |
| `supabase/functions/dast-cookie-security/index.ts` | New edge function |
| `supabase/functions/dast-cors-check/index.ts` | New edge function |
| `supabase/functions/dast-redirect-check/index.ts` | New edge function |
| `supabase/functions/dast-error-handling/index.ts` | New edge function |
| `supabase/config.toml` | Add `verify_jwt = false` for all 6 functions |
| `src/pages/DastScanner.tsx` | New page component |
| `src/components/layout/Sidebar.tsx` | Add DAST Scanner nav item |
| `src/App.tsx` | Add route |

