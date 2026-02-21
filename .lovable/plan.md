

## Fix Broken Logo in Email and PDF Reports

### Problem

The logo URL `https://national-cyber-beacon.lovable.app/logo.png` is served by the SPA router, which returns `index.html` instead of the actual PNG file. This causes:
- The email `<img>` tag to show a broken image
- The PDF PNG parser to fail silently (it tries to parse HTML as PNG), so no logo appears in the PDF

### Solution

Upload `logo.png` to the project's public `media` storage bucket, which serves files directly. Then update both references to use the storage URL.

The new URL will be:
`https://awdysfgjmhnqwsoyhbah.supabase.co/storage/v1/object/public/media/logo.png`

### Changes

| File | Change |
|---|---|
| Storage: `media` bucket | Upload `src/assets/logo.png` as `logo.png` |
| `supabase/functions/_shared/logoUtils.ts` | Change `LOGO_URL` from the broken app URL to the storage bucket URL |
| `supabase/functions/send-dast-report/index.ts` | Change the email `logoUrl` variable (line 320) to the storage bucket URL |

### Technical Details

1. **Upload logo to storage**: Read the binary content of `src/assets/logo.png` and upload it to the `media` bucket. The bucket is already public, so no RLS changes needed.

2. **Update `logoUtils.ts` line 4**: Change `LOGO_URL` to `https://awdysfgjmhnqwsoyhbah.supabase.co/storage/v1/object/public/media/logo.png`

3. **Update `send-dast-report/index.ts` line 320**: Change `logoUrl` to the same storage URL

4. **Redeploy both edge functions** (`send-dast-report` and `generate-report`) so they pick up the new shared utility URL

No database migrations needed. No other files affected.

