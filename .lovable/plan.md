

## Replace Dashboard Logo with Somalia Cyber Defense Shield

### Overview
Replace the current logo used across the dashboard (sidebar, login page, mobile header, and landing navbar) with the uploaded Somalia Cyber Defense shield logo.

### Changes

**1. Copy uploaded logo to project assets**
- Copy `user-uploads://image-29.png` to `src/assets/logo.png`, replacing the current file
- Copy to `public/logo.png` as well for any direct references

This single asset swap will automatically update every place that imports `src/assets/logo.png`:
- Sidebar logo (dashboard navigation)
- Login page logo
- Mobile header bar
- Landing page navbar

**2. No code changes needed**
All components already import from `@/assets/logo.png`, so replacing the file is sufficient.

### Files Modified
- `src/assets/logo.png` -- replaced with new Somalia Cyber Defense shield logo
- `public/logo.png` -- replaced with new Somalia Cyber Defense shield logo

