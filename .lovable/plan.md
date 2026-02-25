

## Redesign Portfolio Page with Cyber-Themed Service Cards

### Overview
Replace the current simple card layout with a dark, cyber-themed design featuring animated scan lines, corner brackets, metric displays, and color-coded service cards.

### Changes

**File: `src/components/landing/PortfolioSection.tsx`** — Full rewrite

The new component will include:

- **Enhanced service data**: Each service now has `id`, `subtitle`, `metric`, `metricLabel`, `tag`, and unique `color` fields
- **ServiceCard sub-component** with:
  - Hover-triggered animated scan line effect using `requestAnimationFrame`
  - SVG corner bracket decorations on all four corners
  - Octagon-shaped icon container with colored border
  - Status tag badges (ACTIVE, LIVE, HARDENED, CRITICAL) with per-card colors
  - Metric display bar showing key stats (e.g., "99.7% Detection Rate")
  - Glow border and box-shadow on hover using each card's accent color
  - Staggered fade-up entrance animation via inline `animationDelay`
- **Section wrapper** with:
  - Dark background (`#060e1a`) with subtle grid overlay pattern
  - Radial gradient glow accent
  - Section heading styled with Orbitron/Rajdhani fonts via inline styles
  - Responsive 2-column grid layout
- **Inline `<style>` tag** for:
  - Google Fonts import (Share Tech Mono, Rajdhani, Orbitron)
  - `@keyframes cyberFadeUp` animation

**File: `src/pages/Portfolio.tsx`** — Minor update

- Remove `bg-[hsl(var(--landing-bg))]` from the wrapper since PortfolioSection now controls its own dark background, or keep it and let the section's own background override visually.

### Technical Notes
- The user's pasted JSX had stripped/broken tags — I will reconstruct the complete working JSX from the intent and structure provided
- Uses only existing dependencies (React, lucide-react) — no new packages needed
- Fonts loaded via `@import` in an inline `<style>` tag within the component
- All animations are CSS-based or lightweight `requestAnimationFrame` for the scan line
