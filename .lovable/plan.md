

## Fix DAST Content Security False Positives and Scoring

### Problems Identified

1. **Content Security severity too aggressive**: Missing CSP header and missing X-Frame-Options are flagged as "high" severity. For most websites (especially government CMS sites), these are common configurations and should be "medium" -- they are recommendations, not active vulnerabilities.

2. **Module status badge incorrectly shows "Critical"**: The `getTestStatus` function treats any "high" finding the same as "critical", causing the Content Security module to display a red "Critical" badge when it only has "high" findings. This is misleading.

3. **Scoring formula still too punitive**: The current weighted-ratio formula (passes vs weighted fails) produces a score of 48 for a site with 16 passes, 0 critical, 2 high, 7 medium, 5 low findings. A deduction-based model (start at 100, subtract for failures) is more intuitive and industry-standard.

---

### Changes

#### 1. `supabase/functions/dast-content-security/index.ts` -- Downgrade Severities

- Change "Content-Security-Policy Missing" from **high** to **medium** (CSP is best practice, not a critical gap)
- Change "Clickjacking Protection Missing" from **high** to **medium** (most CMS frameworks handle this at the application level)
- Keep CSP Wildcard as "high" (actively dangerous misconfiguration)
- Keep all other findings at their current levels

#### 2. `src/pages/DastScanner.tsx` -- Fix Module Status and Scoring

**Fix `getTestStatus`**: Separate "high" from "critical" in the status display:
- Critical findings -> red "Critical" badge
- High findings -> orange "High" badge  
- Medium findings -> yellow "Issues" badge
- All pass -> green "Clean" badge

**Fix scoring formula**: Switch to a deduction-based model that starts at 100 and subtracts based on severity:
- Score = max(0, 100 - (critical x 25 + high x 10 + medium x 3 + low x 1))
- This produces more reasonable scores: the fisheries.gov.so example (0 critical, 2 high, 7 medium, 5 low) would score 100 - (0 + 20 + 21 + 5) = 54 instead of 48, but more importantly scales better

Actually, using the memory: `Score = Max(0, 100 - (Critical * 25 + High * 15 + Medium * 5 + Low * 2))` -- this was the original intended formula. Let me restore this deduction model.

With the content security downgrade (2 high -> 0 high, 2 more medium): 0 critical, 0 high, 9 medium, 5 low = 100 - (0 + 0 + 45 + 10) = 45. That's still low.

Better approach: use smaller deductions since 14 modules means many findings are expected:
- Score = max(0, 100 - (critical x 15 + high x 8 + medium x 3 + low x 1))

For the fisheries example after fix (0 critical, 0 high, 9 medium, 5 low): 100 - (0 + 0 + 27 + 5) = 68 = Grade C. More reasonable.

#### 3. `supabase/functions/scheduled-dast-scan/index.ts` -- Same scoring formula update

Apply the same deduction-based scoring to the scheduled scan function for consistency.

---

### Summary

| File | Change |
|---|---|
| `supabase/functions/dast-content-security/index.ts` | Downgrade CSP missing and clickjacking missing from "high" to "medium" |
| `src/pages/DastScanner.tsx` | Fix `getTestStatus` to separate high from critical; switch to deduction-based scoring formula |
| `supabase/functions/scheduled-dast-scan/index.ts` | Same scoring formula update |

No database changes needed.

