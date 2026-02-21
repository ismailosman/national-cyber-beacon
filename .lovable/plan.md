

## Fix: Blank PDF on Mobile Devices

### Root Cause

Both `generate-report/index.ts` and `send-dast-report/index.ts` produce PDFs with **invalid cross-reference (xref) tables**. The xref table tells a PDF reader where each object starts in the file. Currently, both functions write placeholder offsets (`i * 100`) instead of real byte positions:

```
// Current (broken):
for (let i = 0; i < totalObjects; i++) {
  pdf += `${String(i * 100).padStart(10, '0')} 00000 n \n`;
}
```

Desktop PDF viewers (Chrome, Adobe) are forgiving and rebuild the xref from scratch, so the PDF renders fine. Mobile PDF viewers (iOS Mail, Android viewers) strictly follow the PDF spec and fail to locate objects, resulting in **blank pages**.

### Fix

Replace the fake xref generation in both edge functions with code that tracks the actual byte offset of each object as the PDF string is built, then writes those real offsets into the xref table.

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/generate-report/index.ts` | Fix xref table to use real byte offsets |
| `supabase/functions/send-dast-report/index.ts` | Fix xref table to use real byte offsets |

### Technical Approach

For both files, the PDF assembly section (starting around the "Build multi-page PDF" comment) will be refactored to:

1. Track byte offsets in an array as each object is appended
2. Use a helper function that records the current byte length before writing each `N 0 obj` line
3. Write the xref table using the recorded real offsets
4. Keep the first xref entry as `0000000000 65535 f` (free entry, per PDF spec)

The change is isolated to the final PDF assembly block in each function -- no changes to content generation, data fetching, or any other logic.

### Expected Result

- PDFs will have valid xref tables conforming to the PDF 1.4 specification
- Mobile PDF viewers (iOS Mail, Safari, Android) will correctly render all pages
- Desktop behavior remains unchanged

