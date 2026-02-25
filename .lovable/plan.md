

## Add Security Service Pages with Dropdown Navigation

### Overview
Create 8 new public-facing security service pages accessible via a "Security" dropdown menu in the landing Navbar. Each page will have rich, written content about that service, styled for both light and dark modes.

### New Pages (8 files)

Each page will follow the same layout pattern as the existing Portfolio page (Navbar + content + Footer + CookieConsent) and include:
- A hero banner with title, subtitle, and accent color
- Key features/capabilities section with icon cards
- A "Why it matters" or benefits section
- A call-to-action linking to /contact

**Files to create:**

| Route | File | Title |
|-------|------|-------|
| `/security/cybersecurity-compliance` | `src/pages/security/CybersecurityCompliance.tsx` | Cybersecurity Compliance |
| `/security/ransomware-protection` | `src/pages/security/RansomwareProtection.tsx` | Ransomware Protection |
| `/security/secure-apps-apis` | `src/pages/security/SecureAppsApis.tsx` | Secure Apps and APIs |
| `/security/dns-security` | `src/pages/security/DnsSecurity.tsx` | DNS Delivery and Security |
| `/security/zero-trust` | `src/pages/security/ZeroTrust.tsx` | Zero Trust |
| `/security/ddos-protection` | `src/pages/security/DdosProtection.tsx` | DDoS Protection |
| `/security/bot-protection` | `src/pages/security/BotProtection.tsx` | Bot and Abuse Protection |
| `/security/identity-access` | `src/pages/security/IdentityAccess.tsx` | Identity, Credential, and Access Management |

### Shared Layout Component

**File: `src/components/landing/SecurityPageLayout.tsx`**

A reusable wrapper to avoid duplicating the hero + features + CTA structure across all 8 pages. Each page passes its unique content (title, subtitle, description, features list, benefits) as props.

### Navbar Update

**File: `src/components/landing/Navbar.tsx`**

- Add a "Security" item to `NAV_ITEMS` that renders as a dropdown menu (hover on desktop, tap on mobile)
- The dropdown lists all 8 security pages with their titles
- Styled consistently with the existing nav: gray-400 text, white on hover, dark background dropdown panel

### Routing Update

**File: `src/App.tsx`**

- Import all 8 new page components
- Add 8 new public routes under `/security/*` alongside existing public routes (portfolio, contact, etc.)

### Light/Dark Mode Support

- All pages use Tailwind's `dark:` variant classes for colors and backgrounds
- Light mode: white/gray backgrounds, dark text
- Dark mode: dark backgrounds (#060e1a / gray-950), light text
- Consistent with the existing theme system managed by `next-themes`

### Technical Details

- No new dependencies required
- No database changes
- All pages are public (no auth required)
- Content will be hardcoded (no CMS) with professional cybersecurity service descriptions
- Each page's features section will use lucide-react icons

