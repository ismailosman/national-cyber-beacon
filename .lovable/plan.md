

## Threat Intelligence and Prevention Dashboard

### Overview

Add a new standalone "/threat-intelligence" page with 4 new edge functions, 3 new database tables, and a tabbed UI for comprehensive threat intelligence covering global threat feeds, technology fingerprinting, phishing domain monitoring, data breach checks, and security scorecards.

---

### 1. New Edge Functions

**A. `fetch-threat-intel`** (`supabase/functions/fetch-threat-intel/index.ts`)
- Aggregates data from free public threat intelligence sources:
  - **CISA KEV**: Fetches `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json` -- filters latest 50 entries, matches affected vendors against detected technologies in our organizations
  - **Abuse.ch URLhaus**: Fetches `https://urlhaus-api.abuse.ch/v1/urls/recent/` -- filters for .so domains or those targeting Somalia
  - **NIST NVD**: Fetches `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=20` -- filters for CVSS >= 7.0 and common web technologies (Nginx, Apache, PHP, WordPress, PostgreSQL, Node.js)
- AlienVault OTX skipped initially (requires API key); can be added later if user provides one
- Results cached for 30 minutes to avoid rate limits
- Returns: `{ cisaKEV: [...], maliciousUrls: [...], latestCVEs: [...], fetchedAt }`

**B. `fingerprint-tech`** (`supabase/functions/fingerprint-tech/index.ts`)
- For each URL, fetches the website and inspects:
  - `Server` header for web server name/version
  - `X-Powered-By` header for language/framework
  - HTML content for `<meta name="generator">` tag (WordPress, Joomla, Drupal)
  - Known CMS paths: tries HEAD requests to `/wp-login.php`, `/administrator`, `/user/login`
  - Cookie names in `Set-Cookie` header: `PHPSESSID`, `ASP.NET_SessionId`, `JSESSIONID`
  - HTML body for JS library signatures (jQuery, React, Vue, Angular)
- Returns: `{ url, technologies: { webServer, language, cms, framework, cdn, jsLibraries }, checkedAt }`

**C. `check-phishing-domains`** (`supabase/functions/check-phishing-domains/index.ts`)
- For each organization domain, generates typosquat variations:
  - Letter substitution (o to 0, l to 1, i to 1)
  - Missing/extra letters, hyphenated versions, different TLDs (.com, .net, .org, .io)
- For each variation, does a DNS lookup via Google DNS API (`dns.google/resolve`)
- If domain resolves, flags as existing; optionally attempts HTTP fetch to check for active website
- Returns: `{ organization, domain, lookalikeDomains: [{ domain, exists, ip, hasWebsite, risk }], totalFound }`

