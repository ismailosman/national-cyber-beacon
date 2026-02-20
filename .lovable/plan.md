

## Plan: Scheduled DAST Scans + Per-Organization Scanning + Critical Alerts

### Overview
Add a backend function that runs weekly DAST scans for all organizations, compares results with previous scans, and creates alerts for new critical/high findings. Also improve the UI to support scanning one organization at a time more clearly.

---

### Changes

#### 1. New Edge Function: `scheduled-dast-scan`

A new backend function that:
- Fetches all organizations from the database
- For each organization, calls all 6 DAST test functions sequentially (with delays)
- Calculates the DAST score and summary
- Loads the previous scan results and compares findings -- identifies **new** critical/high findings that weren't in the last scan
- Upserts results to `dast_scan_results`
- Creates alerts in the `alerts` table for any new critical or high findings (e.g., "DAST: Critical finding on Ministry of Finance -- Exposed .env file")
- Processes organizations one at a time with a 5-second delay between them to avoid overwhelming targets

The function accepts an optional `org_id` parameter. If provided, it scans only that single organization. If omitted, it scans all organizations.

#### 2. Weekly Cron Job

Set up a `pg_cron` schedule to invoke `scheduled-dast-scan` every Sunday at 2:00 AM UTC. This uses the same pattern as the existing `scheduled-scan` function -- calling via `net.http_post`.

#### 3. UI Updates to `src/pages/DastScanner.tsx`

- **Per-org scan button**: Each organization card in the "Organization Scores" grid gets a small "Scan" button so users can trigger a scan for that specific org without changing the dropdown
- **Last scheduled scan indicator**: Show when the last automated scan ran (query the most recent `scanned_at` across all `dast_scan_results`)
- **New findings badge**: When viewing an org's results, highlight findings that are new since the previous scan (compare current results with previously cached results timestamp)
- **Schedule info banner**: Small info card showing "Automated scans run weekly (Sundays 2:00 AM UTC)" with the count of organizations being monitored

#### 4. Config Updates

- Add `[functions.scheduled-dast-scan]` with `verify_jwt = false` to `supabase/config.toml` (handled automatically)

---

### Technical Details

| File | Action |
|---|---|
| `supabase/functions/scheduled-dast-scan/index.ts` | New edge function -- orchestrates DAST scans for all or single org, compares with previous results, creates alerts for new critical/high findings |
| `src/pages/DastScanner.tsx` | Add per-org scan buttons on org cards, schedule info banner, new findings indicators |
| Database (via insert tool) | Add `pg_cron` job for weekly execution |

**Alert creation logic:**
- Before upserting new results, load the existing `dast_scan_results` for that org
- Extract all `fail` finding IDs from the old scan
- Compare with new `fail` finding IDs
- For each new critical/high finding not in the old set, insert an alert with:
  - `title`: "DAST: [finding title] on [org name]"
  - `severity`: matching the finding severity
  - `source`: "dast-scanner"
  - `organization_id`: the org's ID
  - `description`: the finding detail + recommendation

**Per-org scan from UI:**
- The existing `runScan` function already supports scanning a single org
- Add a small play button on each org card that calls `runScan([org])` directly
- Also support invoking the backend `scheduled-dast-scan` with `{ org_id }` for server-side execution (more reliable for long scans)
