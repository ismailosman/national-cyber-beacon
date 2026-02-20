

## Ensure Dashboard Data Updates in Realtime

### Problem

The Dashboard has realtime subscriptions for `organizations`, `alerts`, and `threat_events`, but **none of these tables are in the Supabase realtime publication**. This means the subscriptions silently do nothing -- data only refreshes on page reload. Additionally, the `risk_history` table (which powers the 30-Day Risk Trend chart) has no realtime subscription at all.

The actual data in the database is accurate and matches what's shown:
- 36 organizations
- 58 open alerts (40 critical, 12 high, 6 medium, 0 low)
- Risk trend data across 9 days

### Changes

**1. Database Migration: Enable realtime for dashboard tables**

Add `organizations`, `alerts`, `threat_events`, and `risk_history` to the `supabase_realtime` publication so that postgres_changes events are actually emitted.

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.threat_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_history;
```

**2. File: `src/pages/Dashboard.tsx` -- Add risk_history realtime subscription**

Add a fourth realtime channel that listens for changes on `risk_history` and invalidates the `score-history-all` query key. This ensures the 30-Day National Risk Trend chart updates live when new scan results are recorded.

```typescript
const ch4 = supabase.channel('risk-history-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_history' }, () => {
    queryClient.invalidateQueries({ queryKey: ['score-history-all'] });
  }).subscribe();
```

Update the cleanup to also unsubscribe `ch4`.

### Summary

| Change | Purpose |
|---|---|
| DB migration: add 4 tables to realtime publication | Enable postgres_changes events for dashboard data |
| Dashboard.tsx: add `risk_history` channel + cleanup | Live-update the 30-Day Risk Trend chart |

After this, all dashboard cards (National Score, Monitored Orgs, Open Alerts, At Risk, severity breakdown) and the trend chart will update in realtime whenever scans complete or alerts are created/resolved.
