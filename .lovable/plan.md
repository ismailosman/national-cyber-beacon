

## Keep Navbar and Footer Always Dark (No Theme Toggle)

### Overview
Remove the theme toggle button from the navbar and hardcode the navbar to always use dark styling -- matching the footer which already uses fixed dark colors (`bg-gray-950`, `text-gray-400`, etc.).

### Changes

**File: `src/components/landing/Navbar.tsx`**

1. Remove the `ThemeToggle` import
2. Remove both `<ThemeToggle />` instances (desktop at line 129, mobile at line 142)
3. Replace all `hsl(var(--landing-*))` CSS variables with hardcoded dark values to match the footer:
   - `--landing-nav-bg` -> `bg-gray-950`
   - `--landing-nav-border` -> `border-gray-800`
   - `--landing-muted` -> `text-gray-400`
   - `--landing-fg` -> `text-white`
   - `--landing-card` -> `bg-gray-900`
   - `--landing-card-border` -> `border-gray-800`

This ensures the navbar always looks dark regardless of the current theme, matching the footer's styling.

### No other files need changes
- The Footer already uses hardcoded dark colors
- The ThemeToggle component itself stays in the codebase (used in the dashboard sidebar)
