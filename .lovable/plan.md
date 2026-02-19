

# Add Cloudflare Turnstile CAPTCHA Gate to Landing Page

## What You'll See

When visiting `/`, a clean verification screen appears first -- showing the Somalia Cyber Defence logo, a "Verifying you are human" message, and the Cloudflare Turnstile widget. Once verified, the landing page loads automatically. Returning visitors in the same browser session skip the check.

## Setup Steps (before coding)

1. **Store your Turnstile Secret Key** as a backend secret called `TURNSTILE_SECRET_KEY`
2. **Store your Turnstile Site Key** as a constant in the frontend code (it's public/safe to expose)

## Implementation

### New Files

| File | Purpose |
|---|---|
| `src/pages/TurnstileGate.tsx` | Full-screen verification page matching the reference screenshot style: dark background, logo, "Verifying you are human" heading, Turnstile widget, auto-redirect on success |
| `supabase/functions/verify-turnstile/index.ts` | Backend function that validates the Turnstile token with Cloudflare's siteverify API using the secret key |

### Modified Files

| File | Change |
|---|---|
| `index.html` | Add Turnstile script: `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer>` |
| `src/App.tsx` | Change `/` route from `<Landing />` to `<TurnstileGate />` |

### Flow

```text
User visits /
    |
    v
TurnstileGate checks sessionStorage for "verified" flag
    |
    +-- Already verified? --> Render Landing page directly
    |
    +-- Not verified? --> Show verification screen
            |
            v
        Turnstile widget renders and user completes challenge
            |
            v
        Token sent to verify-turnstile backend function
            |
            v
        Backend calls Cloudflare siteverify API with secret key
            |
            v
        Success? --> Set sessionStorage flag, render Landing page
        Failure? --> Show error with retry option
```

### Verification Page Design (matching reference)

- Dark background consistent with the app theme
- Somalia Cyber Defence logo centered at top
- Heading: "Verifying you are human"
- Subtitle: "This process is automatic. Your browser will redirect shortly."
- Turnstile widget centered below
- Footer: "cyberdefense.so needs to review the security of your connection before proceeding"

### Backend Function

The `verify-turnstile` edge function:
- Accepts POST with `{ token: string }`
- Calls `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET_KEY`
- Returns `{ success: true/false }`
- Has `verify_jwt = false` in config since it's called before authentication

### Scope

Only the `/` route is gated. `/cyber-map`, `/threat-map`, `/login`, and all authenticated routes remain unaffected.

