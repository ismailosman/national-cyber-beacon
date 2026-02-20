

## Fix Threat Intelligence Accuracy and Real-Time Updates

### Overview

Fix 7 interrelated issues with the Threat Intelligence page: inaccurate scoring of pending checks, silent edge function failures, lack of scheduling, no real-time UI updates, missing URL verification, fragile edge functions, and no confidence indicator. Also create a `check_errors` logging table.

---

### 1. Database: `check_errors` Table

Create a new table to log all check failures for debugging:

| Column | Type |
|---|---|
| id | uuid PK, gen_random_uuid() |
| organization_id | uuid, nullable |
| organization_name | text |
| url | text |
| check_type | text |
| error_type | text (CONNECTION_TIMEOUT, DNS_FAILED, SSL_ERROR, CONNECTION_REFUSED, EDGE_FUNCTION_ERROR, RATE_LIMITED, UNKNOWN) |
| error_message | text |
| retry_count | integer, default 0 |
| checked_at | timestamptz, default now() |

RLS: Authenticated SELECT, SuperAdmin/Analyst ALL, Auditor SELECT. Auto-delete entries older than 7 days via a scheduled SQL or client-side cleanup.

---

### 2. Fix Score Calculation (Problem 1 + Problem 7)

**File:** `src/pages/ThreatIntelligence.tsx` -- `calculateScorecards` function

Current logic assigns 0 to checks without data. Change to:

- Track which checks have completed data vs pending
- Only sum points and max-possible for checks that have actual data
- Calculate percentage as `earnedPoints / completedMaxPoints * 100`
- Add to `OrgScorecard` type: `completedChecks: number; totalChecks: number; confidence: number`
- Display score as "X / Y (Z%)" with "N/10 checks completed"
- Grade display becomes "A (5/10 checks)"
- Confidence indicator: below 50% = yellow warning, 50-80% = blue "Partial", above 80% = green "High Confidence"

The `breakdown` object values will use `null` for pending instead of `0`.

---

### 3. Edge Function Timeout + Retry (Problem 2 + Problem 6)

**File:** `src/pages/ThreatIntelligence.tsx`

Create a helper function `invokeWithRetry(fnName, body, maxRetries=2)`:
- Wraps `supabase.functions.invoke()` with a 15-second timeout (AbortController)
- On failure, retries up to 2 more times with 5-second delay
- On final failure, logs to `check_errors` table and returns a structured error object
- Classifies errors: CONNECTION_TIMEOUT, DNS_FAILED, SSL_ERROR, CONNECTION_REFUSED, EDGE_FUNCTION_ERROR, RATE_LIMITED, UNKNOWN

**Edge Functions** (`fingerprint-tech`, `fetch-threat-intel`, `check-breaches`, `check-phishing-domains`, `check-security-headers`):
- Increase HTTP request timeout from 10s to 20s
- Add structured error response: `{ success: false, error: "CONNECTION_TIMEOUT", errorMessage: "...", url, checkedAt }`
- Classify fetch errors by message content (cert/ssl, DNS, timeout, refused)

Update the UI to show:
- "Check Failed" in orange with specific error type instead of "~" forever
- "Retry" button next to failed checks
- "X/Y checks succeeded" indicator at page top

---

### 4. Queue-Based Scanning with Progress (Problem 3)

**File:** `src/pages/ThreatIntelligence.tsx`

Replace `runFullScan` with a queue system:
- Process organizations one at a time with 2-second delay between each
- Show progress bar: "Scanning organizations... 5/35 complete"
- Track `scanProgress: { current: number; total: number; currentOrg: string }` state

Add client-side scheduling via `useEffect` with intervals:
- Threat feed: 30 minutes
- Tech fingerprinting: 12 hours
- Phishing domains: 24 hours
- Data breaches: 24 hours
- Scorecard recalculation: 1 hour

Use `useRef` for last-check timestamps to avoid re-renders. Stagger org checks within each interval.

---

### 5. Realtime UI Updates (Problem 4)

**File:** `src/pages/ThreatIntelligence.tsx`

Add Supabase Realtime subscriptions in a `useEffect`:
- Subscribe to `uptime_logs`, `ssl_logs`, `ddos_risk_logs`, `early_warning_logs`, `threat_intelligence_logs` tables
- On new INSERT, update the relevant organization's scorecard data
- Recalculate score live as new results arrive
- Add CSS transition/animation: brief green glow on score improvement, red glow on degradation
- Show "Last updated: X seconds ago" live counter per card (1-second tick interval)
- Show global "Last scan: X minutes ago" in the page header

Enable realtime on relevant tables via migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE uptime_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE ssl_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE ddos_risk_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE early_warning_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE threat_intelligence_logs;
```

---

### 6. URL Verification (Problem 5)

This is specifically about the Organizations page, not the Threat Intelligence page. However, since the prompt says "do NOT change existing pages", this will be handled minimally:

- On the Threat Intelligence page's scorecard cards, show URL status (reachable/unreachable) based on the latest uptime_logs data
- If an org's URL is failing all checks, show a yellow "URL may be incorrect" warning on the card
- Common Somali URL correction suggestions shown in a tooltip

---

### 7. Score Confidence Display (Problem 7)

Already covered in the scorecard fix (section 2). Add a small bar or badge next to each score:
- Below 50% confidence: yellow "Low Confidence -- more checks needed"
- 50-80%: blue "Partial -- some checks pending"
- Above 80%: green "High Confidence"

---

### Files Changed

| File | Action |
|---|---|
| Migration SQL | Create `check_errors` table + RLS + enable realtime on 5 tables |
| `src/pages/ThreatIntelligence.tsx` | Major edit -- fix scoring, add retry/queue/realtime/confidence/progress |
| `supabase/functions/fingerprint-tech/index.ts` | Edit -- increase timeout to 20s, structured error responses |
| `supabase/functions/fetch-threat-intel/index.ts` | Edit -- increase timeout to 20s, structured error responses |
| `supabase/functions/check-breaches/index.ts` | Edit -- increase timeout to 20s, structured error responses |
| `supabase/functions/check-phishing-domains/index.ts` | Edit -- increase timeout to 20s, structured error responses |
| `supabase/functions/check-security-headers/index.ts` | Edit -- increase timeout to 20s, structured error responses |

### Technical Notes

- No existing pages other than ThreatIntelligence.tsx are modified
- Realtime subscriptions are cleaned up on component unmount
- Queue processing stops if user navigates away (cleanup via ref)
- Edge function error classification uses string matching on error messages
- Progress bar uses existing UI components (Progress from radix)
- All intervals cleared on unmount to prevent memory leaks

