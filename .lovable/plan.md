

## Create Privacy/Terms Pages and Improve Site Visibility

### 1. New Pages

#### Privacy Policy (`src/pages/Privacy.tsx`)
- Dark-themed page matching site design (`bg-[#0a0a0f]`)
- Uses Navbar + Footer + CookieConsent layout
- Covers: data collection, usage, cookies, third parties, security, user rights, contact info
- Professional legal-style content tailored to CyberDefense

#### Terms of Service (`src/pages/Terms.tsx`)
- Same layout and dark theme
- Covers: acceptance, services description, user obligations, intellectual property, limitation of liability, termination, governing law, contact

### 2. Routing (`src/App.tsx`)
- Add `/privacy` and `/terms` routes as public pages (alongside `/contact` and `/portfolio`)

### 3. Footer Links (`src/components/landing/Footer.tsx`)
- Convert the static "Privacy Policy" and "Terms of Service" text spans to `<Link>` components pointing to `/privacy` and `/terms`

### 4. Improve Site Visibility (Too Dark)

The current site uses very dark grays (`gray-400`, `gray-500`) for body text, making it hard to read especially on mobile. Changes across multiple files:

**`src/components/landing/HeroSection.tsx`**
- Subtitle text: `text-gray-400` to `text-gray-300`
- Body paragraph: `text-gray-400` to `text-gray-300`
- Card descriptions: `text-gray-500` to `text-gray-400`

**`src/components/landing/AboutSection.tsx`**
- About body text: `text-gray-500` to `text-gray-300`
- Card descriptions: `text-gray-500` to `text-gray-400`

**`src/components/landing/Footer.tsx`**
- Brand description: `text-gray-500` to `text-gray-400`
- Copyright and bottom bar: `text-gray-600` to `text-gray-500`

**`src/pages/Landing.tsx`**
- Stats sub-text: `text-gray-500` to `text-gray-400`

### Files Summary

| File | Action |
|---|---|
| `src/pages/Privacy.tsx` | **Create** -- Privacy Policy page |
| `src/pages/Terms.tsx` | **Create** -- Terms of Service page |
| `src/App.tsx` | **Edit** -- Add routes for `/privacy` and `/terms` |
| `src/components/landing/Footer.tsx` | **Edit** -- Link Privacy/Terms text to new pages |
| `src/components/landing/HeroSection.tsx` | **Edit** -- Brighten muted text colors |
| `src/components/landing/AboutSection.tsx` | **Edit** -- Brighten muted text colors |
| `src/pages/Landing.tsx` | **Edit** -- Brighten stats sub-text |

