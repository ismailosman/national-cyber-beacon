

## Fix: Email Notifications Using Wrong Domain

### Problem
The `send-pentest-email` function defaults to sending from `security@cybersomalia.com`, but this domain is **not verified** in Resend. The Resend API rejects every email with a 403 error:

> "The cybersomalia.com domain is not verified"

All other email functions in the project correctly use `noreply@cyberdefense.so`, which is verified.

### Changes

**`supabase/functions/send-pentest-email/index.ts` (lines 3-5)**

Update the three constants:

- `FROM_EMAIL`: Change default from `security@cybersomalia.com` to `noreply@cyberdefense.so` (matching all other functions)
- `PENTESTER_EMAIL`: Change default from `admin@cybersomalia.com` to `osmando@gmail.com` (matching the configured admin email)
- Also update the `from` field in `sendEmail()` to use a display name format: `"CyberDefense Security <noreply@cyberdefense.so>"` for consistency with the contact form

### Technical Details

Only 2 lines need to change in the edge function:

```text
Line 4: FROM_EMAIL default  ->  "CyberDefense Security <noreply@cyberdefense.so>"
Line 5: PENTESTER_EMAIL default  ->  "osmando@gmail.com"
```

No frontend changes needed. After deploying, the existing email trigger logic in `SecurityDashboard.tsx` will work correctly since the Resend API will accept the verified domain.
