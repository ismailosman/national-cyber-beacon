

## Early Warning and Compromise Detection System

### Overview

Add a new standalone "/early-warning" page with 4 new edge functions, 2 new database tables, and a comprehensive UI for proactive compromise detection across 6 security check types. The page is added to the sidebar with a Radar icon between "DDoS Monitor" and "Reports".

---

### 1. New Edge Functions

**A. `check-defacement`** (`supabase/functions/check-defacement/index.ts`)
- Accepts POST with `{ urls: [{ url, baselineHash, baselineTitle, baselineSize }] }`
- Fetches each URL's HTML, strips dynamic elements (timestamps, CSRF tokens, nonces, session IDs)
- Computes SHA-256 hash of cleaned content
- Checks for defacement keywords ("hacked by", "defaced by", "owned by", "greetz", "cyber army", etc.)
- Compares hash, title, and size against baseline
- Returns: currentHash, currentTitle, currentSize, hashChanged, titleChanged, sizeAnomaly (>70% change), defacementKeywordsFound, isDefaced

**B. `check-dns`** (`supabase/functions/check-dns/index.ts`)
- Accepts POST with `{ domains: ["example.gov.so"] }`
- Uses Google DNS API (`dns.google/resolve`) to resolve A, AAAA, MX, NS, TXT records
- Also checks `_dmarc.{domain}` for DMARC record and common DKIM selectors
- Returns: records (A, AAAA, MX, NS, CNAME, TXT) + emailSecurity (spfExists, spfRecord, dmarcExists, dmarcRecord, dmarcPolicy, dkimFound)
- Handles Checks 2 and 4 (DNS integrity + Email security) in one function

**C. `check-blacklist`** (`supabase/functions/check-blacklist/index.ts`)
- Accepts POST with `{ urls: ["https://example.gov.so"] }`
- Checks against URLhaus API (abuse.ch) -- free, no API key required
- Returns: blacklisted (boolean), blacklistSources, reputation

**D. `check-security-headers`** (`supabase/functions/check-security-headers/index.ts`)
- Accepts POST with `{ urls: ["https://example.gov.so"] }`
- Fetches each URL and inspects response headers for: Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- Calculates score (0-7) and grade (A-F)
- Returns header presence/values, score, grade

**Note on Open Ports (Check 5):** Deno's runtime in Supabase Edge Functions does not support raw TCP socket connections (`Deno.connect`). Port scanning will be implemented as a best-effort HTTP probe on known ports (attempting HTTP/HTTPS connections on ports 8080, 8443, 3389 via HTTP) and clearly noting in the UI that full TCP port scanning requires a dedicated scanning infrastructure. The function will check what it can via HTTP-based probing.

All functions set `verify_jwt = false` in `supabase/config.toml`.

---

### 2. Database Tables

**Table: `early_warning_logs`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid, nullable | FK reference |
| organization_name | text | |
| url | text | |
| check_type | text | defacement, dns, blacklist, email_security, open_ports, security_headers |
| risk_level | text | safe, warning, critical |
| details | jsonb | Full check result |
| is_acknowledged | boolean | default false |
| checked_at | timestamptz | default now() |

**Table: `baselines`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid, nullable | |
| url | text | |
| content_hash | text | SHA-256 |
| page_title | text, nullable | |
| page_size | integer, nullable | |
| dns_records | jsonb | Baseline DNS |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: Authenticated users can SELECT both tables. SuperAdmin and Analyst have ALL access. Auditor has SELECT.

---

### 3. Frontend Page: `src/pages/EarlyWarning.tsx`

A single large page component following the same patterns as DdosMonitor.tsx:

**Layout (top to bottom):**
1. **Page header** with Radar icon, title "Early Warning System", "Run All Checks Now" button
2. **Threat level banner** -- red pulsing if critical, yellow if warnings, green if clear
3. **Summary cards row** -- Organizations Scanned, All Clear, Warnings, Critical Alerts, Defacements Detected, Blacklisted
4. **6 collapsible panels**, one per check type:
   - Panel 1: Website Defacement Monitor (Eye icon) -- table with org, URL, status, hash change, title match, size change, last checked
   - Panel 2: DNS Integrity Monitor (Globe icon) -- table with org, domain, A/NS/MX records, status, changes
   - Panel 3: Blacklist & Reputation (ShieldBan icon) -- table with org, URL, blacklist status, sources
   - Panel 4: Email Security (Mail icon) -- table with org, domain, SPF/DMARC/DKIM status, grade
   - Panel 5: Exposed Ports (Radio icon) -- table with org, hostname, open ports as badges, risk level
   - Panel 6: Security Headers (FileCheck icon) -- table with org, URL, 7 header checks, score, grade
5. **Filters**: check type, risk level, sector, search box
6. **Organization detail modal** on click: overall security score, all 6 check summaries, prioritized recommendations

**State management:**
- Separate state maps for each check type's results
- Baselines loaded from DB on mount
- Check intervals tracked client-side (defacement: 30min, DNS: 1h, blacklist/ports/headers: 6h, email: 12h)
- "Run All Checks Now" triggers all 6 immediately
- Individual re-check per org per check type

**Alert generation:**
- On detecting critical/high issues, insert into existing `alerts` table to feed into the Alert Center and Live Alerts sidebar
- Uses the existing alert de-duplication pattern (check for duplicate within 24h before inserting)

**Mobile responsive:**
- Panels stack vertically
- Tables become card layouts using existing `useIsMobile()` hook
- Summary cards scroll horizontally

---

### 4. Navigation Updates

**`src/components/layout/Sidebar.tsx`:**
- Add nav item `{ to: '/early-warning', icon: Radar, label: 'Early Warning' }` between DDoS Monitor and Reports
- Import `Radar` from lucide-react

**`src/App.tsx`:**
- Import EarlyWarning page component
- Add route `<Route path="/early-warning" element={<EarlyWarning />} />` inside AppLayout routes

---

### 5. Config Update

**`supabase/config.toml`** -- add entries:
```
[functions.check-defacement]
verify_jwt = false

[functions.check-dns]
verify_jwt = false

[functions.check-blacklist]
verify_jwt = false

[functions.check-security-headers]
verify_jwt = false
```

---

### Files Changed

| File | Action |
|------|--------|
| `supabase/functions/check-defacement/index.ts` | Create |
| `supabase/functions/check-dns/index.ts` | Create |
| `supabase/functions/check-blacklist/index.ts` | Create |
| `supabase/functions/check-security-headers/index.ts` | Create |
| `src/pages/EarlyWarning.tsx` | Create |
| `src/components/layout/Sidebar.tsx` | Edit (add nav item) |
| `src/App.tsx` | Edit (add import + route) |
| Migration SQL | Create early_warning_logs + baselines tables with RLS |

### Technical Notes

- All checks go through edge functions, never from the browser
- Existing pages, functions, and tables are NOT modified (except Sidebar and App.tsx for navigation)
- Errors in any check show "Check Failed" in gray, never crash the page
- Baselines are created on first check; users can "Accept New Baseline" to update after legitimate changes
- Critical/high findings are automatically inserted as alerts into the existing alerts table for visibility in Alert Center
- Open port scanning is limited to HTTP-based probing due to Deno runtime constraints; this is noted in the UI

