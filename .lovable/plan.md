

## Automated Compliance Assessment Engine + Threat Feed Data Fix

### Overview

Two changes: (1) Make the Compliance page functional by adding client-side auto-assessment logic that queries existing monitoring tables and maps results to CIS Controls, plus manual assessment forms for controls that cannot be auto-assessed. (2) Fix the Threat Feed tab which already has a working edge function (`fetch-threat-intel`) but the data may not be reaching the UI due to edge function timeout or rendering issues.

---

### Part 1: Compliance Auto-Assessment

#### 1A. New Database Table: `compliance_assessments`

Create via migration:

```sql
CREATE TABLE public.compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  control_code text NOT NULL,
  framework text NOT NULL DEFAULT 'cis-v8',
  status text NOT NULL DEFAULT 'not_assessed',
  assessment_type text NOT NULL DEFAULT 'manual',
  evidence text DEFAULT '',
  evidence_data jsonb DEFAULT '{}'::jsonb,
  assessed_by text DEFAULT 'System (Auto)',
  assessed_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(organization_id, control_code, framework)
);

ALTER TABLE public.compliance_assessments ENABLE ROW LEVEL SECURITY;

-- RLS policies matching existing pattern
CREATE POLICY "All authenticated read compliance_assessments" ON public.compliance_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Analyst full compliance_assessments" ON public.compliance_assessments FOR ALL TO authenticated USING (has_role(auth.uid(), 'Analyst'::app_role)) WITH CHECK (has_role(auth.uid(), 'Analyst'::app_role));
CREATE POLICY "Auditor read compliance_assessments" ON public.compliance_assessments FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Auditor'::app_role));
CREATE POLICY "SuperAdmin full compliance_assessments" ON public.compliance_assessments FOR ALL TO authenticated USING (has_role(auth.uid(), 'SuperAdmin'::app_role)) WITH CHECK (has_role(auth.uid(), 'SuperAdmin'::app_role));
```

#### 1B. Client-Side Auto-Assessment Logic

Add an `assessOrganization` function in `Compliance.tsx` that queries existing monitoring tables and maps results to the 20 CIS Controls. No new edge function needed -- all data already exists in:
- `organizations_monitored` -- for CIS-1.1
- `tech_fingerprints` -- for CIS-2.1, CIS-7.1, CIS-12.1
- `uptime_logs`, `ssl_logs`, `ddos_risk_logs`, `early_warning_logs` -- for CIS-3.10, CIS-4.1, CIS-4.2, CIS-13.1, CIS-16.1, CIS-16.11
- `early_warning_logs` (check_type = 'security_headers') -- for CIS-4.1, CIS-16.1
- `early_warning_logs` (check_type = 'open_ports') -- for CIS-4.1, CIS-16.11

**Control-to-data mapping (12 auto/hybrid, 8 manual):**

| Control | Type | Data Source | Pass Condition |
|---|---|---|---|
| CIS-1.1 | Hybrid | organizations_monitored + tech_fingerprints | Org record exists with complete fields AND tech fingerprint exists |
| CIS-2.1 | Auto | tech_fingerprints | Record exists with detected technologies |
| CIS-3.10 | Auto | ssl_logs + early_warning_logs (security_headers) | Valid SSL AND HSTS header present |
| CIS-4.1 | Hybrid | early_warning_logs (security_headers + open_ports) | 5+ headers AND no critical ports |
| CIS-4.2 | Hybrid | ddos_risk_logs | Has CDN AND WAF AND rate limiting |
| CIS-7.1 | Hybrid | tech_fingerprints + threat_intelligence_logs | Tech fingerprint exists, no critical vulns |
| CIS-12.1 | Hybrid | tech_fingerprints + early_warning_logs | Software versions current, HSTS present |
| CIS-13.1 | Auto | uptime_logs + ssl_logs + ddos_risk_logs + early_warning_logs | Org appears in ALL four monitoring tables |
| CIS-16.1 | Hybrid | early_warning_logs (security_headers) | CSP + X-Frame-Options + X-Content-Type-Options present |
| CIS-16.11 | Hybrid | early_warning_logs (open_ports) | No database ports (3306, 5432, 27017) exposed |
| CIS-5.1 through CIS-18.1 | Manual | User input | Manual assessment form |

