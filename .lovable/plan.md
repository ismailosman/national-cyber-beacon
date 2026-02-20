
## Add Hargeisa as a Target Location on the Cyber Threat Map

### What Changes

Add Hargeisa (Somalia's second-largest city, capital of Somaliland) as a target in the `SOMALIA_TARGETS` array in `src/hooks/useLiveAttacks.ts`. This means simulated attacks will now randomly target both Mogadishu-area locations and Hargeisa, making the threat map more representative.

### Technical Details

**File: `src/hooks/useLiveAttacks.ts`**

Add several Hargeisa-area coordinate entries to the `SOMALIA_TARGETS` array (around lines 82-89). Hargeisa coordinates center around lat 9.56, lng 44.06. Multiple slightly varied points will be added (similar to how Mogadishu has several district-level entries) to create natural spread on the map:

- Hargeisa city center (~9.560, 44.064)
- Hargeisa district variants (e.g., Ahmed Dhagah, Ga'an Libah, Mohamed Mooge)

No other files need to change -- the threat generator already picks randomly from `SOMALIA_TARGETS`, so adding entries automatically distributes attacks across both cities.
