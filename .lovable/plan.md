

## Remove Phishing Lookalike Noise from Live Alerts

### Problem

The "Active Phishing Domain" alerts (e.g., `nca.info`, `nca.com`, `opm.net`) are flooding Live Alerts because:
1. The `generateAlert` function inserts alerts **without** an `organization_id`
2. The AlertSidebar query has no filter to exclude unlinked alerts
3. Many of these "lookalike" domains are legitimate, unrelated websites (e.g., `nca.info` is not actually impersonating anything)

### Solution

Three changes to permanently fix this:

### Changes

| File / Action | Change |
|---|---|
| `src/components/dashboard/AlertSidebar.tsx` | Add `.not('organization_id', 'is', null)` filter so only alerts tied to registered organizations appear in Live Alerts |
| `src/pages/ThreatIntelligence.tsx` | Update `generateAlert` to accept an optional `organization_id` parameter and pass it when inserting. Update the phishing check caller to pass `r.organizationId` |
| Database cleanup | Close all existing phishing alerts that have no `organization_id` |

### Technical Details

**1. AlertSidebar.tsx** -- add org filter (line 25):

```typescript
const { data } = await supabase
  .from('alerts')
  .select('*, organizations(name)')
  .eq('status', 'open')
  .not('organization_id', 'is', null)   // only registered org alerts
  .gte('created_at', oneHourAgo)
  .order('created_at', { ascending: false })
  .limit(10);
```

**2. ThreatIntelligence.tsx** -- update `generateAlert` signature (line 850):

```typescript
const generateAlert = async (
  severity: string, title: string, description: string,
  organizationId?: string
) => {
  // ... dedup check ...
  await supabase.from('alerts').insert({
    title, description, severity, source: 'threat-intel',
    status: 'open', organization_id: organizationId || null,
  });
};
```

Then update the phishing caller (line 553) to pass the org ID:

```typescript
await generateAlert('critical',
  `Active Phishing Domain: ${d.domain}`,
  `Lookalike domain ${d.domain} targeting ${r.organization}...`,
  r.organizationId   // <-- link to org
);
```

**3. Database cleanup** -- close all orphan phishing alerts:

```sql
UPDATE public.alerts
SET status = 'closed'
WHERE organization_id IS NULL AND status = 'open';
```

### Result

- Live Alerts sidebar will only show threats linked to actual monitored organizations
- Future phishing alerts will be properly linked to their organization
- Existing orphan alerts (nca.info, opm.com, etc.) will be closed immediately
