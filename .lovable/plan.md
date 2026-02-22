

## Replace Landing Page with New Cybersecurity Company Website at /

### Overview
Complete replacement of the old dark-themed `/public` landing page with a clean, modern, light-themed cybersecurity company website. The new page becomes the root `/` route for cyberdefense.so, while preserving all existing backend functionality.

### Routing Changes (`src/App.tsx`)

| Current | New |
|---|---|
| `/` renders CyberMap (lovable.app) or TurnstileGate (cyberdefense.so) | `/` renders the new Landing page on all hosts |
| `/public` renders old Landing | `/public` route removed entirely |
| `/cyber-map` renders CyberMap | Unchanged |

- The TurnstileGate CAPTCHA flow is removed from the root route since the new landing page is a public marketing site
- `/cyber-map` remains fully functional and is linked from the "LIVE ATTACK" nav item
- All protected routes (`/dashboard`, `/organizations`, etc.) remain unchanged
- The old `Landing.tsx` file content is completely replaced

### New Landing Page Design (`src/pages/Landing.tsx`)

**Theme**: Light background (#f8f9fa / white), primary accent `#FF4D2E` (orange-red), clean sans-serif (Inter), minimal and premium enterprise aesthetic.

**Sections**:

1. **Sticky Navbar**
   - Left: Company logo (from `src/assets/logo.png`) linked to `/`
   - Right: Home, About, Services, LIVE ATTACK (links to `/cyber-map`, styled with accent), Contact
   - Mobile: hamburger menu
   - Subtle shadow appears on scroll

2. **Hero Section** (two-column)
   - Left column:
     - H1: "Advanced Cyber Defense for Modern Businesses"
     - Subtitle: "Real-time monitoring, AI-driven threat detection, and enterprise-grade infrastructure protection."
     - Primary CTA: "Get Started" button (`#FF4D2E`)
     - Secondary CTA: "Request Consultation" (outlined)
   - Right column:
     - SVG/CSS illustration featuring an orange shield, laptop, network nodes, and security elements (inspired by the reference image)
     - Subtle floating animations on elements

3. **About Section** (id="about")
   - Company overview, mission, and values
   - Two-column layout with text and feature highlights

4. **Services Section** (id="services")
   - Card grid showcasing: Threat Detection, Real-time Monitoring, Infrastructure Protection, Incident Response
   - Each card with icon, title, description

5. **Contact Section** (id="contact")
   - Simple contact form (name, email, message) -- frontend-only for now
   - Company contact information

6. **Footer**
   - Logo, copyright, quick links

### SEO Updates (`index.html`)

- Title: "CyberDefense | Advanced Cybersecurity Solutions"
- Meta description: "Enterprise cyber defense, real-time threat monitoring, and AI-powered security solutions."
- OG tags updated to match

### Files Changed

| File | Action |
|---|---|
| `src/pages/Landing.tsx` | Complete rewrite -- new light-themed marketing page |
| `src/App.tsx` | Update `/` route to render Landing on all hosts; remove `/public` route |
| `index.html` | Update meta title, description, OG tags |

### Technical Notes

- The new landing page is entirely static (no backend calls needed for the marketing content)
- Smooth scroll behavior for in-page navigation (Home, About, Services, Contact)
- "LIVE ATTACK" nav item links to `/cyber-map` via React Router
- The hero illustration will be built with SVG/CSS elements (shield, laptop, network dots) -- no external image dependencies
- Mobile-first responsive design using Tailwind breakpoints
- All existing providers (AuthProvider, QueryClientProvider, etc.) remain wrapped around routes
- The TurnstileGate page file is kept but no longer used at `/` -- can be cleaned up later if desired

