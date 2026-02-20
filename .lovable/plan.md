

## Three Priority Features: Remediation Reports, Incident Playbooks, Score Trend History

---

### Feature 1: Automated Remediation Reports

The existing `generate-report` edge function creates basic PDFs with check results. We need to enhance it to include actionable, step-by-step remediation instructions for each failing check.

**Edge Function: `generate-report/index.ts`**
- Add a comprehensive remediation map that generates specific fix instructions based on actual check results from `early_warning_logs`, `ssl_logs`, `ddos_risk_logs`, and `tech_fingerprints`
- For each failing area, include: what is wrong, why it matters, exact steps to fix, estimated time
- Example remediation entries:
  - No CDN/WAF/Rate Limiting: "Step 1: Sign up for Cloudflare free tier. Step 2: Update DNS nameservers. Step 3: Enable WAF rules. Time: 30 minutes."
  - Missing HSTS: "Add `Strict-Transport-Security: max-age=31536000` to your web server config. Time: 5 minutes."
  - No SPF/DMARC: "Add TXT record `v=spf1 ...` to your DNS. Add `_dmarc.domain TXT v=DMARC1; p=reject`. Time: 10 minutes."
  - Exposed database ports: "Block ports 3306/5432/27017 in your firewall immediately. Time: 5 minutes."
  - Expired/invalid SSL: "Renew SSL certificate. Use Let's Encrypt (free) or contact your certificate provider. Time: 15 minutes."
- Add a new PDF page for recommendations, prioritized by severity (critical first)
- Query `early_warning_logs`, `ssl_logs`, `ddos_risk_logs`, `tech_fingerprints` in addition to existing `security_checks` and `alerts`
- Include a priority ranking: Critical (fix today), High (fix this week), Medium (fix this month)

**Frontend: `Reports.tsx`**
- Add a "Remediation Report" option (checkbox or toggle) alongside the existing PDF download
- When enabled, the generated PDF includes the remediation section
- Add a "Preview Recommendations" section below the existing report preview showing what fix instructions will be included
- Pass a `includeRemediation: true` flag to the edge function

---

### Feature 2: Incident Response Playbooks

Pre-built step-by-step procedures that appear when specific alert types trigger. These are stored in a new database table and linked to alert categories/severities.

**New Database Table: `playbooks`**
```sql
CREATE TABLE public.playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  threat_type text NOT NULL,
  severity text NOT NULL DEFAULT 'all',
  steps jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);
```
- `threat_type` values: defacement, ddos, dns_hijack, ssl_expiry, data_breach, phishing, port_exposure, email_spoofing, malware, general
- `steps` is a JSON array of objects: `{ step: 1, title: "...", description: "...", priority: "immediate|within_1h|within_24h" }`
- RLS: All authenticated can read, SuperAdmin/Analyst can write

**Seed playbooks** (via insert query, not migration) for these threat types:
1. **Website Defacement** (7 steps): Screenshot evidence, contact hosting, restore backup, change passwords, check access logs, update CMS, notify stakeholders
2. **DDoS Attack** (6 steps): Enable Cloudflare Under Attack mode, contact ISP, enable rate limiting, monitor traffic, document attack, post-incident review
3. **DNS Hijack** (6 steps): Verify DNS records, lock domain registrar, update nameservers, flush DNS caches, enable DNSSEC, audit DNS access
4. **SSL Certificate Expiry** (4 steps): Renew certificate, install new cert, verify HTTPS, enable auto-renewal
5. **Data Breach** (8 steps): Isolate systems, preserve evidence, assess scope, notify authorities, reset credentials, patch vulnerability, notify affected parties, post-incident report
6. **Phishing Domain** (5 steps): Document the phishing site, report to domain registrar, notify employees, block domain in DNS, monitor for new variants
7. **Exposed Ports** (4 steps): Close ports in firewall, audit services, restrict access to VPN, verify closure
8. **Email Spoofing** (4 steps): Add SPF record, add DMARC with reject policy, add DKIM, monitor DMARC reports

