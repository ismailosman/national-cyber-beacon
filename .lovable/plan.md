

## Plan: Fix PENDING Scorecards, Replace Logo, and Create Storage Bucket

### Root Cause of PENDING

The scorecards show "PENDING" because 19 out of 36 organizations have **no early warning or DDoS scan data**. Here's the breakdown:

| Data Source | Orgs with Data | Notes |
|---|---|---|
| uptime_logs | 36/36 | All matched (correct IDs from recent scan) |
| ssl_logs | 36/36 | All matched (correct IDs from recent scan) |
| early_warning_logs | 17/36 | Only old scan data (matched by name) |
| ddos_risk_logs | 17/36 | Only old scan data (matched by name) |
| tech_fingerprints | 0/36 | No data at all |

For the 19 orgs missing early warning data, 8 out of 10 scorecard checks (email, headers, ports, defacement, dns, blacklist, ddos, software) show PENDING -- only uptime and SSL work.

The previous FK constraint fix allows new scans to save data correctly, but no full scan has been completed since. The fix is to **auto-trigger the missing security checks on page load** so users don't have to manually run a full scan.

---

### Changes

#### 1. Replace Logo
- Copy uploaded `cyber-logo.png` to `src/assets/logo.png`

#### 2. Create Storage Bucket
- Database migration to create a `media` storage bucket with public access and appropriate RLS policies for authenticated uploads

#### 3. Fix PENDING Scorecards (src/pages/ThreatIntelligence.tsx)

**Auto-run missing security checks on page load:**

After `calculateScorecards` runs on mount (line 1018), check if most orgs have pending early warning data. If so, automatically trigger the security checks (headers, DNS/email, blacklist, defacement, ports) in the background -- the same checks that Phase 2 of the full scan runs.

Changes to the `useEffect` at line 932:
- After `calculateScorecards(orgs)` completes, check how many orgs have 0 early_warning_logs
- If more than 50% of orgs are missing data, auto-run security checks in batches of 5 (same as full scan Phase 2)
- Show a progress toast like "Auto-scanning 19 organizations with missing security data..."
- After checks complete, recalculate scorecards
- Also run DDoS check (`check-ddos-risk`) and fingerprinting for orgs missing that data
- This runs only once per session (use a ref flag)

**Increase query limits:**
- `early_warning_logs` limit from 1000 to 2000 (615 existing + new data for 36 orgs x ~6 check types = ~216 more)
- `ddos_risk_logs` limit from 500 to 1000

---

### Technical Summary

| File | Changes |
|---|---|
| `src/assets/logo.png` | Replace with uploaded logo |
| `src/pages/ThreatIntelligence.tsx` | Add auto-scan for orgs with missing data on page load; increase query limits |
| Database migration | Create `media` storage bucket with RLS policies |

