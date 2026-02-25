

## Fix: Grade Consistency Between Email and PDF

### Problem
There are **3 different scoring formulas** across the codebase, causing grades to mismatch:

| Location | Formula | Example Score |
|---|---|---|
| DastScanner.tsx (email source) | critical x 15 + high x 8 | Higher scores |
| ScanReportCharts.tsx (report page) | critical x 25 + high x 10 + nikto x 2 | Lower scores |
| generate-scan-report (PDF) | critical x 25 + high x 10 + nikto x 2 | Lower scores |

When the DAST scanner sends its score to the email function, it uses lighter weights (15/8), producing a higher score than what the report page and PDF compute (25/10). This means the email says "Grade B" while the report page might say "Grade C".

### Solution
Align all scoring to one formula: **critical x 25, high x 10, medium x 3, low x 1, nikto x 2** (the standard model already used by the report page and PDF generator).

### Changes

**File 1: `src/pages/DastScanner.tsx`** (line 177)

Change the DAST score formula from:
```
100 - (critical * 15 + high * 8 + medium * 3 + low * 1)
```
to:
```
100 - (critical * 25 + high * 10 + medium * 3 + low * 1)
```

This ensures the score sent to `send-dast-report` for email and PDF matches the score shown on the report page and in the main PDF generator.

**File 2: `supabase/functions/send-dast-report/index.ts`**

Fix the grade box in the PDF to properly fit the "Grade" text. The current Risk Level box at coordinates (470, 726) with size 90x40 clips the text. Widen it slightly and adjust text placement so "RISK LEVEL" and the label (e.g., "Medium") render cleanly without overlap.

### Result
- DAST email body grade = PDF attachment grade = Report page grade
- All three use the same 25/10/3/1 deduction model
- Grade box in PDF renders cleanly

