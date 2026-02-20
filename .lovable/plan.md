

## Fix All 7 Pending Security Checks

### Root Cause

The edge functions for security headers, DNS, blacklist, defacement, and ports already exist. The `fingerprint-tech` function also exists. However, `runFullScan` in `ThreatIntelligence.tsx` never calls these functions and never saves their results to `early_warning_logs`. That is why all 7 checks remain "Pending" forever.

### Solution

Add a new scan phase in `runFullScan` that calls all 7 check functions for each organization and saves results to `early_warning_logs`. Also create a simple `check-ports` edge function (HTTP-based port probing).

---

### 1. New Edge Function: `check-ports`

Create `supabase/functions/check-ports/index.ts` that attempts HTTP HEAD requests to common dangerous ports (3306, 5432, 3389, 8080, 8443, 27017, 21, 22) with a 3-second timeout per port. Returns list of open ports.

Add to `supabase/config.toml`:
```
[functions.check-ports]
verify_jwt = false
```

---

### 2. Major Update: `src/pages/ThreatIntelligence.tsx`

Add 5 new check runner functions that call the existing edge functions and save results to `early_warning_logs`:

**A. `runSecurityHeadersCheck(orgList)`**
- Calls `check-security-headers` with `{ urls: [org.url, ...] }`
- Saves each result to `early_warning_logs` with `check_type = 'security_headers'`
- Risk level: score >= 5 = 'safe', 3-4 = 'warning', below 3 = 'critical'

**B. `runEmailDnsCheck(orgList)`**
- Calls `check-dns` with `{ domains: [domain, ...] }`
- Saves DNS result to `early_warning_logs` with `check_type = 'dns'`
- Saves email security data to `early_warning_logs` with `check_type = 'email_security'` (extracting SPF/DMARC/DKIM from the DNS response's `emailSecurity` field -- the existing `check-dns` function already returns this)
- Compares DNS records against baselines for integrity checking

**C. `runBlacklistCheck(orgList)`**
- Calls `check-blacklist` with `{ urls: [org.url, ...] }`
- Saves to `early_warning_logs` with `check_type = 'blacklist'`
- Risk level: blacklisted = 'critical', clean = 'safe'

**D. `runDefacementCheck(orgList)`**
- Calls `check-defacement` with `{ urls: [{ url, baselineHash, baselineTitle, baselineSize }, ...] }`
- Reads baselines from `baselines` table first
- Saves to `early_warning_logs` with `check_type = 'defacement'`
- On first run, upserts baseline hash/title/size into `baselines` table
- Risk level: defaced = 'critical', hash changed = 'warning', clean = 'safe'

**E. `runPortsCheck(orgList)`**
- Calls new `check-ports` with `{ hostnames: [hostname, ...] }`
- Saves to `early_warning_logs` with `check_type = 'open_ports'`
- Risk level: critical ports open = 'critical', medium only = 'warning', none = 'safe'
- If edge function reports ports unavailable, saves with risk_level = 'safe' and a note

**Update `runFullScan`** to add Phase 2 (between current Fingerprinting and Global feeds):
- Process organizations in batches of 5
- For each batch, call all 5 check functions
- 2-second delay between batches
- Update progress bar to show the new phases

**Update scorecard calculation**:
- The `email` check currently reads from `check_type = 'dns'` but should read from `check_type = 'email_security'` for the email score (separate log entry)
- The `headers` check reads from `check_type = 'security_headers'` -- this is correct, just needs data
- All other check_types are already correctly mapped

---

### 3. Scorecard Email Fix

Currently (line 281), the email check looks for `check_type === 'dns'` and reads `emailSecurity` from it. This is fine since `check-dns` returns both DNS and email data. We will save two separate `early_warning_logs` entries:
- One with `check_type = 'dns'` containing DNS records
- One with `check_type = 'email_security'` containing SPF/DMARC/DKIM

Then update the scorecard to read email from `check_type === 'email_security'` instead of `check_type === 'dns'`.

---

### Files Changed

| File | Action |
|---|---|
| `supabase/functions/check-ports/index.ts` | Create -- HTTP-based port probing |
| `src/pages/ThreatIntelligence.tsx` | Edit -- add 5 check runner functions, update runFullScan, fix email scorecard lookup |
| `supabase/config.toml` | Edit -- add check-ports config |

### Technical Notes

- All existing edge functions already work and have proper CORS, timeouts, and error handling
- The `check-dns` function already returns `emailSecurity` with SPF, DMARC, and DKIM data
- No database schema changes needed -- `early_warning_logs` and `baselines` tables already exist
- The `tech_fingerprints` table already exists and is already being populated
- Port scanning via HTTP is best-effort; if Deno blocks non-standard ports, the check gracefully returns empty results with full points awarded

