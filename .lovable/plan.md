

## Make ITU Assessment Trigger Real Scans Before Evaluating

### Problem

When you run the ITU National Cybersecurity Index assessment for a telecom organization, it only reads existing data from the database. If no recent scans have been run for that organization (or others), the assessment produces inaccurate results -- showing controls as "failing" simply because monitoring data is missing, not because the organization is actually non-compliant.

### Solution

Modify the ITU assessment flow to trigger real security scans for the selected organization (and optionally all monitored organizations) before evaluating the ITU controls. This ensures the assessment is based on fresh, real data.

### Files Modified

| File | Change |
|---|---|
| `src/lib/compliance/assess.ts` | Add a `runFreshScans()` helper inside `assessITU` that triggers `run-security-checks`, `check-ssl`, `check-dns`, `fingerprint-tech`, and `fetch-threat-intel` edge functions for the target org before reading the data. Also trigger `run-security-checks` for all monitored orgs (needed for national-level ITU controls like government SSL coverage). |
| `src/lib/compliance/assess.ts` | Update the `runAssessment` entry point to pass the `onProgress` callback into `assessITU` so users see scan progress ("Scanning telecom org...", "Checking SSL across 12 orgs...", etc.) |

### Technical Details

**1. Pre-scan step in assessITU (assess.ts)**

Before the existing cross-organization data fetch, add a new phase:

```
Phase 1: Trigger fresh scans for the selected org
  - invoke('run-security-checks', { org_id })  -- covers uptime, SSL, headers, DNS, DDoS, WAF
  - invoke('check-dns', { domains: [org.domain] })  -- email auth (SPF/DMARC/DKIM)
  - invoke('fingerprint-tech', { url: org.url })  -- tech stack detection
  - invoke('fetch-threat-intel', { org_id })  -- threat intelligence

Phase 2: Trigger run-security-checks for ALL monitored orgs
  - Loop through all active organizations_monitored
  - Invoke 'run-security-checks' for each (with 1s delay between calls)
  - This ensures national-level controls (ITU-T4 gov SSL, ITU-T5 DDoS coverage) have current data

Phase 3: Short delay (2 seconds) to allow database writes to settle

Phase 4: Proceed with the existing assessITU logic (read data, evaluate controls)
```

**2. Progress reporting**

The `assessITU` function signature changes to accept `onProgress` callback:

```typescript
async function assessITU(orgId: string, d: any, onProgress?: (msg: string) => void)
```

Progress messages will be:
- "Running security scans for [org name]..."
- "Scanning DNS & email authentication..."  
- "Fingerprinting technology stack..."
- "Scanning all organizations for national assessment (X/Y)..."
- "Evaluating ITU controls..."

**3. Error handling**

Individual scan failures will be caught and logged but won't block the assessment. If a scan fails, the assessment falls back to existing data (same as current behavior) for that specific check.

### Expected Result

- Clicking "Run Assessment" on ITU-NCI now triggers real scans first
- The assessment takes longer (30-60 seconds depending on org count) but produces accurate, real-time results
- Progress messages keep the user informed during the scan phase
- All ITU technical controls (T1-T7) reflect actual current security posture
- Works for any sector including telecom

