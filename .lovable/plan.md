

## Set Dark Mode as Default Theme

### Overview
Change the default theme from "light" to "dark" so all pages (landing, dashboard, and security pages) start in dark mode.

### Change Required

**File: `src/App.tsx` (line 99)**

Update the `ThemeProvider` `defaultTheme` prop from `"light"` to `"dark"`:

```text
Before: <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
After:  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
```

This single change applies dark mode globally to every page -- landing, portfolio, contact, security pages, login, and the dashboard (which already forces dark via the `.dark` class on its wrapper).

No other files need to change since all landing page components already use CSS custom properties (`--landing-bg`, `--landing-fg`, etc.) that have dark-mode values defined in `index.css` under the `.dark` selector.

