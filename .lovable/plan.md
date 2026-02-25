Goal: stop CAPTCHA from blocking the Preview environment while keeping CAPTCHA enabled only on the real production domain (`cyberdefense.so`), exactly as you requested.

What I found:

- The gate currently bypasses only:
  - `localhost`
  - hostnames containing `lovable.app`
- Your current preview host is `*.lovableproject.com`, so it is not bypassed.
- Because of that, Turnstile renders in preview and fails with Cloudflare error `110200` (“Unable to connect to website”), which blocks `/` and `/cyber-map`.
- The same hostname logic is also used on `/contact`, so it can fail there too in preview.

Implementation plan:

1. Make domain check explicit: protect only production host

- In `src/pages/TurnstileGate.tsx`, replace current `bypassed` logic with an allowlist check:
  - CAPTCHA enabled only when hostname is:
    - `cyberdefense.so`
    - `www.cyberdefense.so`
  - Otherwise (preview/dev/any non-production host), immediately render children without Turnstile.
- This is safer than matching preview domains because preview domains can change over time.

2. Apply the same production-only rule on Contact page

- In `src/pages/Contact.tsx`, replace `isDev` logic with the same production-host check.
- Result:
  - Turnstile widget is hidden in preview/dev.
  - form submit won’t require Turnstile token in preview/dev.
  - Turnstile verification still required in production domain only.

3. Keep all other behavior unchanged

- Do not change routing, UI copy, styling, token/session behavior, or verification endpoint.
- `/` and `/cyber-map` remain protected in production.
- `/contact` remains protected in production.

4. Validation checklist after implementation

- Preview (`*.lovableproject.com` / `*.lovable.app`):
  - `/` opens directly (no security verification screen).
  - `/cyber-map` opens directly.
  - `/contact` submits without CAPTCHA requirement.
- Production domain (`cyberdefense.so` and `www.cyberdefense.so`):
  - `/` and `/cyber-map` show Turnstile gate.
  - `/contact` requires successful verification before submit.
- Confirm no regression in existing session-based pass behavior on production.

Technical notes:

- Files to update:
  - `src/pages/TurnstileGate.tsx`
  - `src/pages/Contact.tsx`
- Suggested shared condition (same in both files):
  - `const isProductionCaptchaHost = hostname === "cyberdefense.so" || hostname === "www.cyberdefense.so";`
  - Gate/widget logic should run only when `isProductionCaptchaHost` is true.  
  Also change the the background color of the landing page in the hero section "View Live threat" to red color