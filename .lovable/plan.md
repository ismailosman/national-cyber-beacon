

## Add Theme Toggle Back to Navbar (Page Content Only)

### Overview
Add a sun/moon toggle button back into the navbar that switches the page body content between light and dark mode. The navbar and footer will remain permanently dark (hardcoded `bg-gray-950`), unaffected by the theme change.

### Change

**File: `src/components/landing/Navbar.tsx`**

1. Import the `ThemeToggle` component from `@/components/ThemeToggle`
2. Add `<ThemeToggle />` in the desktop nav (before the "Secure Your Business" button)
3. Add `<ThemeToggle />` in the mobile menu (at the top or bottom of the menu items)

The ThemeToggle component already exists and uses `next-themes` to toggle between light/dark. Since the navbar and footer use hardcoded dark colors (`bg-gray-950`, `text-gray-400`, `border-gray-800`), they won't be affected by the theme change. Only page content using CSS custom properties (e.g., `--landing-bg`, `--landing-fg`) will switch appearance.

### No other files need changes
- `ThemeToggle` component already exists at `src/components/ThemeToggle.tsx`
- Navbar and footer are already hardcoded dark
- Landing pages already use theme-aware CSS variables for body content

