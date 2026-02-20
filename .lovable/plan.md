

## Plan: Fix Scorecards, Breach Scanning, and Update Logo

This plan addresses three areas: replacing the logo, fixing scorecards showing F/0%, and fixing breach scanning.

---

### 1. Replace Logo in Sidebar and Add to Threat Map

**File: Copy uploaded logo to `src/assets/logo.png`**
- Replace the existing `src/assets/logo.png` with the uploaded "Somalia Cyber Defense" shield logo

**File: `src/pages/ThreatMap.tsx`**
- Import the logo and add it next to the "Threat Map" header title (lines 974-980)

---

### 2. Fix Scorecards: Add Manual Name Mapping Dictionary

The fuzzy matching already works for exact and prefix matches, but several organization names in the monitoring logs differ significantly from the `organizations` table. A manual mapping dictionary is needed.

**Mismatches identified from database:**

| Log Name | Organizations Table Name | Why Fuzzy Fails |
|---|---|---|
| SALAMA BANK | Salaam Bank | Different spelling (salama vs salaam) |
| Office of the President | Villa Somalia | Completely different name |
| Mogadishu University | (no match) | Not in organizations table |
| SIMAD University | (no match) | Not in organizations table |
| Ministry of Fisheries | Ministry of Fishery - Fishery License / Ministry of Fishery and Blue economy | "fisheries" vs "fishery" |
| Dahabshiil Bank | Dahabshiil International Bank | Prefix match works |
| Ministry of Communications | Ministry of Communications and Technology | Prefix match works |
| Ministry of Health | Ministry of Health Somalia | Prefix match works |
| Premier Bank | Premier Bank Somalia | Prefix match works |

**File: `src/pages/ThreatIntelligence.tsx`**

- Add a `NAME_ALIASES` dictionary mapping log names to organization names (lines ~89-103):
  ```
  SALAMA BANK -> Salaam Bank
  Office of the President -> Villa Somalia
  Ministry of Fisheries -> Ministry of Fishery
  SIMAD University -> (keep for future)
  Mogadishu University -> (keep for future)
  ```

- Update `orgNameMatches` to check aliases before fuzzy matching: if the normalized log name has an alias, also try matching the alias against the org name

---

### 3. Fix Breach Scanning

**Problem:** The `check-breaches` edge function exists and works, but the HIBP API key set as a secret may not be reaching it, and the frontend doesn't pass it as a fallback.

**File: `supabase/functions/check-breaches/index.ts`**
- Add `apiKey` to the destructured request body as a fallback:
  ```
  const HIBP_API_KEY = Deno.env.get('HIBP_API_KEY') || apiKey || '';
  ```
- Add console logging for debugging (API key presence, domain being checked)

**File: `src/pages/ThreatIntelligence.tsx`**
- In `runBreachCheck` (line ~549), before the loop, attempt to read the HIBP API key from a `settings` table and pass it in the request body as `apiKey`
- Update the status display logic to remove "Limited" status and use clearer statuses: "Not Checked", "Clean", "X Breaches", "Error", "No API Key"
- Fix the breach results table column for `source` -- show `method` field from the edge function response to distinguish HIBP email search vs free domain match

**Database migration:**
- Create `settings` table if it doesn't exist (for storing the HIBP API key from the UI)

---

### Technical Summary

| File | Changes |
|---|---|
| `src/assets/logo.png` | Replace with uploaded logo |
| `src/pages/ThreatMap.tsx` | Add logo import and display in header |
| `src/pages/ThreatIntelligence.tsx` | Add NAME_ALIASES dict, update orgNameMatches, pass apiKey in breach requests, fix status display |
| `supabase/functions/check-breaches/index.ts` | Accept apiKey from request body as fallback |
| Database migration | Create `settings` table for API key storage |

