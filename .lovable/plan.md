

## Update "Top Targeted Industries" Section on Threat Map

### Summary
Change the heading from "TOP TARGETED INDUSTRIES" to "TOP TARGETED INDUSTRIES IN SOMALIA" and update the default industries list to Banking, Government, Telecom.

### Changes in `src/pages/ThreatMapStandalone.tsx`

1. **Update heading text** (line 224): Change to `TOP TARGETED INDUSTRIES IN SOMALIA`
2. **Update subtitle** (line 225): Adjust description to reference Somalia specifically
3. **Update `defaultIndustries`** (line 61): Change from `[['Education'], ['Telecommunications'], ['Government']]` to `[['Banking'], ['Government'], ['Telecom']]`
4. **Ensure `INDUSTRIES` array** (line 10+) includes entries for "Banking" and "Telecom" with appropriate icons (e.g., Banking = `🏦`, Telecom = `📡`)

