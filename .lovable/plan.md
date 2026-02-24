

## Add Colorful Animated Borders to Landing Page Sections

### Overview
Add vibrant, animated gradient borders to the Stats Trust Bar and About Us section cards to make the landing page more dynamic and visually engaging.

### Changes

**1. Add animated gradient border CSS (`src/index.css`)**
- Add a `@keyframes gradient-shift` animation that rotates a conic/linear gradient around elements
- Create utility classes for the animated border effect using a pseudo-element technique (element with gradient background, inner content with solid background on top)

**2. Update Stats Trust Bar (`src/pages/Landing.tsx`)**
- Wrap the stats section with an animated gradient top/bottom border
- Use a multi-color gradient (red, blue, green, purple, cyan) that animates smoothly
- The thin gradient line at the top and bottom of the stats section will shift colors continuously

**3. Update About Us cards (`src/components/landing/AboutSection.tsx`)**
- Replace the static `borderTopColor` with an animated gradient border around each card
- Use the pseudo-element technique: outer wrapper has a rotating gradient background, inner card sits on top with a small gap (1-2px) revealing the gradient as a border
- Each card gets a unique gradient accent that animates on hover

### Technical Approach

The animated border effect uses:
- A wrapper `div` with `background: conic-gradient(...)` and `@keyframes gradient-shift` rotating the gradient colors
- An inner `div` with matching `border-radius` and solid background, inset by 1-2px to reveal the gradient as a border
- `background-size: 300% 300%` with `animation: gradient-shift 4s ease infinite` for the color shifting effect

### Files Modified
- `src/index.css` -- Add `@keyframes gradient-shift` and `.animated-border` utility class
- `src/pages/Landing.tsx` -- Apply animated gradient border to stats trust bar section
- `src/components/landing/AboutSection.tsx` -- Apply animated gradient borders to highlight cards

