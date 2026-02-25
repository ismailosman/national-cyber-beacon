

## Fix Missing Country Flags on Cyber Map

### Problem
When clicking countries on the map, the country name comes from Mapbox's `name_en` property, which often differs from the names in the `COUNTRY_ISO` lookup. If there's no match, the flag falls back to the UN flag (`'un'`). Known mismatches include:
- **Republic of the Congo** -- Mapbox uses "Republic of the Congo", but `COUNTRY_ISO` only has "Congo"
- **Democratic Republic of the Congo** -- Mapbox uses this full name, but `COUNTRY_ISO` only has "DR Congo"
- **Suriname** -- completely missing from `COUNTRY_ISO`
- **Trinidad and Tobago** -- exists in `COUNTRY_ISO` but the attack data uses "Trinidad" (a separate mismatch)
- **Puerto Rico**, **Bahamas**, **Hong Kong**, **Cambodia** -- missing from `COUNTRY_ISO` but used in attack corridors

### Changes

**File: `src/pages/CyberMap.tsx`** -- Add missing entries to `COUNTRY_ISO`:

Add these new entries to cover Mapbox `name_en` variants and missing countries:

| Key | ISO | Reason |
|-----|-----|--------|
| `Republic of the Congo` | `cg` | Mapbox name variant for Congo |
| `Democratic Republic of the Congo` | `cd` | Mapbox name variant for DR Congo |
| `Suriname` | `sr` | Missing entirely |
| `Puerto Rico` | `pr` | Used in attack data, missing |
| `Bahamas` | `bs` | Used in attack data, missing |
| `Hong Kong` | `hk` | Used in attack data, missing |
| `Cambodia` | `kh` | Used in attack data, missing |
| `Trinidad` | `tt` | Attack data uses short name |
| `Côte d'Ivoire` | `ci` | Mapbox name variant for Ivory Coast |
| `United States of America` | `us` | Mapbox full name |
| `United Kingdom` | `gb` | Mapbox full name |
| `United Arab Emirates` | `ae` | Mapbox full name |
| `Czechia` | `cz` | Mapbox modern name for Czech Republic |
| `Eswatini` | `sz` | Already exists but verifying |
| Additional ~20 countries commonly shown on world maps that could be clicked (e.g., Guyana, Belize, Laos, Brunei, Timor-Leste, etc.) |

This is a single-file change adding approximately 30 new entries to the existing `COUNTRY_ISO` dictionary.

**File: `src/hooks/useLiveAttacks.ts`** -- No changes needed. The `country` field in attack data is used for display in the attack feed sidebar, and those names already have ISO mappings or will be covered by the new entries above.

### Technical Notes
- The `flagcdn.com` CDN uses ISO 3166-1 alpha-2 codes, so all we need are correct two-letter codes
- The fallback `'un'` (UN flag) will still apply for any truly unmapped territory
- No new dependencies or database changes required
