

## Fix PDF Report Layout Overlap

### Problem
The Scanner Breakdown table on Page 1 shows only ~2.5 rows before the Server Information section's background rectangle overlaps and covers the remaining rows. This happens because after rendering 4 scanner rows (each 18px), the gap before the next section is only 8px, causing the Server Information background rectangle to paint over the bottom scanner rows.

### Root Cause (Line-by-line trace)
The scanner breakdown renders 4 rows at 18px spacing. After the loop, `sy` is around 508. Then only 8px gap is added before Server Information. The Server Information background rectangle (`serverInfo.length * 16 + 8` = 72px tall) extends upward and overlaps the last scanner rows.

### Fix

**File: `supabase/functions/generate-scan-report/index.ts`**

1. **Increase gap between Scanner Breakdown and Server Information** (line 376): Change `sy -= 8` to `sy -= 20` to add proper clearance between the two sections.

2. **Add a guard to ensure the scanner table fully renders before Server Info**: Move the Server Info section's Y start calculation to account for the full scanner table height, so even if future scanners are added, it won't overlap.

3. **Reduce the Top Findings section start gap if needed** to compensate for the extra spacing above, keeping all content fitting on page 1.

### Technical Details

The single change is on line 376:

```text
Before: sy -= 8;   (line 376, before SERVER INFORMATION title)
After:  sy -= 20;   (gives 12px more clearance)
```

This ensures the Server Information background rectangle (drawn at `sy - 4` with height `serverInfo.length * 16 + 8`) starts well below the last scanner row, preventing any overlap.

### Files Modified
- `supabase/functions/generate-scan-report/index.ts` -- Increase section gap to prevent overlap

