

## Fix False Defacement Detection + Populate Threat Feed, Phishing & Breaches

### Overview

Two major fixes: (1) Overhaul defacement detection to eliminate false positives from legitimate websites like fisheries.gov.so and hormuud.com. (2) Ensure Threat Feed, Phishing, and Breaches tabs display real data from free public APIs.

---

### Part A: Fix False Defacement Detection

#### 1. Rewrite `check-defacement` Edge Function

**File:** `supabase/functions/check-defacement/index.ts`

Replace the current aggressive detection logic with a multi-indicator confirmation system:

**Keyword changes:**
- Replace the 16-keyword list (which includes generic terms like "anonymous", "security breach", "was here") with 18 high-confidence defacement phrases that require context (e.g., "hacked by ", "defaced by ", "you have been hacked")
- Match keywords only in visible page content -- strip `<script>`, `<style>`, `<meta>` tags before keyword search

**New HTML cleaning function:**
- Strip scripts, styles, comments, CSRF tokens, nonces, timestamps (unix and ISO), session IDs, cache-busting query strings, inline event handlers
- Normalize all whitespace before hashing
- This prevents dynamic content from causing false hash changes

**Multi-indicator confirmation (new):**
Instead of `isDefaced = keywords.length > 0 || (hashChanged && (titleChanged || sizeAnomaly))`, use a scoring system with 5 indicators:
1. Defacement phrase found in visible content (not in scripts/meta)
2. Page title does NOT contain expected org-related text
3. Page size under 5KB (defaced pages are tiny)
4. Missing normal HTML structure (no `<nav>`, `<footer>`, `<header>`)
5. Fewer than 3 internal links

Result classification:
- 0 indicators = "clean"
- 1 indicator = "review_needed" (yellow, not red)
- 2+ indicators = "defaced" (high confidence)

**Calibration period (new):**
Accept a `checkCount` parameter from the caller. On check 1 (no baseline), mark as "baseline_set". On checks 2-3, mark as "calibrating" and update baseline if structurally similar. From check 4+, start real comparison.

**Return enhanced data:**
```typescript
{
  url, currentHash, currentTitle, currentSize,
  hashChanged, titleChanged, sizeAnomaly,
  defacementKeywordsFound,
  indicators: { phraseFound, titleMismatch, smallPage, missingStructure, fewLinks },
  indicatorCount,
  status: "clean" | "baseline_set" | "calibrating" | "review_needed" | "defaced" | "error",
  internalLinkCount, hasNormalStructure,
  checkedAt
}
```

#### 2. Update Frontend Defacement Handling

**File:** `src/pages/ThreatIntelligence.tsx` -- `runDefacementCheck` function

- Track check count per org by querying existing `early_warning_logs` with `check_type = 'defacement'` before calling the edge function
- Pass `checkCount` to the edge function for each URL
- Map the new `status` field to risk levels:
  - "clean" / "baseline_set" / "calibrating" = 'safe'
  - "review_needed" = 'warning'
  - "defaced" = 'critical'
- Only generate alerts for "defaced" status (2+ indicators), not "review_needed"
- Only update baseline on first 3 checks or when user manually resets
- Store enhanced details (indicators, internalLinkCount, etc.) in the `early_warning_logs.details` column

#### 3. UI Status Display

In the scorecard detail modal, show defacement status with the new categories:
- "Clean" (green check)
- "Baseline Set" (blue)
- "Calibrating" (blue)
- "Content Changed" (yellow) -- hash changed but no defacement phrases
- "Review Needed" (yellow) -- 1 indicator
- "DEFACED" (red pulsing) -- 2+ indicators
- "Check Failed" (gray)

Add a "Details" expandable section showing which indicators triggered and the surrounding text context for any matched phrases.

Add "Mark as Clean" and "Reset Baseline" actions per organization (upserts to `baselines` table and inserts a new `early_warning_logs` entry with 'safe' status).

---

### Part B: Populate Threat Feed, Phishing & Breaches

#### 4. Fix `fetch-threat-intel` Edge Function

**File:** `supabase/functions/fetch-threat-intel/index.ts`

The function already exists and fetches CISA KEV, URLhaus, and NVD data. Issues to fix:
- URLhaus endpoint uses POST which may be less reliable -- add fallback to GET endpoint `https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/`
- Add Feodo Tracker as a third source: `https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json`
- Increase timeout to 20s
- Return combined `threats` array alongside the existing separate fields for backward compatibility

The frontend already renders CISA KEV, NVD CVEs, and URLhaus in the Threat Feed tab. Add Feodo Tracker rendering in a new card section.

Add a "Feodo Tracker" filter option to the threat filter dropdown.

#### 5. Fix `check-phishing-domains` Edge Function

**File:** `supabase/functions/check-phishing-domains/index.ts`

The function already exists and works. No changes needed to the edge function itself -- it already generates typosquat variations and checks DNS via Google DNS API.

The frontend already calls it and renders results. The only issue is if the edge function times out for large org lists. Already handled by `invokeWithRetry` with 2 retries.

No changes needed here -- this tab should already populate after a full scan.

#### 6. Fix `check-breaches` Edge Function

**File:** `supabase/functions/check-breaches/index.ts`

The function already exists and fetches the HIBP breach catalog. Issues to fix:
- Cross-reference breaches with detected tech stacks from `tech_fingerprints` table
- The current matching logic is too broad (matches on partial domain substrings). Improve to match on exact service names
- Add the `relevantServices` list for better matching
- Split the response into "relevant breaches" (matching org tech) and "global breaches" for the two-section UI

Update the Breaches tab UI to show two sections:
- Section A: "Breaches Affecting Our Organizations" -- filtered by tech stack match
- Section B: "Recent Global Breaches" -- all significant recent breaches

#### 7. Frontend: Threat Feed Tab Enhancements

- Add Feodo Tracker card rendering
- Add "Feodo" to the filter dropdown
- Add "Affects Our Organizations" filter option that checks CISA KEV vendor/product against `tech_fingerprints`
- Add search box for filtering threats
- Show "Last updated" timestamp from `threatFeed.fetchedAt`
- Add "Refresh" button that calls `fetchThreatFeed()` independently

#### 8. Frontend: Breaches Tab Enhancements

- Add two-section layout (relevant + global)
- Show "Recommend password reset" action for relevant breaches
- Add note about HIBP API key for domain-specific searches
- Show "Last updated" timestamp
- Add yellow "Relevant" badge for breaches matching org tech

---

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/check-defacement/index.ts` | Major rewrite -- multi-indicator detection, calibration, better cleaning |
| `supabase/functions/fetch-threat-intel/index.ts` | Edit -- add Feodo Tracker, URLhaus fallback, better error handling |
| `supabase/functions/check-breaches/index.ts` | Edit -- improve matching, add relevant/global split |
| `src/pages/ThreatIntelligence.tsx` | Major edit -- defacement UI, threat feed enhancements, breaches two-section layout, mark as clean / reset baseline actions |

### Technical Notes

- No database schema changes needed -- all existing tables suffice
- The `baselines` table already has `content_hash`, `page_title`, `page_size`, and `dns_records` columns
- Defacement check count is derived from existing `early_warning_logs` entries (count where check_type = 'defacement' and organization_id = X)
- The "Mark as Clean" action upserts baseline and inserts a new early_warning_logs entry
- Edge functions are deployed automatically after code changes
- All free APIs used require NO API keys
- Existing working checks (Uptime, SSL, DDoS, Headers, DNS, Ports, Email, Blacklist) are not modified

