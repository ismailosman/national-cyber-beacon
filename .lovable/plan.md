

## Changes to Threat Map Right Panel

### 1. Show 10 countries instead of 5
Update `COUNTRY_SETS` to contain sets of 10 countries each (merge the current 4 sets of 5 into 2 sets of 10). Both desktop and mobile views will display 10 countries at a time.

### 2. Remove "Top Targeted Industries in Somalia" section
Delete the entire industries block from the right panel (lines 233-248), including the separator above it, and remove the unused `INDUSTRIES` constant, `topIndustries` memo, and `defaultIndustries` variable.

### Technical Details

**File: `src/pages/ThreatMapStandalone.tsx`**

- Change `COUNTRY_SETS` from 4 arrays of 5 to 2 arrays of 10:
  ```
  Set 1: Ethiopia, Indonesia, Georgia, Ukraine, Kenya, Somalia, United States, India, Pakistan, Brazil
  Set 2: Turkey, Nigeria, South Africa, Egypt, Bangladesh, Iran, China, Philippines, Vietnam, Colombia
  ```
- Remove `INDUSTRIES` constant (lines 17-27)
- Remove `topIndustries` useMemo (lines 68-79)
- Remove `defaultIndustries` variable (line 81)
- Remove the "Top Targeted Industries in Somalia" JSX block and its separator from the right panel
