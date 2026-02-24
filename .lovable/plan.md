

## Expand Attack Targets & Fix Country Hover Tooltip

### 1. Expand attack targets to neighbouring countries

**File: `src/hooks/useLiveAttacks.ts`**

Rename `SOMALIA_TARGETS` to `REGION_TARGETS` and add target locations for Djibouti, Kenya, Ethiopia, Tanzania, South Sudan, Sudan, Uganda, and Rwanda alongside the existing Somalia targets. Somalia will still receive the majority of attacks (~50%), with the rest distributed across neighbours.

New targets to add:
- Djibouti: Djibouti City (11.588, 43.145)
- Kenya: Nairobi (-1.286, 36.817), Mombasa (-4.043, 39.668)
- Ethiopia: Addis Ababa (9.025, 38.747), Dire Dawa (9.601, 41.850)
- Tanzania: Dar es Salaam (-6.792, 39.208), Dodoma (-6.163, 35.752)
- South Sudan: Juba (4.859, 31.571)
- Sudan: Khartoum (15.500, 32.560)
- Uganda: Kampala (0.347, 32.582)
- Rwanda: Kigali (-1.940, 29.874)

Somalia targets will be duplicated in the array to maintain ~50% weight.

### 2. Fix country hover tooltip -- white text on black background

**File: `src/index.css`**

Update the `.country-hover-popup .mapboxgl-popup-content` CSS to use a solid black background with white text, matching the reference image exactly:
- Background: `rgba(0, 0, 0, 0.85)` (solid black, slightly transparent)
- Border: none or very subtle
- Padding: `6px 12px`
- Border-radius: `4px`

**File: `src/pages/CyberMap.tsx`**

Update the inline HTML in the popup `setHTML` call to use `color: #ffffff` (pure white) instead of `#e2e8f0`.

### Technical details

- The `REGION_TARGETS` array will have Somalia entries repeated to keep them weighted higher
- The `generateDayThreat` function just picks from the targets array randomly, so no logic change needed there
- The tooltip fix addresses both the styling (CSS) and the text color (inline HTML)
- The hover target layer (`country-hover-target`) and event handlers remain unchanged -- the tooltip should already be working with the `promoteId` fix from the last edit

