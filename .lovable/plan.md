## Route All Report Emails to Both Recipients

### Overview

Currently, all automated emails are sent only to `osmando@gmail.com`. This update adds `info@cyberdefense.so` as a second recipient across all email-sending edge functions.

**Note:** I'm assuming the intended address is `info@cyberdefense.so` (correcting the typo). Let me know if it should be different.

### Changes

**1. `supabase/functions/send-pentest-email/index.ts**`

- Change `PENTESTER_EMAIL` from a single string to an array of two emails: `["osmando@gmail.com", "info@cyberdefense.so"]`
- Update the three recipient-building blocks (scan_completed, critical_alert, report_delivery) to spread the array instead of pushing a single email

**2. `supabase/functions/send-contact-form/index.ts**`

- Update the `to` field from `["osmando@gmail.com"]` to `["osmando@gmail.com", "info@cyberdefense.so"]`

**3. `supabase/functions/scheduled-dast-scan/index.ts**`

- Update the `to` field from `["osmando@gmail.com"]` to `["osmando@gmail.com", "info@cyberdefense.so"]`

**4. `supabase/functions/send-dast-report/index.ts**`

- Update the default recipient fallback from `"osmando@gmail.com"` to include both emails in the `to` array

**5. `src/pages/DastScanner.tsx**`

- Update the default `recipientEmail` state from `"osmando@gmail.com"` to `"osmando@gmail.com"` (keep as-is since this is user-facing input; the backend functions above already ensure both addresses receive emails)

### Summary

Five files updated, all email delivery points now route to both `osmando@gmail.com` and `info@cyberdefense.so`.  
  
Please add email signature when sending emails from contact, or reports.  
**Cyber Defense Inc**  
Cyber Intelligence • Threat Monitoring • Digital Resilience

📧 [info@cyberdefense.so](mailto:info@cyberdefense.so)  
🌐 [www.cyberdefense.so](http://www.cyberdefense.so)  
🛡️ Protecting Digital Infrastructure Across Nations