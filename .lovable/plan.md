
## Expand Target Countries Beyond Somalia

### Problem
Currently, the "main focus" corridor (30%) only targets Somalia. The user wants Egypt, Saudi Arabia, Algeria, Pakistan, India, Qatar, and Angola added as primary targets alongside Somalia -- making it a broader "priority nations" corridor rather than a Somalia-only one.

### Solution
Replace the separate "Somalia" and "Africa" corridors with a single expanded **Priority Targets** corridor that includes all the requested countries mixed with Somalia, then keep USA and EU corridors unchanged.

### Changes

**File: `src/hooks/useLiveAttacks.ts`**

1. **Expand `AFRICA_TARGETS`** to include the new countries:
   - Egypt: Cairo, Alexandria
   - Saudi Arabia: Riyadh, Jeddah
   - Algeria: Algiers, Oran
   - Pakistan: Islamabad, Karachi
   - India: Mumbai, New Delhi
   - Qatar: Doha
   - Angola: Luanda
   - Keep existing entries (Djibouti, Kenya, Ethiopia, Tanzania, Sudan, Uganda, Rwanda)

2. **Rename corridors for clarity** -- the "Africa" corridor becomes a "MENA & Global South" corridor since it now spans Africa, Middle East, and South Asia.

3. **Update corridor weights** to spread attacks more evenly across the expanded target set:
   - **Somalia (20%)** -- Somalia-specific targets (unchanged array)
   - **MENA & Global South (30%)** -- Egypt, Saudi Arabia, Algeria, Pakistan, India, Qatar, Angola + existing African countries
   - **USA (25%)** -- unchanged
   - **EU (25%)** -- unchanged

4. **Update `generateDayThreat` corridor logic:**

```text
const corridorRoll = rand();
if (corridorRoll < 0.20) {
  // Somalia corridor
  source = WEIGHTED_SOURCES[...]
  target = SOMALIA_TARGETS[...]
} else if (corridorRoll < 0.50) {
  // MENA & Global South corridor (expanded)
  source = WEIGHTED_SOURCES[...]
  target = GLOBAL_SOUTH_TARGETS[...]
} else if (corridorRoll < 0.75) {
  // USA corridor
  source = USA_THREAT_SOURCES[...]
  target = USA_TARGETS[...]
} else {
  // EU corridor
  source = EU_THREAT_SOURCES[...]
  target = EU_TARGETS[...]
}
```

### New target entries to add

| Country | Cities | Coordinates |
|---------|--------|-------------|
| Egypt | Cairo, Alexandria | 30.04/31.23, 31.20/29.92 |
| Saudi Arabia | Riyadh, Jeddah | 24.71/46.67, 21.49/39.19 |
| Algeria | Algiers, Oran | 36.75/3.04, 35.70/-0.63 |
| Pakistan | Islamabad, Karachi | 33.69/73.04, 24.86/67.01 |
| India | Mumbai, New Delhi | 19.08/72.88, 28.61/77.21 |
| Qatar | Doha | 25.29/51.53 |
| Angola | Luanda | -8.84/13.23 |

This gives Somalia 20% of attacks while spreading the remaining 30% across a much wider set of countries, making the overall map look more globally diverse and less focused on one region.