**New Page: `/playbooks` (or section within Incidents page)**
- List all playbooks with threat type, severity, and step count
- Click to expand and see full step-by-step procedure
- Each step shows: step number, title, detailed description, priority tag (immediate/within 1h/within 24h), and a checkbox for tracking completion

**Integration with Alerts:**
- On the Alert Detail page (`AlertDetail.tsx`), add a "Response Playbook" section
- Auto-match the alert to a playbook based on the alert source/title keywords (e.g., alert with "defacement" matches the defacement playbook, alert with "SSL" matches SSL playbook)
- Show the matched playbook steps inline with completion checkboxes
- Add a sidebar link for "Playbooks" in the navigation

---

### Feature 3: Attack Surface Score Trend History

The `risk_history` table already exists and has 60 records. The Dashboard already shows a 30-day national trend chart. OrgDetail already shows per-org score history. The gap is: (1) scores aren't being recorded after TI scans, and (2) there's no comparative trend view.

**Record scores after scans:**
- In `ThreatIntelligence.tsx`, after `calculateScorecards` runs during a full scan, insert a `risk_history` entry for each organization with their current percentage score
- Also update the `organizations.risk_score` field with the latest scorecard percentage
- This ensures trend data accumulates over time

**New Dashboard Section OR Enhancement to OrgDetail:**
- On the OrgDetail page, enhance the existing score history chart to show:
  - Score trend line (already exists)
  - Color-coded zones: green (80-100), yellow (60-80), orange (40-60), red (0-40)
  - Trend direction indicator: arrow up/down with delta from previous week
  - "Improving" / "Declining" / "Stable" label based on last 4 data points
- On the Organizations list page, add a small sparkline or trend arrow next to each org's score showing if they're improving or declining

**Score Recording in TI scan (`ThreatIntelligence.tsx`):**
- After scorecards are calculated in `runFullScan`, add:
```typescript
for (const card of scorecards) {
  await supabase.from('risk_history').insert({
    organization_id: card.org.id,
    score: card.percentage,
  });
  await supabase.from('organizations').update({
    risk_score: card.percentage,
    status: card.percentage >= 75 ? 'Secure' : card.percentage >= 50 ? 'Warning' : 'Critical',
    last_scan: new Date().toISOString(),
  }).eq('id', card.org.id);
}
```

---

### Files Changed

| File | Action |
|---|---|
| Migration SQL | Create `playbooks` table with RLS |
| Insert SQL | Seed 8 default playbooks with step-by-step procedures |
| `supabase/functions/generate-report/index.ts` | Enhance PDF to include remediation instructions from all monitoring tables |
| `src/pages/Reports.tsx` | Add remediation toggle, preview recommendations section |
| `src/pages/AlertDetail.tsx` | Add matched playbook display with completion checkboxes |
| `src/pages/ThreatIntelligence.tsx` | Record risk_history entries and update org scores after scan |
| `src/pages/OrgDetail.tsx` | Enhance trend chart with color zones and trend direction |
| `src/pages/Organizations.tsx` | Add trend arrow indicator next to scores |
| `src/components/layout/Sidebar.tsx` | Add Playbooks nav link |
| `src/App.tsx` | Add /playbooks route |
| `src/pages/Playbooks.tsx` | New page: list and view playbooks |

### Technical Notes

- No new edge functions needed for playbooks or score trends -- all client-side
- The `generate-report` edge function enhancement queries additional tables (`early_warning_logs`, `ddos_risk_logs`, `tech_fingerprints`) that it doesn't currently query
- Playbook-to-alert matching uses keyword matching on alert title/source (e.g., "defacement" in title matches defacement playbook)
- Score recording happens at the end of a full scan, not on every individual check
- The `risk_history` table already exists with proper RLS policies

