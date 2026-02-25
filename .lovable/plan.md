

## Fix Scan Queue Proxy Endpoint Path

### Problem
The backend function is fetching `https://cybersomalia.com/api/jobs` but the correct endpoint is `https://cybersomalia.com/api/scan/jobs`. The server returns an HTML error page for the wrong path, causing the JSON parse failure and 502 error.

### Fix

**File: `supabase/functions/scan-queue-proxy/index.ts`**

Change the GET handler endpoint from `/api/jobs` to `/api/scan/jobs`:

```text
Before: fetch(`${API_BASE}/api/jobs`)
After:  fetch(`${API_BASE}/api/scan/jobs`)
```

This is a one-line fix. The POST endpoint (`/api/scan/start`) is already correct.