Each auto-assessment result is upserted into `compliance_assessments` with `assessment_type = 'auto'` and `expires_at` set to 6 hours from now.

#### 1C. Manual Assessment Modal

For manual-only controls, add an "Assess" button in the Status column. Clicking it opens a Dialog with:
- Control name and description
- Radio buttons: Passing, Partial, Failing, Not Applicable
- Evidence textarea
- Save button that upserts to `compliance_assessments` with `assessment_type = 'manual'` and `expires_at` = 90 days from now

#### 1D. "Run Assessment" Button

Add next to the org/framework selectors. When clicked:
- Shows progress indicator
- Queries all monitoring tables for the selected org
- Runs auto-assessment for each auto/hybrid control
- Upserts results to `compliance_assessments`
- Updates score cards in real-time

#### 1E. Score Calculation Update

Replace the current `control_results`-based scoring with `compliance_assessments`-based scoring:
- Score = (passing * 1.0 + partial * 0.5) / total_assessed * 100
- Show grade: 90-100% Compliant (green), 70-89% Partially Compliant (yellow), 50-69% Needs Improvement (orange), below 50% Non-Compliant (red)
- Show "X/20 controls assessed" denominator

#### 1F. Status Badges

Replace generic status with:
- Passing (green) -- auto or manual pass
- Partial (yellow) -- partially compliant
- Failing (red) -- non-compliant
- Not Assessed (gray) -- manual control, not yet assessed
- Check Failed (orange) -- auto-assessment data source unavailable

Show "Last assessed: X ago" and assessment type (Auto/Manual) as small badges.

---

### Part 2: Fix Threat Feed Data

The `fetch-threat-intel` edge function already exists and fetches all 4 sources (CISA KEV, URLhaus, NVD, Feodo Tracker). The frontend already calls it via `fetchThreatFeed()` and renders the data. The issue is likely the edge function timing out or returning errors silently.

#### 2A. Improve Error Visibility

Update `fetchThreatFeed` in `ThreatIntelligence.tsx` to:
- Log the raw response for debugging
- Show a warning banner if the response is empty or partial
- Show which sources succeeded/failed

#### 2B. Add Source Status Indicators

At the top of the Threat Feed tab, show:
- "Sources: CISA KEV (40 entries), NVD (15 entries), URLhaus (30 entries), Feodo (20 entries)"
- Or "CISA KEV (failed), NVD (15 entries), ..." if a source failed

No new edge functions needed -- the existing `fetch-threat-intel` already handles all 4 sources with proper error handling per source.

---

### Files Changed

| File | Action |
|---|---|
| Migration SQL | Create `compliance_assessments` table with RLS |
| `src/pages/Compliance.tsx` | Major rewrite -- add auto-assessment logic, manual assessment modal, Run Assessment button, updated scoring |
| `src/pages/ThreatIntelligence.tsx` | Minor edit -- add source status indicators to Threat Feed tab, improve error logging |

### Technical Notes

- No new edge functions needed for compliance -- all assessment queries run client-side against existing tables
- The `compliance_assessments` table uses a unique constraint on (organization_id, control_code, framework) for upsert
- Auto-assessments expire after 6 hours; manual after 90 days
- The existing `control_results` table is NOT used (it's empty and maps to control UUIDs); the new `compliance_assessments` table maps to control codes (text) for simplicity
- The threat feed edge function already works -- changes are UI-side error visibility improvements only
- All 20 existing CIS Controls in the `controls` table will be mapped to the assessment logic

