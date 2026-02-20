

## Limit Live Alerts Sidebar to 10 and Ensure Realtime Updates

### Changes

**File: `src/components/dashboard/AlertSidebar.tsx`**

1. Change `.limit(20)` to `.limit(10)` on line 24 so only the 10 most recent open alerts are fetched
2. The badge counter currently shows `alerts.length` (the fetched count). It will now show up to 10, matching the displayed list
3. Add a realtime subscription via `useEffect` that listens for changes on the `alerts` table and invalidates the `alerts-sidebar` query key -- this way new alerts appear immediately without waiting for the 30-second polling interval
4. Import `useQueryClient` from `@tanstack/react-query` and `useEffect` from React

### Technical Details

The realtime subscription will use the same pattern as Dashboard.tsx:

```typescript
const queryClient = useQueryClient();

useEffect(() => {
  const channel = supabase.channel('alerts-sidebar-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-sidebar'] });
    }).subscribe();

  return () => { channel.unsubscribe(); };
}, [queryClient]);
```

The `alerts` table is already in the `supabase_realtime` publication (added in the previous migration), so no database changes are needed.

### Files Changed

| File | Action |
|---|---|
| `src/components/dashboard/AlertSidebar.tsx` | Reduce limit to 10, add realtime subscription |

