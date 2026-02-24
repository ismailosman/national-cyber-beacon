## Redesign Landing Page with Video Hero, Light/Dark Mode, and Professional Look

### Overview

Completely redesign the landing page to feature a cinematic video hero section, add a global light/dark mode toggle, and brighten the overall aesthetic for a more professional appearance. The feature cards grid (Reduce Attack Surface, Uncover Security Gaps, etc.) shown in the screenshot will be removed from the hero.

### Changes

**1. Upload video to file storage**

- Copy `user-uploads://herosection.mp4` to `public/herosection.mp4` for direct use as a background video in the hero section
- Also upload it to the `media` storage bucket for CDN delivery

**2. Add light mode CSS variables (`src/index.css`)**

- Add a `.light` class (or `:root` without `.dark`) with light-mode equivalents for all CSS variables (white backgrounds, dark text, lighter card colors, etc.)
- Remove the `html { color-scheme: dark; }` forced override
- Keep the existing dark variables under `.dark` class

**3. Create a ThemeProvider + toggle component**

- `next-themes` is already installed. Wrap the app with `ThemeProvider` in `src/main.tsx` or `src/App.tsx`
- Create `src/components/ThemeToggle.tsx` -- a Sun/Moon icon button that toggles between light and dark mode

**4. Redesign `src/components/landing/HeroSection.tsx**`

- Remove the 2x2 feature cards grid entirely (the section shown in the screenshot)
- Replace with a full-width video background hero:
  - `<video autoPlay muted loop playsInline>` with `herosection.mp4` as source
  - Dark overlay gradient on top for text readability
  - Centered headline text, subtitle, and CTA buttons
  - The video fills the entire hero viewport height
- Keep the existing headline copy and CTA buttons, just centered over the video

**5. Update `src/components/landing/Navbar.tsx**`

- Add the `ThemeToggle` button to the navbar (both desktop and mobile views)
- Update hardcoded `bg-gray-950` to use theme-aware classes (`bg-white dark:bg-gray-950`)
- Update text colors to be theme-aware (`text-gray-700 dark:text-gray-300`)

**6. Update `src/pages/Landing.tsx**`

- Replace hardcoded dark backgrounds (`bg-[#0a0a0f]`) with theme-aware classes (`bg-white dark:bg-[#0a0a0f]`)
- Update the Stats Trust Bar section with theme-aware styling
- Update text colors throughout

**7. Update `src/components/landing/AboutSection.tsx**`

- Replace hardcoded dark backgrounds with theme-aware classes
- Update card borders, text colors, and backgrounds for light mode

**8. Update `src/components/landing/Footer.tsx**`

- Make footer theme-aware (light background in light mode, dark in dark mode)
- Update text and border colors

**9. Update `src/components/landing/CookieConsent.tsx**`

- Already light-themed; add dark mode variant styling

**10. Update `src/pages/Contact.tsx` and `src/pages/Portfolio.tsx**`

- Make these pages theme-aware as well, since they share the same Navbar/Footer

**11. Wrap app with ThemeProvider (`src/App.tsx`)**

- Wrap the entire app with `<ThemeProvider attribute="class" defaultTheme="dark">`
- This enables the `dark:` prefix in Tailwind to work

### Technical Details

```text
Theme setup:
- next-themes ThemeProvider with attribute="class"
- Default theme: "dark" (preserves current look on first visit)
- Tailwind already configured with darkMode: ["class"]
- Light mode: white/gray backgrounds, dark text
- Dark mode: existing SOC dark theme preserved exactly

Video hero:
- <video> tag with autoPlay, muted, loop, playsInline
- object-fit: cover, absolute positioned behind content
- Semi-transparent overlay gradient for text contrast
- Responsive: video covers full section on all screen sizes

Theme toggle:
- Sun icon in dark mode, Moon icon in light mode
- Placed in navbar next to the CTA button
- Smooth transition between modes

Light mode color scheme:
- Background: white (#ffffff)
- Cards: #f8f9fa with subtle borders
- Text: gray-900 for headings, gray-600 for body
- Accent: #FF4D2E (unchanged)
- Navbar: white with subtle bottom border
```

### Files Modified

- `public/herosection.mp4` -- video asset copied from upload
- `src/index.css` -- add light mode CSS variables
- `src/App.tsx` -- wrap with ThemeProvider
- `src/components/ThemeToggle.tsx` -- new theme toggle component
- `src/components/landing/HeroSection.tsx` -- redesigned with video background, cards removed
- `src/components/landing/Navbar.tsx` -- theme-aware + toggle button
- `src/components/landing/AboutSection.tsx` -- theme-aware styling
- `src/components/landing/Footer.tsx` -- theme-aware styling
- `src/components/landing/CookieConsent.tsx` -- dark mode variant
- `src/pages/Landing.tsx` -- theme-aware wrapper
- `src/pages/Contact.tsx` -- theme-aware styling
- `src/pages/Portfolio.tsx` -- theme-aware styling

### Notes

- The dashboard (behind login) keeps its SOC dark theme unchanged -- light/dark mode only affects landing pages
- The `#FF4D2E` brand accent color stays consistent across both modes
- Default theme is dark to match the current experience; users can switch to light  
Please make sure the vidoe is loop play