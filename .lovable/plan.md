

## Robust PDF Reports + Populate Empty Tabs (Threat Feed, Phishing, Breaches)

### Problem Summary

1. **PDF Report is broken**: It queries the `security_checks` table which links via `asset_id`, not `organization_id`. The real monitoring data lives in `uptime_logs` (867 rows), `ssl_logs` (153), `ddos_risk_logs` (85), and `early_warning_logs` (613 across 6 check types). The PDF shows "0 Checks Passed, 0 Checks Failed" because it's looking at the wrong data.

2. **Threat Feed, Phishing, Breaches tabs are empty**: These tabs only show data that was fetched during the current browser session (in-memory state). When you navigate to the page, they show "No data yet" because no scan has been run in this session. They should load persisted data from the database on mount.

3. **Phishing Domains table is empty** (0 rows in DB) — the phishing check edge function works but results were never persisted because the scan hasn't been run successfully yet, or the domains didn't resolve.

---

### Part 1: Rewrite PDF Report (Edge Function)

**File: `supabase/functions/generate-report/index.ts`**

Completely rewrite the `generatePDF` function to use actual monitoring data instead of `security_checks`:

**Page 1 - Executive Summary:**
- Organization name, domain, sector, region, date range
- Risk Score gauge (from `organizations.risk_score`)
- Security Posture Summary: counts from real monitoring tables
  - SSL Status (from `ssl_logs` — valid/expired/expiring)
  - Uptime (from `uptime_logs` — percentage calculation)
  - DDoS Protection (from `ddos_risk_logs` — CDN/WAF/rate limiting)
  - Security Headers grade (from `early_warning_logs` check_type=security_headers)
  - Email Security (from `early_warning_logs` check_type=email_security — SPF/DMARC/DKIM)
  - Open Ports (from `early_warning_logs` check_type=open_ports)
  - Defacement Status (from `early_warning_logs` check_type=defacement)
  - DNS Integrity (from `early_warning_logs` check_type=dns)
  - Blacklist Status (from `early_warning_logs` check_type=blacklist)

Each check shows: Check Type, Status (PASS/FAIL/WARN), Details, Timestamp

**Page 2 - Early Warning Details:**
- Table of all early_warning_logs for the org in the date range
- Grouped by check_type with most recent result highlighted
- Risk level color coding

**Page 3 - Threat Intelligence:**
- Summary of threat feed findings relevant to this org's tech stack
- Query `tech_fingerprints` for org, then show relevant CVEs from external feed
- Phishing domains found (from `phishing_domains` table)
- Breach exposure summary

**Page 4 - Alert History:**
- All alerts for the org in the date range
- Severity breakdown
- Status breakdown (open/ack/closed)

**Page 5 - Remediation Plan (if toggled on):**
- Keep the existing remediation logic (already works well)
- Add Early Warning-specific remediations

The key data queries change from:
```
security_checks (broken - wrong join)
```
To:
```
uptime_logs, ssl_logs, ddos_risk_logs, early_warning_logs, tech_fingerprints, phishing_domains, alerts, risk_history
```

---

### Part 2: Load Persisted Data on Mount (Threat Intelligence Page)

**File: `src/pages/ThreatIntelligence.tsx`**

Currently the Phishing and Breaches tabs only show in-memory state from the latest scan. Fix by loading persisted data from the database when the page loads:

**Phishing Tab Fix:**
- On mount, query `phishing_domains` table and convert to `PhishingResult[]` format
- Group by `organization_name` to build the results structure
- Show DB data immediately; scan results override when a scan runs

**Breaches Tab Fix:**
- On mount, query `threat_intelligence_logs` where `check_type = 'breach'` 
- Since no breach data is persisted currently, also persist breach results to `threat_intelligence_logs` when a scan runs (the `runBreachCheck` function currently only sets in-memory state)
- Add an insert to `threat_intelligence_logs` for each breach result with the relevant details

**Threat Feed Tab Fix:**
- Auto-trigger `fetchThreatFeed()` on mount when the threats tab is selected, instead of waiting for a full scan
- The edge function `fetch-threat-intel` works — it just needs to be called

---

### Part 3: Persist Breach Results to Database

**File: `src/pages/ThreatIntelligence.tsx`** (in `runBreachCheck`)

Currently breach results are only stored in React state. Add persistence:
- After setting `setBreachResults`, also insert into `threat_intelligence_logs` for each org:
```typescript
await supabase.from('threat_intelligence_logs').insert({
  organization_id: org.id,
  organization_name: orgName,
  check_type: 'breach',
  risk_level: result.riskLevel || 'info',
  details: { breaches: result.breaches, allRecentBreaches: result.allRecentBreaches?.slice(0, 10) }
});
```

---

### Part 4: Enhanced Report Preview (Frontend)

**File: `src/pages/Reports.tsx`**

Enhance the preview section to show real monitoring data:
- Query `early_warning_logs`, `ssl_logs`, `ddos_risk_logs`, `uptime_logs` for the selected org
- Show a preview table matching what will be in the PDF:
  - SSL: Valid/Expired + days until expiry
  - Uptime: percentage + last status
  - DDoS: CDN/WAF/Rate Limiting status
  - Headers: score/grade
  - Email: SPF/DMARC/DKIM
  - Ports: open/critical count
  - Defacement: status
  - DNS: status
  - Blacklist: status
- Add checkboxes for which sections to include in PDF: Early Warning, Threat Intel, Alert History, Remediation
- Show actual counts instead of all zeros

---

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/generate-report/index.ts` | Major rewrite - query real monitoring tables, generate multi-page PDF with Early Warning, Threat Intel, Alerts, Remediation |
| `src/pages/Reports.tsx` | Enhanced preview with real monitoring data, section toggles for PDF content |
| `src/pages/ThreatIntelligence.tsx` | Load phishing from DB on mount, persist breach results, auto-fetch threat feed when tab selected |

### Technical Notes

- No database changes needed — all tables already exist with the right data
- The `security_checks` table (150 rows) is still used in the PDF as a fallback but the primary data source switches to the monitoring tables
- The `phishing_domains` table is empty (0 rows) so the phishing tab will still show empty until a scan runs — but now it will persist results and show them on reload
- The threat feed edge function already works and returns real CVE/malware data from CISA, NVD, URLhaus, and Feodo Tracker
- PDF generation uses raw PDF operators (no library) — the rewrite maintains this approach but adds more pages

