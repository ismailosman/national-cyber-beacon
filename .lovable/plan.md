

## Integrate HIBP API Key for Email-Pattern Breach Detection

### Overview

Upgrade the breach detection system from domain-level matching to email-pattern searching using the HIBP `breachedaccount` API endpoint. This checks 15 common email patterns (info@, admin@, contact@, etc.) per organization for a much more accurate breach picture.

### Changes

**1. Rewrite Edge Function `supabase/functions/check-breaches/index.ts`**

Replace the current domain-level HIBP search with email-pattern search:

- When `HIBP_API_KEY` is present: iterate through 15 common email prefixes (info, admin, contact, support, webmaster, security, hr, office, mail, hello, general, enquiry, communications, media, press) and call `https://haveibeenpwned.com/api/v3/breachedaccount/{email}?truncateResponse=false` for each
- Track which specific emails were found in which breaches (e.g., "admin@domain.so found in LinkedIn breach")
- Wait 1.5 seconds between each email check (HIBP rate limit compliance)
- Handle 429 (rate limited) by reading `retry-after` header and waiting
- Handle 401 (invalid key) gracefully with clear error message
- Filter out spam lists (`isSpamList`) and retired breaches (`isRetired`)
- Deduplicate breaches by name across all email checks
- Return `breachedEmails` array and `affectedEmails` per breach
- When no API key: fall back to existing free exact-domain matching (HIBP catalog + Mozilla Monitor)

**2. Create `breach_check_results` Database Table**

New table for caching breach results with upsert support:

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| organization_id | uuid | UNIQUE for upsert |
| organization_name | text | |
| domain | text | |
| breach_count | integer | default 0 |
| breaches | jsonb | array of breach objects |
| breached_emails | text[] | which emails were found |
| is_clean | boolean | nullable |
| error | text | nullable |
| source | text | default '' |
| checked_at | timestamptz | default now() |

RLS policies matching existing pattern (SuperAdmin full, Analyst full, Auditor read, authenticated read).

**3. Update Frontend `src/pages/ThreatIntelligence.tsx` -- Breach Check Logic**

- Update `runBreachCheck` to:
  - Wait 3 seconds between organizations (each org takes ~23s internally)
  - Show detailed progress: "Checking Organization 3/17: Hormuud Telecom"
  - Save results to `breach_check_results` table via upsert (on conflict organization_id)
  - Load cached results from `breach_check_results` on mount (instead of `threat_intelligence_logs`)
- Update `BreachResult` interface to include `breachedEmails`, `checkedEmails`, `source`, `method`

**4. Redesign Breaches Tab UI**

- Add "Affected Emails" column to the organization table
- Show `breachedEmails` count per org
- Enhance the Breach Detail Dialog to show:
  - Which specific email addresses were found in breaches
  - Per-breach list of affected emails
  - Color-coded data class chips (red for passwords/financial, orange for phones/addresses, yellow for emails/IPs, gray for names)
  - Auto-generated recommendations based on leaked data types (already partially implemented -- enhance with more categories)
- Show API method indicator: "HIBP Email Pattern Search" vs "Free Breach Check"
- If HIBP key configured, remove the yellow "add API key" banner

**5. Add HIBP API Key to Cloud Secrets**

Use the secrets tool to prompt the user to add `HIBP_API_KEY` as a Cloud secret. The edge function already reads `Deno.env.get('HIBP_API_KEY')`.

### Rate Limit Considerations

- HIBP Pwned 1 plan: 10 requests/minute
- 15 emails per org with 1.5s delay = ~23 seconds per org
- 17 organizations = ~6.5 minutes for a full scan
- 3-second delay between orgs on the frontend side
- Total full scan: approximately 7 minutes

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/check-breaches/index.ts` | Rewrite: email-pattern search with HIBP API, free fallback |
| `src/pages/ThreatIntelligence.tsx` | Update breach logic, cache to new table, enhanced UI |
| Database migration | Create `breach_check_results` table with RLS |

