

## Add Logo to PDF Reports and Redesign Email Template

### What's Changing

1. **Logo in all PDF reports** -- The Somalia Cyber Defense logo will appear in the header bar of every page in both the DAST report and the general security report PDFs
2. **Logo in email** -- The logo will appear at the top of the DAST report email
3. **Email redesign** -- Switch from dark/black background to a clean white background matching the reference design

---

### Implementation Details

#### 1. Copy logo to `public/logo.png`

Place the logo in the `public/` folder so it's served at a stable URL without Vite's content hash (`/logo.png` instead of `/assets/logo-C103sdBq.png`). This gives edge functions a reliable URL to fetch from: `https://national-cyber-beacon.lovable.app/logo.png`.

#### 2. Create shared PNG parser: `supabase/functions/_shared/logoUtils.ts`

A utility module that both report edge functions import. It will:
- Fetch the logo PNG from the published app URL
- Parse the PNG binary format (read IHDR chunk for width/height, extract IDAT chunks)
- Decompress the pixel data and extract RGB values (compositing any alpha onto white)
- Return `{ width, height, rgbBytes }` for embedding as a PDF Image XObject
- Gracefully return `null` if the fetch fails (reports still generate without logo)

#### 3. Update `supabase/functions/send-dast-report/index.ts`

**PDF changes:**
- Import the logo utility
- Add an Image XObject (object 5) containing the logo's RGB pixel data
- Update object numbering: fonts at obj 3-4, logo at obj 5, pages start at obj 6
- Add `/XObject << /Logo 5 0 R >>` to each page's resource dictionary
- Render the logo in each header bar using `q 36 0 0 36 32 798 cm /Logo Do Q` (36x36pt)
- Shift branding text right by ~42pt to accommodate the logo

**Email HTML changes:**
- Replace dark `#0d1520` background with white `#ffffff`
- Add logo `<img>` tag in the header referencing the published URL
- Navy header bar with white text and red accent (matching reference)
- Light gray `#f8fafc` card backgrounds with dark text for info sections
- Clean severity count table with white background and colored numbers
- Professional footer with subtle border

#### 4. Update `supabase/functions/generate-report/index.ts`

Same PDF logo embedding approach:
- Import logo utility
- Add Image XObject for the logo
- Render 36x36pt logo in each page's header bar
- Shift header text right to accommodate
- Update object numbering

---

### Files Changed

| File | Change |
|---|---|
| `public/logo.png` | New -- copy of `src/assets/logo.png` for stable URL |
| `supabase/functions/_shared/logoUtils.ts` | New -- PNG fetch/parse utility for PDF embedding |
| `supabase/functions/send-dast-report/index.ts` | Add logo to PDF headers, redesign email HTML to white background with logo |
| `supabase/functions/generate-report/index.ts` | Add logo to PDF headers |

No database changes needed.