**D. `check-breaches`** (`supabase/functions/check-breaches/index.ts`)
- Checks organization email domains against free breach data sources
- Uses the HIBP public breaches list (`https://haveibeenpwned.com/api/v3/breaches`) to get known breach names and metadata
- Cross-references organization domains (note: full domain search requires paid HIBP API key; function will check public breach list and flag if organization's sector/type matches known breach targets)
- Returns: `{ domain, breachesFound, breaches: [{ name, date, recordCount, dataTypes }] }`

All functions set `verify_jwt = false` in config.toml.

---

### 2. New Database Tables

**Table: `threat_intelligence_logs`**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid, nullable | null for global threats |
| organization_name | text, nullable | |
| check_type | text | threat_feed, tech_fingerprint, phishing_domain, data_breach, scorecard |
| risk_level | text | info, low, medium, high, critical |
| details | jsonb | Full check result |
| is_acknowledged | boolean | default false |
| checked_at | timestamptz | default now() |

**Table: `tech_fingerprints`**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid, nullable | |
| url | text | |
| web_server | text, nullable | |
| web_server_version | text, nullable | |
| language | text, nullable | |
| language_version | text, nullable | |
| cms | text, nullable | |
| cms_version | text, nullable | |
| cdn | text, nullable | |
| js_libraries | text[] | default '{}' |
| outdated_count | integer | default 0 |
| vulnerabilities_count | integer | default 0 |
| checked_at | timestamptz | default now() |

**Table: `phishing_domains`**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid, nullable | |
| organization_name | text | |
| original_domain | text | |
| lookalike_domain | text | |
| is_active | boolean | default false |
| ip_address | text, nullable | |
| has_website | boolean | default false |
| risk_level | text | default 'low' |
| first_detected | timestamptz | default now() |
| last_checked | timestamptz | default now() |
| is_acknowledged | boolean | default false |

RLS on all 3 tables: Authenticated SELECT, SuperAdmin/Analyst ALL, Auditor SELECT.

---

### 3. New Page: `src/pages/ThreatIntelligence.tsx`

A large tabbed page following the same patterns as EarlyWarning.tsx and DdosMonitor.tsx.

**Layout:**
1. Page header with Crosshair icon, "Threat Intelligence Center" title, "Run Full Scan" button
2. National Threat Level Banner (red/orange/yellow/green based on worst organization grade)
3. 5-tab layout using existing Tabs component:

**Tab 1: Security Scorecards**
- Grid of organization cards with circular score gauge (reusing CircularGauge component pattern)
- Score 0-100 calculated by pulling latest data from: uptime_logs, ssl_logs, ddos_risk_logs, early_warning_logs, tech_fingerprints
- Grade letters A+ through F with color coding
- Mini pass/fail icons for each category
- Filters: grade, sector. Sort: worst first (default)

**Tab 2: Global Threat Feed**
- Scrolling feed from CISA KEV, NVD, URLhaus
- Severity badges, CVE IDs, affected technology
- Yellow "AFFECTS OUR ORGS" highlight when matching detected tech stack
- Auto-refresh every 30 minutes

**Tab 3: Technology Stack Map**
- Table: Organization, Web Server, Version, Language, CMS, CDN, JS Libraries
- Red badges on outdated software
- Vulnerability count per org
- Click to expand full vulnerability details

**Tab 4: Phishing Domains**
- Table of detected lookalike domains with status, IP, risk level
- Red rows for active phishing sites
- Green banner if none found

**Tab 5: Data Breaches**
- Table of breach data per organization domain
- Red rows for recent breaches, yellow for older
- Green banner if none found

**State management:**
- Separate state for each section's results
- Client-side scheduling: threat feeds every 30min, fingerprinting every 12h, phishing/breach checks every 24h, scorecard recalculation every 1h
- "Run Full Scan" triggers all checks immediately

**Alert integration:**
- Critical/high findings inserted into existing `alerts` table with 24h de-duplication

**Mobile responsive:**
- Cards instead of tables on mobile
- Summary cards scroll horizontally
- Tabs remain accessible

---

### 4. Navigation Updates

**`src/components/layout/Sidebar.tsx`:**
- Add `Crosshair` to lucide-react imports
- Add nav item `{ to: '/threat-intelligence', icon: Crosshair, label: 'Threat Intel' }` between Early Warning and Reports

**`src/App.tsx`:**
- Import ThreatIntelligence component
- Add route `<Route path="/threat-intelligence" element={<ThreatIntelligence />} />` inside AppLayout routes

---

### 5. Config Update

Add to `supabase/config.toml`:
```text
[functions.fetch-threat-intel]
verify_jwt = false

[functions.fingerprint-tech]
verify_jwt = false

[functions.check-phishing-domains]
verify_jwt = false

[functions.check-breaches]
verify_jwt = false
```

---

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/fetch-threat-intel/index.ts` | Create |
| `supabase/functions/fingerprint-tech/index.ts` | Create |
| `supabase/functions/check-phishing-domains/index.ts` | Create |
| `supabase/functions/check-breaches/index.ts` | Create |
| `src/pages/ThreatIntelligence.tsx` | Create |
| `src/components/layout/Sidebar.tsx` | Edit (add nav item + Crosshair import) |
| `src/App.tsx` | Edit (add import + route) |
| Migration SQL | Create 3 tables + RLS policies |

---

### Technical Notes

- All API calls go through edge functions, never from the browser
- CISA KEV and NVD are fully free with no API key required
- URLhaus (abuse.ch) is free with no API key
- HIBP public breach list is free; full domain search requires paid API (noted in UI)
- AlienVault OTX requires a free API key -- skipped initially, can be added later via Settings
- Results are cached client-side and in the database to avoid hitting rate limits
- Errors in any check show "Check Failed" or "Pending" in gray, never crash
- Security scorecard pulls from ALL existing monitoring tables (uptime_logs, ssl_logs, ddos_risk_logs, early_warning_logs) plus the new tech_fingerprints table
- Existing pages, edge functions, and tables are NOT modified (except Sidebar and App.tsx for navigation)
- The page component will be large (~1200-1500 lines) following the same single-file pattern as EarlyWarning.tsx and DdosMonitor.tsx

