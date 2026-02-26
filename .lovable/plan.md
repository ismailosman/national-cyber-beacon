

## Update LIVE ATTACK Links to /threat-map and Remove /cyber-map Route

### Overview
Replace all `/cyber-map` references in the dashboard sidebar, landing page navbar, hero section, and router with `/threat-map`. Remove the `/cyber-map` route entirely.

### Changes

**1. `src/components/landing/Navbar.tsx`**
- Change both `/cyber-map` links (desktop line 121, mobile line 192) to `/threat-map`

**2. `src/components/landing/HeroSection.tsx`**
- Change the `/cyber-map` link (line 47) to `/threat-map`

**3. `src/components/layout/Sidebar.tsx`**
- Change the sidebar nav item from `/cyber-map` to `/threat-map` (line 18)

**4. `src/App.tsx`**
- Remove the `/cyber-map` route (line 123)
- Keep the `/threat-map` route as-is
- Remove the `CyberMap` import since it's no longer routed

### Files unchanged
- `src/pages/CyberMap.tsx` -- kept in the codebase but no longer routed (can be deleted later if desired)
- `src/pages/ThreatMapStandalone.tsx` -- no changes needed

