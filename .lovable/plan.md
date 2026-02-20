

## Filter Live Alerts to Last Hour and Fix False Defacement Alerts

### Problem
1. The Live Alerts sidebar shows all open alerts regardless of age -- it should only show alerts created within the last hour
2. The Hormuud Telecom "Website Defaced" alert is a false positive -- the defacement detection is too aggressive with keyword matching (the word "anonymous" appearing in legitimate content like privacy policies)
3. False positives should be prevented by requiring stronger evidence before creating defacement alerts

### Changes

**1. AlertSidebar.tsx -- Filter to last 1 hour only**

Update the query to add a time filter: `.gte('created_at', oneHourAgo)` where `oneHourAgo` is computed as `new Date(Date.now() - 60 * 60 * 1000).toISOString()`. This ensures only alerts from the past hour appear in Live Alerts.

**2. Delete the false Hormuud Telecom alert**

Run a SQL query to close/delete the false defacement alert for Hormuud Telecom:
```sql
UPDATE alerts SET status = 'resolved' WHERE title = 'Website Defaced: Hormuud Telecom' AND status = 'open';
```
Also resolve the other false defacement alerts (Immigration and Custom Authority, SALAMA BANK, Ministry of Education, Ministry of Fisheries) since they were created by the same scan with the same logic issues.

**3. ThreatIntelligence.tsx -- Strengthen defacement alert threshold**

Currently the code creates an alert when `r.status === 'defaced'` (2+ indicators with a phrase match). Strengthen this to require 3+ indicators before generating a critical alert. For 2 indicators, log it as `review_needed` without creating an alert:

```typescript
// Only alert on high-confidence defacement (3+ indicators)
if (r.status === 'defaced' && r.indicatorCount >= 3) {
  await generateAlert('critical', `Website Defaced: ${org.name}`, ...);
}
```

**4. check-defacement edge function -- Remove ambiguous phrases**

Remove or refine phrases that commonly appear in legitimate content:
- Remove `'we are anonymous'` -- the word "anonymous" appears in privacy policies, terms of service
- Remove `'expect us'` -- too generic
- Add context requirement: only match if the phrase appears alongside other defacement indicators

### Files Changed

| File | Action |
|---|---|
| `src/components/dashboard/AlertSidebar.tsx` | Add `.gte('created_at', oneHourAgo)` filter to query |
| `src/pages/ThreatIntelligence.tsx` | Require `indicatorCount >= 3` for defacement alerts |
| `supabase/functions/check-defacement/index.ts` | Remove ambiguous phrases (`we are anonymous`, `expect us`) from keyword list |
| Database | Resolve false Hormuud and other false defacement alerts |

