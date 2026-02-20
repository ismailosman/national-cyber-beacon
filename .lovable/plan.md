

## Fix Scorecards: Match Monitoring Data by Name Instead of ID

### Root Cause

The scorecards show all F/0% because of an **organization ID mismatch**:

- The `organizations` table (36 orgs) has one set of UUIDs
- The monitoring logs (`uptime_logs`, `ssl_logs`, `ddos_risk_logs`, `early_warning_logs`) were populated by the scheduled scan using IDs from the `organizations_monitored` table -- a completely different set of UUIDs
- The `calculateScorecards` function (line 301-305) filters logs by `organization_id === org.id`, which matches zero rows since the IDs come from different tables
- Result: every check category returns "pending" status, giving 0 points and grade F

The database has real data: 969 uptime logs, 204 SSL logs, 119 DDoS logs, and 615 early warning logs -- but none of it is being matched.

### Fix Strategy

Change `calculateScorecards` to match monitoring data to organizations by **name** instead of by `organization_id`. This requires a fuzzy name-matching function since the names don't always match exactly:

| Log Name | Organizations Table Name |
|---|---|
| Dahabshiil Bank | Dahabshiil International Bank |
| Ministry of Communications | Ministry of Communications & Technology |
| Ministry of Education | Ministry of Education (trailing space) |
| Ministry of Health | Ministry of Health Somalia |
| Premier Bank | Premier Bank Somalia |

### Technical Changes

**File: `src/pages/ThreatIntelligence.tsx`**

1. **Add a name-matching helper function** that normalizes and compares organization names:
   - Trim whitespace, lowercase
   - Try exact match first
   - Then try "starts with" match (handles "Premier Bank" matching "Premier Bank Somalia")
   - Then try "contains" match for partial names

2. **Update `calculateScorecards` (lines 289-427)** to match logs by name instead of by `organization_id`:
   - Replace `filter(u => u.organization_id === org.id)` with name-based matching
   - Apply to all 5 data sources: uptime_logs, ssl_logs, ddos_risk_logs, early_warning_logs, tech_fingerprints
   - Also match by `organization_id` as a secondary match (for any data created by new scans that use correct IDs)

3. **Increase query limits**: Currently limited to 200-500 rows per table. With 36 orgs and multiple checks, increase limits to ensure all data is fetched (especially uptime_logs at 969 rows -- current 500 limit truncates data).

### Expected Outcome

After the fix:
- Organizations with existing monitoring data will show accurate scores based on their uptime, SSL validity, DDoS protection, email security, headers, ports, defacement, DNS, blacklist, and software checks
- Organizations without monitoring data will still show "pending" (correctly indicating no data yet)
- Running a new "Full Scan" will store data with the correct `organization_id` from the `organizations` table, so future matches will work by both name and ID

