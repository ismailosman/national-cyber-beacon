

## Replace Logo in Storage for All Reports and Emails

### Overview
Copy the uploaded eagle/shield logo into the project assets and upload it to the `media` storage bucket as `logo.png`, replacing the existing file. Since `logoUtils.ts` and all email templates already reference `media/logo.png`, every PDF report and email will automatically use the new logo with no code changes.

### Steps

**1. Copy logo to project assets**
- Copy `user-uploads://54C06AED-8924-4829-ADC2-B3AB0FC82053.png` to `src/assets/logo.png` (replacing existing)
- Copy to `public/logo.png` (replacing existing)

**2. Create a one-time upload edge function**
- Create `supabase/functions/upload-logo/index.ts` -- a simple utility that reads the logo from the project's public URL and uploads it to the `media` storage bucket as `logo.png` using the service role key
- Call this function once to push the new logo to storage
- Delete the function after confirming it works

**3. No other code changes needed**
- `_shared/logoUtils.ts` already fetches from `media/logo.png` -- PDFs will automatically use the new logo
- Email templates in `send-pentest-email` and `send-dast-report` reference the same storage URL -- emails will automatically show the new logo
- Landing page, login, and dashboard components import from `src/assets/logo.png` -- they will also update automatically

### Files
- `src/assets/logo.png` -- replaced with new eagle/shield logo
- `public/logo.png` -- replaced with new eagle/shield logo
- `supabase/functions/upload-logo/index.ts` -- temporary upload utility (created then deleted)

