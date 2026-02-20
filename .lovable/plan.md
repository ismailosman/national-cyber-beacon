

## Fix Breaches Tab: Accurate Per-Organization Breach Reporting

### Problem
The current breach detection matches global breaches against organization tech stacks using keyword matching (e.g., "nginx" matching a breach named "nginx-something"). This produces identical false results for all organizations. Real breach detection requires checking if each organization's **email domain** appeared in known data breaches.

### Solution Overview

Replace the broken matching logic with per-domain breach lookups using HIBP domain search (if API key exists) or free alternatives (Mozilla Monitor breach catalog with exact domain matching).

---

### Changes

**1. Rewrite Edge Function `supabase/functions/check-breaches/index.ts`**

Complete rewrite to accept a single `{ domain, organizationName }` request (one org at a time):

- If `HIBP_API_KEY` secret exists: call `https://haveibeenpwned.com/api/v3/breaches?domain={emailDomain}` with the API key header -- this returns only breaches where emails from that specific domain were compromised
- If no API key: fetch the full HIBP breach catalog (free, no key needed) and do **exact domain match only** -- match `breach.Domain === emailDomain` (no fuzzy/keyword matching)
- Also try Mozilla Monitor's free breach API as a secondary source
- Return per-org results: `{ success, organization, domain, breachCount, breaches, isClean, source, note }`
- Deduplicate breaches by name
- Sort by breach date descending

**2. Update Frontend `src/pages/ThreatIntelligence.tsx` -- Breach Check Logic**

Rewrite `runBreachCheck` to call the edge function **once per organization** (not batch):

```text
for each org:
  1. Extract email domain from URL
  2. Call check-breaches with { domain, organizationName }
  3. Store result
  4. Wait 1.5 seconds (rate limiting)
  5. Update progress indicator
```

Add `breachProgress` state to show "Checking breaches... 5/17 organizations" during scan.

**3. Redesign Breaches Tab UI**

Replace current layout with:

- **Summary Banner**: Green "No breaches detected" or red "X organizations have known breaches" based on results
- **Source indicator**: Show "Checked via: HIBP Domain Search" or "Checked via: Free Breach Check (Limited)"
- **Info banner** (if no HIBP key): Yellow banner recommending HIBP API key for comprehensive results
- **Organization table** with columns: Organization, Domain, Status (Clean/X Breaches/Unknown), Breaches Found, Last Checked
- **Status badges**: Green "Clean", Red "X Breaches", Gray "Unknown", Blue "Limited"
- Each row **clickable** -- opens existing breach detail dialog

**4. Enhance Breach Detail Dialog**

When clicking an org row, the dialog shows:
- Organization name and domain
- List of breaches specific to that domain only
- For each breach: name, date, record count, data classes as chips, description, verified badge
- **Recommendation section** based on leaked data types:
  - Passwords leaked: "Force password reset for all @domain accounts"
  - Emails leaked: "Expect increased phishing targeting @domain"
  - Phone numbers leaked: "Expect SMS phishing"
  - IP addresses leaked: "Review network security"

**5. Add HIBP API Key Support**

- Prompt user for `HIBP_API_KEY` secret using the secrets tool (only if they want comprehensive results)
- The edge function checks `Deno.env.get('HIBP_API_KEY')` and uses the appropriate method
- No blocking -- the feature works without the key using free APIs

**6. Remove Old Broken Logic**

- Remove the `allRecentBreaches` field from results (no more "Recent Global Breaches" section showing unrelated breaches)
- Remove tech-stack-based matching entirely
- Remove `techFingerprints` dependency from `runBreachCheck`

---

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/check-breaches/index.ts` | Complete rewrite: per-domain lookup with HIBP API key support + free fallback |
| `src/pages/ThreatIntelligence.tsx` | Rewrite `runBreachCheck` to call per-org, redesign breaches tab UI, enhance detail dialog with recommendations |

### API Recommendation

**Have I Been Pwned API Key** ($3.50/month from https://haveibeenpwned.com/API/Key) is recommended for the most accurate domain-specific breach searches. Without it, the system uses exact domain matching against the free breach catalog, which is less comprehensive but still accurate (no false positives).

