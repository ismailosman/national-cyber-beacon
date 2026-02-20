

## Fix Breach Data to Be Per-Organization and Add Clickable Detail View

### Problem

The `check-breaches` edge function receives a single flat `orgTechnologies` array containing tech from ALL organizations combined. It then applies the same filter to every domain, resulting in identical breach results for every organization (as seen in the screenshot -- every org shows "TroyHuntMailchimpList" with the same 16,627 records).

### Root Cause

In `ThreatIntelligence.tsx` line 470-472, all tech fingerprints are merged into one flat array:
```typescript
const techNames = Object.values(techFingerprints)
  .flatMap(t => [t.webServer, t.cms, t.language].filter(Boolean));
```

The edge function then uses this single combined set for ALL domains, so every org gets the same matches.

### Changes

**1. Edge Function `check-breaches/index.ts` -- Accept per-org tech stacks**

Modify the function to accept `domains` as objects with per-org technology lists:

```typescript
// Input format changes to:
// domains: [{ domain: "hormuud.com", name: "Hormuud", technologies: ["nginx", "php"] }]
```

For each domain, only match breaches against THAT org's specific technologies rather than a global set. Remove the overly broad `RELEVANT_SERVICES` list -- it causes false matches (e.g., "mailchimp" matching every org even if they don't use Mailchimp).

Instead, only match against:
- The org's detected tech stack (per-org `technologies` array)
- The org's actual domain name (exact match against breach domains)

This ensures Dahabshiil Bank only gets breaches relevant to nginx/PHP (if that's what they use), not breaches for services used by other orgs.

**2. Frontend `ThreatIntelligence.tsx` -- Send per-org tech data**

Update `runBreachCheck` to pass each organization's individual tech fingerprint instead of a merged global list:

```typescript
const domains = orgList.map(o => {
  const tf = techFingerprints[o.url];
  const techs = tf?.technologies 
    ? [tf.technologies.webServer, tf.technologies.cms, tf.technologies.language, 
       ...(tf.technologies.jsLibraries || [])].filter(Boolean) 
    : [];
  return { domain: extractDomain(o.url), name: o.name, technologies: techs };
});
```

Remove the separate `orgTechnologies` parameter.

**3. Frontend `ThreatIntelligence.tsx` -- Make organizations clickable with detail view**

Add a click handler on each organization row in the "Breaches Affecting Our Organizations" table. When clicked, show a Dialog/Sheet with:
- Organization name and domain
- Full list of matched breaches with descriptions
- Data classes exposed
- Breach dates and record counts
- Risk level assessment

Use a state variable `selectedBreachOrg` to track which org is selected, and render a Dialog showing that org's full breach details.

**4. API Recommendation Note**

Add a note in the UI recommending the HIBP (Have I Been Pwned) enterprise API key for domain-specific email breach lookups. The free `/api/v3/breaches` endpoint only returns the global breach catalog -- it cannot search if a specific domain's emails were in a breach. The paid HIBP API (`hibp-api-key` header with `/api/v3/breacheddomain/{domain}`) can search by domain directly. This is already partially noted in the existing UI but will be made more prominent.

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/check-breaches/index.ts` | Accept per-org tech arrays, remove global RELEVANT_SERVICES matching, match only org-specific tech + domain |
| `src/pages/ThreatIntelligence.tsx` | Send per-org tech data, add clickable org rows with breach detail dialog |

### Result

After this change:
- Each organization will only show breaches relevant to its own detected tech stack and domain
- Organizations without matching tech will show zero breaches (accurate)
- Clicking an organization row opens a detailed breach view
- The UI will recommend HIBP API key for deeper domain-specific breach searches

