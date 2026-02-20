

## Automated Background Scanning via pg_cron + Remove Lookalike Column

### Overview

Two changes: (1) Set up pg_cron scheduled jobs that invoke edge functions on a recurring basis so security checks run continuously without requiring the browser to be open. (2) Remove the "Lookalike" column from the phishing domains table on the Threat Intelligence page.

---

### 1. Enable pg_cron and pg_net Extensions

Run a migration to enable both extensions needed for scheduled HTTP calls from the database.

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

---

### 2. Create pg_cron Scheduled Jobs

Use the insert tool (not migration) since these contain project-specific URLs and keys. The jobs will call existing edge functions via `net.http_post`:

| Job | Edge Function | Schedule | Description |
|---|---|---|---|
| scheduled-security-scan | `scheduled-scan` | Every 6 hours | Runs all security checks (uptime, SSL, DDoS, headers, DNS, etc.) for all organizations via `run-security-checks` |
| scheduled-threat-intel | `fetch-threat-intel` | Every 30 minutes | Fetches CISA KEV, NVD, URLhaus threat feeds |
| scheduled-fingerprint | `fingerprint-tech` | Every 12 hours | Tech stack fingerprinting for all organizations |
| scheduled-phishing-check | `check-phishing-domains` | Every 24 hours | Typosquat/lookalike domain checks |
| scheduled-breach-check | `check-breaches` | Every 24 hours | Data breach monitoring |
| scheduled-defacement | `check-defacement` | Every 30 minutes | Website defacement detection |
| scheduled-dns-check | `check-dns` | Every 1 hour | DNS integrity monitoring |
| scheduled-blacklist | `check-blacklist` | Every 6 hours | Blacklist/reputation checks |
| scheduled-headers | `check-security-headers` | Every 6 hours | Security headers assessment |

Each job uses `net.http_post` to call the respective edge function with the service role key for authentication.

For functions that need per-org data (fingerprint, phishing, breaches, defacement, dns, blacklist, headers), the `scheduled-scan` function already handles iterating over all organizations. We will create a new comprehensive `scheduled-threat-intel-scan` edge function that orchestrates the threat intelligence checks (fingerprinting, phishing, breaches) across all organizations, similar to how `scheduled-scan` orchestrates `run-security-checks`.

---

### 3. New Edge Function: `scheduled-ti-scan`

A new edge function that iterates all organizations from `organizations_monitored` and calls:
- `fingerprint-tech` for each org
- `check-phishing-domains` for each org
- `check-breaches` for each org
- `check-defacement` for each org
- `check-dns` for each org
- `check-blacklist` for each org
- `check-security-headers` for each org

It processes organizations sequentially with small delays to avoid rate limiting. This function is called by pg_cron.

---

### 4. Simplified pg_cron Jobs (Final)

With the orchestrator function, we only need 3 pg_cron jobs:

| Job | Function | Schedule |
|---|---|---|
| scheduled-security-scan | `scheduled-scan` | `0 */6 * * *` (every 6 hours) |
| scheduled-threat-intel | `fetch-threat-intel` | `*/30 * * * *` (every 30 min) |
| scheduled-ti-scan | `scheduled-ti-scan` | `0 */6 * * *` (every 6 hours) |

---

### 5. Remove Lookalike Column from Phishing Table

**File:** `src/pages/ThreatIntelligence.tsx`

In the phishing tab table (around lines 917-936):
- Remove the `<TableHead>Lookalike</TableHead>` column header (line 921)
- Remove the `<TableCell>` that renders `d.domain` (line 932)

The data still shows in Organization, Original Domain, IP, Website status, and Risk columns -- the lookalike domain name is redundant since it is implied by context.

---

### Files Changed

| File | Action |
|---|---|
| Migration SQL | Enable pg_cron + pg_net extensions |
| SQL insert | Create cron.schedule jobs with project URL and anon key |
| `supabase/functions/scheduled-ti-scan/index.ts` | Create -- orchestrator for TI checks across all orgs |
| `src/pages/ThreatIntelligence.tsx` | Edit -- remove Lookalike column from phishing table |

### Technical Notes

- pg_cron runs inside the database and does not require the browser to be open
- `net.http_post` makes HTTP calls from within PostgreSQL to edge functions
- The anon key is used for authentication since the edge functions have `verify_jwt = false`
- The orchestrator function processes orgs sequentially to avoid overwhelming edge function concurrency limits
- Existing edge functions and pages are not modified (except removing the one column)

