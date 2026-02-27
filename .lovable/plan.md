## Add More Country Rotation Sets

### Problem

Currently there are only 2 sets of 10 countries, so the rotation just alternates between the same two groups repeatedly.

### Solution

Expand `COUNTRY_SETS` to 4-5 sets of 10 countries each, drawing from the countries already in the `COUNTRY_ISO` mapping. This gives much more variety as the list cycles every 30 seconds.

### Changes in `src/pages/ThreatMapStandalone.tsx`

Update the `COUNTRY_SETS` constant to include more sets:

```
Set 1: Ethiopia, Indonesia, Georgia, Ukraine, Kenya, Somalia, United States, India, Pakistan, Brazil
Set 2: Turkey, Nigeria, South Africa, Egypt, Bangladesh, Iran, China, Philippines, Vietnam, Colombia
Set 3: Russia, Japan, Germany, France, United Kingdom, Mexico, Saudi Arabia, Australia, Canada, Israel
Set 4: Thailand, Malaysia, Poland, Romania, Argentina, Morocco, Algeria, Sweden, Netherlands, Iraq
Set 5: Somalia, United States, China, India, Brazil, Russia, Nigeria, Turkey, Iran, Kenya
```

Also add any missing ISO codes to `COUNTRY_ISO` in `src/components/cyber-map/shared.ts` for the new countries (e.g., Japan, Germany, France, UK, Mexico, Saudi Arabia, Australia, Canada, Israel, Thailand, Malaysia, Poland, Romania, Argentina, Morocco, Algeria, Sweden, Netherlands, Iraq).

### Files Modified

- `src/pages/ThreatMapStandalone.tsx` -- expand `COUNTRY_SETS` to 5 rotation groups
- `src/components/cyber-map/shared.ts` -- add missing ISO codes for new countries  
TOP COUNTRIES must show real numbers and 0 and 1