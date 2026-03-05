

## Plan: Switch API proxy backend URL to direct IP

The `api-proxy` edge function currently uses `https://cybersomalia.com` as its upstream URL, which is failing due to TLS errors. The fix is to update the default fallback URL to `http://187.77.222.249:8000` so the proxy bypasses DNS and TLS negotiation entirely.

### Change

**File: `supabase/functions/api-proxy/index.ts`** (line 7)

Replace the default value for `API_BASE`:
```typescript
// Before
const API_BASE = Deno.env.get("SECURITY_API_URL") ?? "https://cybersomalia.com";

// After
const API_BASE = Deno.env.get("SECURITY_API_URL") ?? "http://187.77.222.249:8000";
```

Single line change. No other files affected — the client-side code already points at the proxy, not the upstream URL directly.

