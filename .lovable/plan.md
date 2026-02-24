

## Fix PDF Report Layout and Keep Header/Footer Dark in Light Mode

### Problems Identified

**PDF Report Issues:**
1. **Scanner Breakdown table is cut off on Page 1** -- Only 2.5 rows visible (Nikto, Nuclei, partial Semgrep). The SERVER INFORMATION section overlaps the bottom of the breakdown table because the Y coordinate continues downward without checking if the breakdown finished rendering.
2. **HTML tags in descriptions** -- ZAP descriptions contain raw HTML like `<p>Content Security Policy...` and `</p>`. These need to be stripped before rendering in the PDF.
3. **"INFORMATIONAL" severity label truncated** -- The severity badge is 55px wide, but "INFORMATIONAL" text overflows, showing as "INFORMATIONA". Need to abbreviate to "INFO" for display.
4. **Wasted space on detailed findings pages** -- Pages 3-6 only show 6 findings per page with large card heights (90px each), leaving massive blank areas on many pages. Should fit more findings per page.

**Landing Page Issue:**
5. **Header and Footer turn light in light mode** -- The Navbar and Footer use CSS variables (`--landing-nav-bg`, `--landing-card`) that change to white in light mode. User wants them to always stay dark regardless of theme.

### Changes

**1. `supabase/functions/generate-scan-report/index.ts` -- Fix PDF layout**

- **Strip HTML tags**: Update the `s()` sanitizer function to also strip HTML tags (`<p>`, `</p>`, `<br>`, etc.) from text before rendering.
- **Fix severity label**: Map "INFORMATIONAL" to "INFO" in the severity badge text to prevent truncation.
- **Increase findings per page**: Change `findingsPerPage` from 6 to 8 and reduce card height from 90px to 70px to better utilize page space.
- **Fix Scanner Breakdown overlap**: The table and server info render correctly based on the Y tracking, but the issue is the alternating row background rectangles. Ensure proper spacing so the last scanner row doesn't get clipped.

**2. `src/components/landing/Navbar.tsx` -- Always dark header**

- Replace `bg-[hsl(var(--landing-nav-bg))]` with hardcoded dark background: `bg-gray-950` (or the dark navy `bg-[#0d1117]`).
- Replace text color variables with fixed light text colors for nav items.
- Keep the theme toggle functional but make the header itself always dark.

**3. `src/components/landing/Footer.tsx` -- Always dark footer**

- Replace `bg-[hsl(var(--landing-card))]` with hardcoded dark background.
- Replace text/border color variables with fixed dark-theme colors.
- Ensure all text remains light-colored regardless of theme.

### Technical Details

```text
PDF text sanitizer update:
  function s(text, maxLen):
    - Strip HTML tags: .replace(/<[^>]*>/g, '')
    - Then existing sanitization

Severity label fix:
  - In detailed findings, map severity for badge display:
    "INFORMATIONAL" -> "INFO"

Findings per page:
  - findingsPerPage: 6 -> 8
  - Card height: 90px -> 70px
  - Description truncation stays at 90 chars

Navbar always-dark:
  - bg-gray-950 (fixed, not theme-variable)
  - Text: text-gray-400 hover:text-white
  - Border: border-gray-800
  - Mobile menu: same dark treatment

Footer always-dark:
  - bg-gray-950 text-gray-400
  - Headings: text-white
  - Border: border-gray-800
  - Links: hover:text-white
```

### Files Modified
- `supabase/functions/generate-scan-report/index.ts` -- Strip HTML tags, fix severity labels, increase density
- `src/components/landing/Navbar.tsx` -- Hardcode dark background/text colors
- `src/components/landing/Footer.tsx` -- Hardcode dark background/text colors

