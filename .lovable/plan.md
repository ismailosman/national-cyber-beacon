

## Landing Page Cleanup: Separate Pages, Colorful About, GDPR Banner, Turnstile on Contact

### Overview
Restructure the landing page by moving Contact and Portfolio into their own routes, making the landing page cleaner. Add a GDPR cookie consent banner, Turnstile CAPTCHA on the consultation form, a colorful About section, and replace the consultation form image.

### Changes Summary

| # | File | Action |
|---|---|---|
| 1 | `src/pages/Contact.tsx` | **New** -- Standalone contact/consultation page with Turnstile CAPTCHA and new image |
| 2 | `src/pages/Portfolio.tsx` | **New** -- Standalone portfolio/services page |
| 3 | `src/pages/Landing.tsx` | **Edit** -- Remove Portfolio and Contact sections, keep only Hero + About + Footer |
| 4 | `src/components/landing/AboutSection.tsx` | **Edit** -- Add colorful gradient backgrounds, accent colors, and visual flair |
| 5 | `src/components/landing/Navbar.tsx` | **Edit** -- Change "Portfolio" and "Contact" from scroll anchors to route links (`/portfolio`, `/contact`) |
| 6 | `src/components/landing/CookieConsent.tsx` | **New** -- GDPR cookie consent banner component |
| 7 | `src/App.tsx` | **Edit** -- Add `/contact` and `/portfolio` routes |
| 8 | `src/assets/cyber-professional.jpg` | **Replace** -- Copy uploaded cybersecurity professional image |
| 9 | `index.html` | **Edit** -- Add Turnstile script tag for CAPTCHA widget |

### Detailed Changes

**1. New `/contact` page (`src/pages/Contact.tsx`)**
- Wraps the existing `ContactSection` component with Navbar and Footer
- Adds Cloudflare Turnstile CAPTCHA widget before form submission
- The form submit button is disabled until Turnstile verification passes
- Uses the existing `verify-turnstile` edge function (already deployed) and the Turnstile site key (`0x4AAAAAACfqOh5kqOZCLMB6`)
- The consultation form image is replaced with the uploaded cybersecurity professional image

**2. New `/portfolio` page (`src/pages/Portfolio.tsx`)**
- Wraps the existing `PortfolioSection` component with Navbar and Footer
- Simple standalone page layout

**3. Clean Landing page**
- Remove `PortfolioSection` and `ContactSection` imports/usage
- Landing page becomes: Navbar, Hero, About, Footer
- Clean and focused

**4. Colorful About section**
- Add gradient accent backgrounds to the highlight cards
- Use brand colors (`#FF4D2E` orange, deep blue `#1a1a2e`, teal accents)
- Each card gets a distinct colored icon background
- Add a subtle gradient banner behind the section heading
- Maintain readability and WCAG AA compliance

**5. Updated Navbar**
- "Home" stays as scroll to `#hero` (only on landing page) or link to `/`
- "About" stays as scroll to `#about` (only on landing page) or link to `/#about`
- "Portfolio" becomes a `Link` to `/portfolio`
- "Contact" becomes a `Link` to `/contact`
- Navigation items work correctly whether you're on the landing page or a sub-page

**6. GDPR Cookie Consent Banner (`src/components/landing/CookieConsent.tsx`)**
- Fixed bottom banner (similar to the reference image)
- Heading: "Help us give you the best experience"
- Body text about cookies usage
- "Our Cookie Policy" link
- Two buttons: "Accept All Cookies" (filled dark) and "Cookies Settings" (outlined)
- Consent stored in `localStorage` so it only shows once
- Rendered globally in `Landing.tsx` (and the Contact/Portfolio pages)

**7. Turnstile CAPTCHA on Contact page**
- Embed the Turnstile widget inside the consultation form
- Form submission is blocked until the CAPTCHA token is obtained
- Token is verified server-side via the existing `verify-turnstile` edge function before calling `send-contact-form`
- The Turnstile script is loaded via `index.html` (it may already be there from the TurnstileGate page)

**8. Image replacement**
- Copy `user-uploads://BA13CA86-F944-4B31-AAA0-FCC02A1D92E2.png` to `src/assets/cyber-professional.jpg`
- The ContactSection already imports from this path, so the image updates automatically

### Technical Details

**Turnstile integration on Contact form:**
- The Turnstile widget renders inline within the form (above the submit button)
- On successful challenge, a token is stored in component state
- On form submit: first call `verify-turnstile` with the token; if valid, call `send-contact-form` with the form data
- If verification fails, show an error and reset the widget
- Site key: `0x4AAAAAACfqOh5kqOZCLMB6` (already configured)
- Secret key: `TURNSTILE_SECRET_KEY` (already in secrets)

**Cookie consent storage:**
- Uses `localStorage.getItem('cookie_consent')` to check if user has already accepted
- On "Accept All Cookies", sets `localStorage.setItem('cookie_consent', 'accepted')`
- Banner disappears after acceptance
- "Cookies Settings" button can link to a cookie policy page or show a modal (initially just closes the banner)

**Navbar routing logic:**
- On the landing page (`/`), "Home" and "About" use smooth scroll
- On other pages, "Home" links to `/` and "About" links to `/#about`
- "Portfolio" always links to `/portfolio`
- "Contact" always links to `/contact`
- Uses `useLocation` from react-router-dom to determine current page

