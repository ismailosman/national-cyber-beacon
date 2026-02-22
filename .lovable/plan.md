

## Two Fixes

### 1. Remove "Public Dashboard" and "Analyst Login" from Cyber Map

**File:** `src/pages/CyberMap.tsx` (lines 1373-1391)

Remove the entire nav buttons block (the `div` containing the "Public Dashboard" and "Analyst Login" links) from the top-left corner of the cyber map page.

### 2. Fix Contact Page White Background and Form Visibility

**File:** `src/pages/Contact.tsx`

- Change the outer wrapper background from `bg-white text-gray-900` to `bg-[#0a0a0f] text-white` (dark theme, matching the landing page)
- Change the section background from `bg-gray-50` to `bg-[#0a0a0f]`
- Update the form input styling from semi-transparent (`bg-white/10 border-white/30 text-white placeholder:text-white/50`) to solid white inputs with dark text (`bg-white text-gray-900 border-white/50 placeholder:text-gray-500`) so the fields are clearly readable against the red background
- Remove the `max-w-7xl mx-auto` wrapper so the two-column layout goes edge-to-edge

