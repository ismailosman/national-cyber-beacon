

## Make /cyber-map the Main Landing Page with Turnstile CAPTCHA

### What Changes

The root route (`/`) will show the Turnstile CAPTCHA verification gate, and once verified, display the Cyber Attack Map (instead of the current Landing page). The existing Landing page moves to `/public`.

### Changes Required

**1. Update `src/pages/TurnstileGate.tsx`**
- Change the post-verification component from `<Landing />` to `<CyberMap />`
- Update the import accordingly

**2. Update `src/App.tsx`**
- Route `/` to `<TurnstileGate />` (re-enable the CAPTCHA gate)
- Keep `/public` pointing to `<Landing />` so the old landing page remains accessible
- Keep `/cyber-map` pointing directly to `<CyberMap />` (no CAPTCHA, for internal links)
- Import `TurnstileGate`

### Summary

| Route | Before | After |
|-------|--------|-------|
| `/` | Landing page (no CAPTCHA) | Turnstile CAPTCHA then Cyber Map |
| `/public` | Landing page | Landing page (unchanged) |
| `/cyber-map` | Cyber Map (direct) | Cyber Map (direct, unchanged) |

Only two files need minor edits. No backend or database changes required.
