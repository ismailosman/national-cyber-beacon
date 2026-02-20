

## Fix: DAST Score Always 0/F and Emails Never Sending

### Root Cause Analysis

**Bug 1: Score always 0 (Grade F)**
The scoring formula `100 - (critical*25 + high*15 + medium*5 + low*2)` was designed when there were only 6 test modules. Now with 14 modules, a typical site generates many more findings. For example:
- Ministry of Fishery: 6 critical + 5 high + 10 medium + 10 low = 295 penalty points (capped at 0)
- Hormuud: 1 critical + 3 high + 6 medium + 6 low = 112 penalty points (capped at 0)

Even modest findings across 14 tests blow past 100 immediately.

**Fix**: Switch to a percentage-based scoring model. Calculate what percentage of total findings passed vs failed, with severity weighting. Formula: `score = 100 * weighted_pass / (weighted_pass + weighted_fail)` where critical failures have 5x weight, high 3x, medium 2x, low 1x. This scales naturally regardless of how many test modules exist.

**Bug 2: Emails never sent**
The `send-dast-report` function has zero logs -- it is never called. The email-sending code at line 186-209 uses `cachedResults` from a stale React closure. When `loadCachedResults()` runs at line 180 it updates React state asynchronously, but the `runScan` callback still holds the OLD `cachedResults` value. For first-time scans or new orgs, `cachedResults` is empty, so `scanData` is `undefined` and the `if (scanData)` check silently skips the email.

**Fix**: Instead of looking up stale cached results, collect the scan data (score, summary, results) during the scan loop and pass it directly to `send-dast-report`.

---

### Changes

#### 1. `src/pages/DastScanner.tsx`

- **Fix scoring formula** (line 170): Replace with a weighted percentage model:
  ```
  weighted_fail = critical*5 + high*3 + medium*2 + low*1
  weighted_pass = passed*1
  score = round(100 * weighted_pass / (weighted_pass + weighted_fail))
  ```
  If there are no findings at all, score defaults to 100.

- **Fix email sending** (lines 185-209): Collect each org's scan data into a local array during the scan loop, then iterate over that array (not `cachedResults`) to call `send-dast-report`. This eliminates the stale closure bug entirely.

- **Remove `cachedResults` from `runScan` dependency** (line 210): It's no longer needed in the callback closure.

#### 2. `supabase/functions/send-dast-report/index.ts`

- **Update the PDF grade display** to use the same scoring formula for consistency (the `getGrade` function is already correct, it just needs to receive the correct score).

#### 3. `supabase/functions/scheduled-dast-scan/index.ts`

- **Update the scoring formula** there too for consistency with the frontend calculation.

---

### Technical Details

| File | Lines | Change |
|---|---|---|
| `src/pages/DastScanner.tsx` | 170 | Replace scoring formula with weighted percentage |
| `src/pages/DastScanner.tsx` | 185-210 | Collect scan data in local variable during loop; pass directly to send-dast-report instead of reading stale cachedResults |
| `supabase/functions/scheduled-dast-scan/index.ts` | scoring section | Same weighted percentage formula |

No database changes needed. No new files.

