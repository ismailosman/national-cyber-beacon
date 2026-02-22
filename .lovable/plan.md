

## Professional Landing Page Redesign

### Overview
Complete redesign of the landing page to create a modern, professional cybersecurity website inspired by the Redline reference image (dark theme with feature cards) while keeping the brand identity. The page will have a dark hero section, a new "Services" highlights section with card grid, a refreshed About section, improved stats/trust bar, and polished footer.

### Design Direction
- **Dark theme hero** (inspired by Redline reference) -- dark background (#0a0a0f) with subtle gradient accents
- **Two-column hero**: Left side has bold headline with red accent bar + CTA button; Right side has a 2x2 grid of feature/benefit cards with icons (like the Redline image)
- **Stats/trust bar** between hero and about -- showing key numbers (e.g., "24/7 Monitoring", "99.9% Uptime", "50+ Clients Protected")
- **Colorful About section** -- kept light with gradient card backgrounds
- **Dark footer** -- expanded with more links and branding

### Files to Change

| File | Action | Description |
|---|---|---|
| `src/components/landing/HeroSection.tsx` | **Rewrite** | Dark theme hero with left headline + right feature cards grid (Redline-inspired) |
| `src/components/landing/AboutSection.tsx` | **Edit** | Add stats bar above, enhance visual design |
| `src/components/landing/Navbar.tsx` | **Edit** | Add a CTA button ("Secure Your Business") in the navbar, polish styling |
| `src/components/landing/Footer.tsx` | **Rewrite** | Expanded professional footer with columns |
| `src/pages/Landing.tsx` | **Edit** | Add new sections (stats, services preview) |
| `src/index.css` | **Edit** | Add any needed animation keyframes |

### Detailed Changes

#### 1. HeroSection -- Dark Theme with Feature Cards
Inspired by the Redline reference image:
- **Dark background** (`bg-[#0a0a0f]`) with subtle radial gradient accents in red/cyan
- **Left column**: 
  - Red vertical accent bar (left border) next to subtitle text
  - Large bold white headline: "Secure Your Business with Advanced Cyber Defense"
  - Subtitle paragraph with muted text
  - Red CTA button: "Secure Your Business" (rounded-full, links to /contact)
- **Right column**: 2x2 grid of dark glass cards, each with:
  - Icon (line-style, white/red accent)
  - Bold title
  - Short description in muted text
  - Cards: "Reduce Attack Surface", "Uncover Security Gaps", "Test Security Controls", "Clear Reporting Insights"
- Subtle vertical/horizontal decorative lines (thin gray borders) for visual structure

#### 2. Stats/Trust Bar (new component inline in Landing.tsx)
A horizontal bar between hero and about sections:
- Dark or accent background
- 4 stat items: "24/7 Real-Time Monitoring", "99.9% Uptime SLA", "50+ Organizations Protected", "500+ Threats Blocked Daily"
- Clean grid layout with dividers

#### 3. AboutSection -- Enhanced
- Keep the current structure but add:
  - Larger, more vivid gradient icon backgrounds
  - Subtle hover animations (scale + shadow)
  - Better spacing and typography
  - Each card gets a colored top border accent

#### 4. Navbar -- Add CTA Button
- Add a "Secure Your Business" red CTA button (rounded-full) on the right side of the navbar
- Links to `/contact`
- Visible on desktop, hidden on mobile (shown in mobile menu instead)

#### 5. Footer -- Expanded Professional
- Multi-column layout:
  - Column 1: Logo + company description
  - Column 2: Quick Links (Home, About, Portfolio, Contact)
  - Column 3: Services links
  - Column 4: Contact info (email)
- Bottom bar with copyright and social/legal links
- Dark background with subtle styling

### Technical Notes
- All changes are frontend-only (React components + Tailwind CSS)
- No database or backend changes needed
- Images from reference are for design inspiration only, not embedded
- Maintains existing routing and nav structure
- Mobile responsive throughout
