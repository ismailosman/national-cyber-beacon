

## Fix Empty Tech Stack, Phishing, and Breaches Tabs

### Root Cause

The database tables that back these three tabs are **completely empty**:
- `tech_fingerprints`: **0 rows**
- `phishing_domains`: **0 rows**  
- `threat_intelligence_logs` (breach data): **0 rows**

These tables only get populated when a **Full Scan** is run. Since no Full Scan has completed successfully, the on-mount DB queries return nothing and the tabs show "No data yet."

The on-mount code (lines 762-813) correctly tries to load from the DB, but there is nothing to load. Additionally, the **Tech Stack tab has no DB loading at all** -- it only reads from in-memory state set during a scan.

### Fix Strategy

Rather than requiring the user to run a slow Full Scan (which processes 17 organizations sequentially with timeouts), add **per-tab scan buttons** and **load tech fingerprints from DB on mount**.

### Changes to `src/pages/ThreatIntelligence.tsx`

**1. Load tech fingerprints from DB on mount (add to existing useEffect at line 762)**

Inside the `initialRun` useEffect, add a query to `tech_fingerprints` table and convert to the `TechFingerprint` format keyed by URL:

```typescript
supabase.from('tech_fingerprints').select('*').then(({ data: techData }) => {
  if (techData && techData.length > 0) {
    const fp: Record<string, TechFingerprint> = {};
    for (const t of techData) {
      fp[t.url] = {
        url: t.url,
        technologies: {
          webServer: t.web_server, webServerVersion: t.web_server_version,
          language: t.language, languageVersion: t.language_version,
          cms: t.cms, cmsVersion: t.cms_version,
          cdn: t.cdn, jsLibraries: t.js_libraries || [],
        },
        error: null, checkedAt: t.checked_at,
      };
    }
    setTechFingerprints(fp);
  }
});
```

**2. Add per-tab "Run Scan" buttons for each empty tab**

Replace the static "No data yet" messages with actionable scan buttons:

- **Tech Stack tab**: Add a "Scan Tech Stack" button that calls `runFingerprinting(orgs)` directly
- **Phishing tab**: Add a "Scan for Phishing Domains" button that calls `runPhishingCheck(orgs)` directly
- **Breaches tab**: Add a "Check for Breaches" button that calls `runBreachCheck(orgs)` directly

Each button will show a loading spinner while the scan runs, using individual loading states (`techScanning`, `phishingScanning`, `breachScanning`).

**3. Add individual scanning states**

Add three new state variables:
```typescript
const [techScanning, setTechScanning] = useState(false);
const [phishingScanning, setPhishingScanning] = useState(false);
const [breachScanning, setBreachScanning] = useState(false);
```

**4. Empty state UI per tab**

Replace each "No data yet" paragraph with a styled card containing:
- An icon and description explaining what the scan does
- A prominent "Run Scan" button
- A note saying "or use 'Run Full Scan' above to run all checks"

For example, the Tech Stack empty state:
```
[Shield Icon]
No Tech Stack Data Yet
Scan all 17 organizations to detect web servers, CMS platforms, programming languages, and CDN providers.
[Scan Tech Stack Button]
Or click "Run Full Scan" above to run all checks at once.
```

### Files Changed

| File | Action |
|---|---|
| `src/pages/ThreatIntelligence.tsx` | Add tech fingerprint DB loading on mount, add per-tab scan buttons with individual loading states, replace static empty messages with actionable UI |

### Technical Notes

- No database or edge function changes needed -- the scan functions and persistence logic already exist and work correctly
- The per-tab scan buttons call the exact same functions used by Full Scan, just individually
- Once any scan runs successfully, the data persists to the DB and will load automatically on subsequent visits
- The `tech_fingerprints` table uses `onConflict: 'url'` for upsert, which assumes a unique constraint on `url` -- if this fails silently, data still won't persist, but the in-memory state will still display correctly for the current session

