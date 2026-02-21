

## Replace Logo in Storage Bucket, Email, and PDF Reports

### What's Changing

Replace the current `logo.png` in the storage bucket with the new Somalia Cyber Defense logo (dark background with shield emblem and yellow/white text). Both the email template and PDF reports will use this new logo automatically since they already reference the storage URL.

### Steps

1. **Upload new logo to storage bucket**: Upload the user-provided image (`user-uploads://3843ECF6-...`) to the `media` storage bucket as `logo.png`, replacing the existing file.

2. **No code changes needed**: Both `logoUtils.ts` (PDF) and `send-dast-report/index.ts` (email) already point to `https://awdysfgjmhnqwsoyhbah.supabase.co/storage/v1/object/public/media/logo.png`, so they will automatically pick up the new image.

3. **Redeploy edge functions**: Redeploy `send-dast-report` and `generate-report` to clear any cached logo data.

### Files Changed

| File | Change |
|---|---|
| Storage: `media/logo.png` | Replace with new Somalia Cyber Defense logo |

No code or database changes required.

